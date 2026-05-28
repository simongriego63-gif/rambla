import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

class BekiAppOp1 {
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
            textoAlerta: document.getElementById('textoAlertaCustom')
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
        if(celular.length < 8) return this.mostrarAlerta("Número de WhatsApp demasiado corto.");

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
            this.mostrarAlerta("Error de conexión con el servidor.");
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
                contenedorSvg.innerHTML = this.obtenerSvgBakery();
                esDescuento = true;
                yaFueUsado = desc5Usado;
            } else {
                contenedorSvg.innerHTML = this.obtenerSvgDrink();
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

    obtenerSvgDrink() {
        return `
        <svg class="stamp-drink" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
          <g fill="none" fill-rule="evenodd">
            <path class="drink-bg" d="M16 0v16H0V0h16ZM8.395999999999999 15.505333333333333l-0.008 0.0013333333333333333 -0.047333333333333324 0.023333333333333334 -0.013333333333333332 0.0026666666666666666 -0.009333333333333332 -0.0026666666666666666 -0.047333333333333324 -0.023999999999999997c-0.006666666666666666 -0.002 -0.012666666666666666 0 -0.016 0.004l-0.0026666666666666666 0.006666666666666666 -0.011333333333333334 0.2853333333333333 0.003333333333333333 0.013333333333333332 0.006666666666666666 0.008666666666666666 0.06933333333333333 0.049333333333333326 0.009999999999999998 0.0026666666666666666 0.008 -0.0026666666666666666 0.06933333333333333 -0.049333333333333326 0.008 -0.010666666666666666 0.0026666666666666666 -0.011333333333333334 -0.011333333333333334 -0.2846666666666666c-0.0013333333333333333 -0.006666666666666666 -0.005999999999999999 -0.011333333333333334 -0.010666666666666666 -0.011999999999999999Zm0.176 -0.07533333333333334 -0.009333333333333332 0.0013333333333333333 -0.12266666666666666 0.062 -0.006666666666666666 0.006666666666666666 -0.002 0.007333333333333332 0.011999999999999999 0.2866666666666666 0.003333333333333333 0.008 0.005333333333333333 0.005333333333333333 0.134 0.06133333333333333c0.008 0.0026666666666666666 0.015333333333333332 0 0.019333333333333334 -0.005333333333333333l0.0026666666666666666 -0.009333333333333332 -0.02266666666666667 -0.4093333333333333c-0.002 -0.008 -0.006666666666666666 -0.013333333333333332 -0.013333333333333332 -0.014666666666666665Zm-0.4766666666666666 0.0013333333333333333a0.015333333333333332 0.015333333333333332 0 0 0 -0.018 0.004l-0.004 0.009333333333333332 -0.02266666666666667 0.4093333333333333c0 0.008 0.004666666666666666 0.013333333333333332 0.011333333333333334 0.016l0.009999999999999998 -0.0013333333333333333 0.134 -0.062 0.006666666666666666 -0.005333333333333333 0.002 -0.007333333333333332 0.011999999999999999 -0.2866666666666666 -0.002 -0.008 -0.006666666666666666 -0.006666666666666666 -0.12266666666666666 -0.06133333333333333Z" stroke-width="0.6667"></path>
            <path class="drink-main" d="M8.123333333333333 1.6139999999999999a0.6666666666666666 0.6666666666666666 0 0 1 1.1313333333333333 0.7006666666666665l-0.04466666666666667 0.07133333333333333 -0.19866666666666666 0.2806666666666666H11a1 1 0 0 1 0.9953333333333334 0.904L12 3.6666666666666665V4.666666666666666l-0.002 0.056c0.36133333333333334 0.12666666666666665 0.6279999999999999 0.456 0.6646666666666666 0.8513333333333333l0.004 0.09333333333333334V6.666666666666666a0.6666666666666666 0.6666666666666666 0 0 1 -0.586 0.6613333333333333l-0.07733333333333334 0.004666666666666666 -0.6133333333333333 6.133333333333333a1.3333333333333333 1.3333333333333333 0 0 1 -1.2246666666666666 1.196l-0.102 0.004h-4.126666666666667a1.3333333333333333 1.3333333333333333 0 0 1 -1.3133333333333332 -1.0999999999999999l-0.013333333333333332 -0.09999999999999999 -0.6133333333333333 -6.133333333333333a0.6666666666666666 0.6666666666666666 0 0 1 -0.6586666666666666 -0.5893333333333333L3.333333333333333 6.666666666666666V5.666666666666666a1 1 0 0 1 0.6686666666666665 -0.944l-0.0013333333333333333 -0.028L4 3.6666666666666665a1 1 0 0 1 0.904 -0.9953333333333334L5 2.6666666666666665h2.3913333333333333l0.02933333333333333 -0.057999999999999996 0.036 -0.05533333333333333 0.6666666666666666 -0.9393333333333334Zm2.473333333333333 6.386666666666667h-5.193333333333333l0.5333333333333333 5.333333333333333h4.126666666666667l0.5333333333333333 -5.333333333333333ZM11.333333333333332 6H4.666666666666666v0.6666666666666666h6.666666666666666V6Zm-0.6666666666666666 -2H5.333333333333333v0.6666666666666666h5.333333333333333V4Z" stroke-width="0.6667"></path>
          </g>
        </svg>`;
    }

    obtenerSvgBakery() {
        return `
        <svg class="stamp-bakery" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path class="bakery-main" d="m20.725 17.825 -2.775 -1 2.075 -5.125 2.125 4.375c0.33335 0.66665 0.325 1.17915 -0.025 1.5375 -0.35 0.35835 -0.81665 0.42915 -1.4 0.2125Zm-6.15 -0.45 1.55 -9.575c0.0667 -0.38335 0.2125 -0.65 0.4375 -0.8 0.225 -0.15 0.5292 -0.15 0.9125 0l1.65 0.65c0.3167 0.13335 0.5375 0.32085 0.6625 0.5625 0.125 0.24165 0.1125 0.54585 -0.0375 0.9125l-3.375 8.25h-1.8Zm-6.7 0 -3.37499 -8.25c-0.13333 -0.33335 -0.14583 -0.62915 -0.0375 -0.8875 0.108335 -0.25835 0.32917 -0.45415 0.66249 -0.5875l1.65 -0.65c0.33335 -0.13335 0.62085 -0.14165 0.8625 -0.025 0.2417 0.11665 0.4042 0.39165 0.4875 0.825l1.55 9.575h-1.8Zm-4.34999 0.45c-0.58333 0.21665 -1.05 0.14585 -1.4 -0.2125 -0.35 -0.35835 -0.35833 -0.87085 -0.025 -1.5375l2.125 -4.375L6.3 16.825l-2.77499 1Zm7.39999 -0.45 -1.65 -10.7c-0.0833 -0.55 0.025 -0.96665 0.325 -1.25s0.725 -0.425 1.275 -0.425h2.5c0.55 0 0.975 0.14165 1.275 0.425 0.3 0.28335 0.40835 0.7 0.325 1.25l-1.65 10.7h-2.4Z" stroke-width="0.5"></path>
        </svg>`;
    }

    cerrarSesion() {
        if (this.unsubscribe) this.unsubscribe(); 
        localStorage.removeItem('miTarjetaCafeTEL');
        location.reload();
    }
}

window.onload = () => {
    new BekiAppOp1();
};
