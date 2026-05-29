import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

class BekiApp {
    constructor() {
        this.db = db;
        this.unsubscribe = null;
        this.puntosAnteriores = -1;
        this.primeraCarga = true;

        this.ui = {
            skeleton: document.getElementById('pantallaSkeleton'),
            registro: document.getElementById('pantallaRegistro'),
            tarjeta: document.getElementById('pantallaTarjeta'),
            nombre: document.getElementById('displayNombre'),
            telLabel: document.getElementById('displayTelLabel'),
            qr: document.getElementById('qrImage'),
            gridSellos: document.getElementById('gridSellos'),
            puntos: document.getElementById('displayPuntos'),
            premio: document.getElementById('displayPremio'),
            modalAlerta: document.getElementById('modalAlertaCustom'),
            textoAlerta: document.getElementById('textoAlertaCustom'),
            status3: document.getElementById('refStatus3'),
            status5: document.getElementById('refStatus5')
        };

        this.vincularEventos();
        this.iniciar();
    }

    vincularEventos() {
        document.getElementById('btnCrearTarjeta').addEventListener('click', () => this.ingresar());
        document.getElementById('btnCerrarSesion').addEventListener('click', () => this.cerrarSesion());
        document.getElementById('btnCerrarAlerta').addEventListener('click', () => {
            this.ui.modalAlerta.style.display = 'none';
        });
    }

    mostrarAlerta(mensaje) {
        this.ui.textoAlerta.innerText = mensaje;
        this.ui.modalAlerta.style.display = 'flex';
    }

    iniciar() {
        const celularLocal = localStorage.getItem('miTarjetaCafeTEL');
        if (celularLocal) {
            this.cambiarPantalla('skeleton'); 
            this.abrirTarjeta(celularLocal);
        } else {
            this.cambiarPantalla('registro');
        }
    }

    cambiarPantalla(pantalla) {
        this.ui.skeleton.style.display = pantalla === 'skeleton' ? 'block' : 'none';
        this.ui.registro.style.display = pantalla === 'registro' ? 'block' : 'none';
        this.ui.tarjeta.style.display = pantalla === 'tarjeta' ? 'block' : 'none';
    }

    formatearNombre(texto) {
        if (!texto) return "";
        return texto.trim().toLowerCase().replace(/\b\w/g, letra => letra.toUpperCase());
    }

