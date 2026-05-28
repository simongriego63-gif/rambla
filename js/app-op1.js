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
                contenedorSvg.innerHTML = this.obtenerSvgDescuento();
                esDescuento = true;
                yaFueUsado = desc3Usado;
            } else if (i === 5) {
                contenedorSvg.innerHTML = this.obtenerSvgDescuento();
                esDescuento = true;
                yaFueUsado = desc5Usado;
            } else {
                // ACA USAMOS EL GRANO DE CAFÉ
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

    obtenerSvgDescuento() {
        return `
        <svg class="stamp-discount" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle class="discount-border" cx="50" cy="50" r="38" />
            <text class="discount-text" x="50" y="65" text-anchor="middle">%</text>
        </svg>`;
    }

    // EL SVG DEL GRANO DE CAFÉ
    obtenerSvgGrano() {
        return `
        <svg class="stamp-bean" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <ellipse class="bean-body" cx="50" cy="50" rx="35" ry="45" transform="rotate(30 50 50)" />
            <path class="bean-crease" d="M 40,25 C 65,40 35,60 60,75" />
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