    async ingresar() {
        const nombreIngresado = document.getElementById('inputNombre').value;
        const nombre = this.formatearNombre(nombreIngresado);
        let celular = document.getElementById('inputCelular').value.trim();

        if(!nombre || !celular) return this.mostrarAlerta("Por favor completa tu nombre y numero.");
        
        celular = celular.replace(/\D/g,''); 
        if(celular.length < 8) return this.mostrarAlerta("Número demasiado corto.");

        this.cambiarPantalla('skeleton');

        try {
            const docRef = doc(this.db, "clientes", celular);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                await setDoc(docRef, { 
                    nombre: nombre, 
                    puntos: 0,
                    desc3Usado: false,
                    desc5Usado: false,
                    fechaRegistro: new Date().toISOString()
                });
            } else {
                await setDoc(docRef, { nombre: nombre }, { merge: true });
            }
            
            localStorage.setItem('miTarjetaCafeTEL', celular);
            this.abrirTarjeta(celular);
        } catch (e) {
            console.error(e);
            this.mostrarAlerta("Error de conexión.");
            this.cambiarPantalla('registro');
        }
    }

    abrirTarjeta(celular) {
        this.ui.qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${celular}&bgcolor=FCD34D&color=4A0E17`;
        this.ui.telLabel.innerText = `******${celular.slice(-4)}`;

        this.unsubscribe = onSnapshot(doc(this.db, "clientes", celular), (docSnap) => {
            if (docSnap.exists()) {
                const datos = docSnap.data();
                this.ui.nombre.innerText = datos.nombre;
                
                if(this.primeraCarga) {
                    setTimeout(() => {
                        this.cambiarPantalla('tarjeta');
                        this.renderizarSellos(datos);
                    }, 400);
                } else {
                    this.renderizarSellos(datos);
                }
            } else {
                this.cerrarSesion(); 
            }
        });
    }

    renderizarSellos(datos) {
        const puntosActuales = datos.puntos || 0;
        const desc3Usado = datos.desc3Usado || false;
        const desc5Usado = datos.desc5Usado || false;
        const totalTazas = 8; 
        
        const puntosPrevios = this.puntosAnteriores;
        const animarNuevos = !this.primeraCarga && puntosActuales > puntosPrevios;

        this.ui.gridSellos.innerHTML = ''; 

        for (let i = 1; i <= totalTazas; i++) {
            const contenedorSvg = document.createElement('div');
            let esDescuento = false;
            let yaFueUsado = false;

            if (i === 3) {
                contenedorSvg.innerHTML = this.obtenerSvgBakery();
                esDescuento = true;
                yaFueUsado = desc3Usado;
            } else if (i === 5) {
                contenedorSvg.innerHTML = this.obtenerSvgBolt();
                esDescuento = true;
                yaFueUsado = desc5Usado;
            } else {
                contenedorSvg.innerHTML = this.obtenerSvgGrano();
            }
            
            const svgElement = contenedorSvg.querySelector('svg'); 
            
            if (i <= puntosActuales) {
                setTimeout(() => {
                    svgElement.classList.add('filled');
                    if (animarNuevos && i > puntosPrevios) {
                        setTimeout(() => this.dispararParticulas(svgElement), 150);
                    }
                }, 50);
            }
            
            if (esDescuento && yaFueUsado) {
                svgElement.classList.add('used');
            }
            
            this.ui.gridSellos.appendChild(svgElement);
        }

        if(this.ui.status3 && this.ui.status5) {
            this.ui.status3.innerText = desc3Usado ? "Canjeado ✓" : (puntosActuales >= 3 ? "Disponible ✨" : "");
            this.ui.status3.style.color = desc3Usado ? "var(--dark)" : "var(--accent)";
            
            this.ui.status5.innerText = desc5Usado ? "Canjeado ✓" : (puntosActuales >= 5 ? "Disponible ✨" : "");
            this.ui.status5.style.color = desc5Usado ? "var(--dark)" : "var(--accent)";
        }

        this.ui.puntos.innerText = puntosActuales;
        
        if(puntosActuales >= totalTazas) {
            this.ui.premio.innerText = "¡Listo!";
            this.ui.premio.style.color = "var(--accent)";
        } else {
            this.ui.premio.innerText = "En progreso";
            this.ui.premio.style.color = "var(--dark)";
        }

        this.puntosAnteriores = puntosActuales;
        this.primeraCarga = false;
    }

    dispararParticulas(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            document.body.appendChild(p);

            const angle = Math.random() * Math.PI * 2;
            const velocity = 25 + Math.random() * 35;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity - 15; 

            p.style.left = centerX + 'px';
            p.style.top = centerY + 'px';

            p.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
            ], {
                duration: 600 + Math.random() * 300,
                easing: 'cubic-bezier(0, .9, .57, 1)',
                fill: 'forwards'
            });

            setTimeout(() => p.remove(), 1000); 
        }
    }

    obtenerSvgGrano() {
        return `
        <svg class="stamp-bean" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" width="100%" height="100%">
            <path class="bean-body" stroke-linecap="round" stroke-linejoin="round" d="M10.5356 10.5355c-2.53843 2.5384 -6.17913 3.0132 -8.13175 1.0606C0.45123 9.6435 0.926103 6.0028 3.46451 3.46439 6.00292 0.925981 9.64362 0.451108 11.5962 2.40373c1.9527 1.95262 1.4778 5.59332 -1.0606 8.13177Z"></path>
            <path class="bean-crease" stroke-linecap="round" stroke-linejoin="round" d="M11.5962 2.40381s-0.3536 2.47487 -1.76777 3.88909c-1.41421 1.41421 -4.24264 0 -5.65685 1.41421 -1.41422 1.41421 -1.76777 3.88909 -1.76777 3.88909"></path>
        </svg>`;
    }

    obtenerSvgBolt() {
        return `
        <svg class="stamp-bolt" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="100%" height="100%">
            <path class="bolt-main" d="m11.4251 14.3501 -6.80002 -0.8c-0.31667 -0.03335 -0.525 -0.20415 -0.625 -0.5125 -0.1 -0.30835 -0.033335 -0.57085 0.2 -0.7875l11.00002 -10.1c0.06665 -0.05 0.1375 -0.09167 0.2125 -0.125 0.075 -0.033335 0.1875 -0.05 0.3375 -0.05 0.25 0 0.44165 0.104165 0.575 0.3125 0.1333 0.20833 0.1333 0.42083 0 0.6375l-3.75 6.725 6.8 0.8c0.31665 0.03335 0.525 0.20415 0.625 0.5125 0.1 0.30835 0.0333 0.57085 -0.2 0.7875l-11 10.1c-0.0667 0.05 -0.1375 0.09165 -0.2125 0.125 -0.075 0.03335 -0.1875 0.05 -0.3375 0.05 -0.25 0 -0.4417 -0.10415 -0.575 -0.3125 -0.13335 -0.20835 -0.13335 -0.42085 0 -0.6375l3.75 -6.725Zm-0.1 3 6.3 -5.575 -7.425 -0.9 2.475 -4.225 -6.325 5.6 7.425 0.875 -2.45 4.225Z"></path>
        </svg>`;
    }

    obtenerSvgBakery() {
        return `
        <svg class="stamp-bakery" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">
          <path class="bakery-main" d="m20.725 17.825 -2.775 -1 2.075 -5.125 2.125 4.375c0.33335 0.66665 0.325 1.17915 -0.025 1.5375 -0.35 0.35835 -0.81665 0.42915 -1.4 0.2125Zm-6.15 -0.45 1.55 -9.575c0.0667 -0.38335 0.2125 -0.65 0.4375 -0.8 0.225 -0.15 0.5292 -0.15 0.9125 0l1.65 0.65c0.3167 0.13335 0.5375 0.32085 0.6625 0.5625 0.125 0.24165 0.1125 0.54585 -0.0375 0.9125l-3.375 8.25h-1.8Zm-6.7 0 -3.37499 -8.25c-0.13333 -0.33335 -0.14583 -0.62915 -0.0375 -0.8875 0.108335 -0.25835 0.32917 -0.45415 0.66249 -0.5875l1.65 -0.65c0.33335 -0.13335 0.62085 -0.14165 0.8625 -0.025 0.2417 0.11665 0.4042 0.39165 0.4875 0.825l1.55 9.575h-1.8Zm-4.34999 0.45c-0.58333 0.21665 -1.05 0.14585 -1.4 -0.2125 -0.35 -0.35835 -0.35833 -0.87085 -0.025 -1.5375l2.125 -4.375L6.3 16.825l-2.77499 1Zm7.39999 -0.45 -1.65 -10.7c-0.0833 -0.55 0.025 -0.96665 0.325 -1.25s0.725 -0.425 1.275 -0.425h2.5c0.55 0 0.975 0.14165 1.275 0.425 0.3 0.28335 0.40835 0.7 0.325 1.25l-1.65 10.7h-2.4Z"></path>
        </svg>`;
    }

    cerrarSesion() {
        if (this.unsubscribe) this.unsubscribe(); 
        localStorage.removeItem('miTarjetaCafeTEL');
        location.reload();
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado', reg.scope))
            .catch(err => console.error('Error Service Worker', err));
    });
}

window.onload = () => {
    new BekiApp();
};
