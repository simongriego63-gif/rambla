import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

class BekiAppPremium {
    constructor() {
        this.db = db;
        this.unsubscribe = null;
        this.puntosAnteriores = -1;
        this.primeraCarga = true;

        this.ui = {
            skeleton: document.getElementById('pantallaSkeleton'),
            registro: document.getElementById('pantallaRegistro'),
            tarjeta: document.getElementById('pantallaTarjeta'),
            cardInner: document.getElementById('cardInner'),
            nombre: document.getElementById('displayNombre'),
            telLabel: document.getElementById('displayTelLabel'),
            userInitial: document.getElementById('userInitial'),
            qr: document.getElementById('qrImage'),
            gridSellos: document.getElementById('gridSellos'),
            puntos: document.getElementById('displayPuntos'),
            premio: document.getElementById('displayPremio'),
            progressFill: document.getElementById('progressFill'),
            progressGlow: document.getElementById('progressGlow'),
            modalAlerta: document.getElementById('modalAlertaCustom'),
            textoAlerta: document.getElementById('textoAlertaCustom'),
            status3: document.getElementById('refStatus3'),
            status5: document.getElementById('refStatus5'),
            status8: document.getElementById('refStatus8'),
            celebrationContainer: document.getElementById('celebrationContainer')
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

        // Card flip handlers
        document.getElementById('btnFlipToBack').addEventListener('click', (e) => {
            e.stopPropagation();
            this.ui.cardInner.classList.add('flipped');
        });

        document.getElementById('btnFlipToFront').addEventListener('click', (e) => {
            e.stopPropagation();
            this.ui.cardInner.classList.remove('flipped');
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

        if (!nombre || !celular) {
            return this.mostrarAlerta("Por favor completa tu nombre y numero para continuar.");
        }

        celular = celular.replace(/\D/g, '');
        if (celular.length < 8) {
            return this.mostrarAlerta("El numero de WhatsApp es demasiado corto. Revisa que este bien escrito.");
        }

        this.cambiarPantalla('skeleton');

        try {
            const docRef = doc(this.db, "clientes", celular);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                await setDoc(docRef, { nombre: nombre }, { merge: true });
            } else {
                await setDoc(docRef, {
                    nombre: nombre,
                    puntos: 0,
                    desc3Usado: false,
                    desc5Usado: false,
                    fechaRegistro: new Date().toISOString()
                });
            }

            localStorage.setItem('miTarjetaCafeTEL', celular);
            this.abrirTarjeta(celular);
        } catch (e) {
            console.error("Error:", e);
            this.mostrarAlerta("Hubo un error de conexion. Revisa tu internet e intenta de nuevo.");
            this.cambiarPantalla('registro');
        }
    }

    abrirTarjeta(celular) {
        // QR in black and white
        this.ui.qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${celular}&bgcolor=ffffff&color=0a0a0a`;
        this.ui.telLabel.innerText = `******${celular.slice(-4)}`;

        this.unsubscribe = onSnapshot(doc(this.db, "clientes", celular), (docSnap) => {
            if (docSnap.exists()) {
                const datos = docSnap.data();
                this.ui.nombre.innerText = datos.nombre;
                this.ui.userInitial.innerText = datos.nombre.charAt(0).toUpperCase();

                if (this.primeraCarga) {
                    setTimeout(() => {
                        this.cambiarPantalla('tarjeta');
                        this.renderizarTazas(datos);
                    }, 500);
                } else {
                    this.renderizarTazas(datos);
                }
            } else {
                this.cerrarSesion();
            }
        });
    }

    renderizarTazas(datos) {
        const puntosActuales = datos.puntos || 0;
        const desc3Usado = datos.desc3Usado || false;
        const desc5Usado = datos.desc5Usado || false;
        const totalTazas = 8;

        const puntosPrevios = this.puntosAnteriores;
        const animarNuevos = !this.primeraCarga && puntosActuales > puntosPrevios;

        this.ui.gridSellos.innerHTML = '';

        // Update progress bar
        const progressPercent = (puntosActuales / totalTazas) * 100;
        this.ui.progressFill.style.width = `${progressPercent}%`;

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
                contenedorSvg.innerHTML = this.obtenerSvgTaza();
            }

            const svgElement = contenedorSvg.querySelector('svg');

            if (i <= puntosActuales) {
                const delay = this.primeraCarga ? i * 60 : 0;
                setTimeout(() => {
                    svgElement.classList.add('filled');

                    if (animarNuevos && i > puntosPrevios) {
                        setTimeout(() => this.dispararParticulas(svgElement), 200);
                    }
                }, delay);
            }

            if (esDescuento && yaFueUsado) {
                svgElement.classList.add('used');
            }

            this.ui.gridSellos.appendChild(svgElement);
        }

        // Update reward items
        this.actualizarRecompensas(puntosActuales, desc3Usado, desc5Usado);

        // Update points display
        this.ui.puntos.innerText = puntosActuales;

        // Update status
        if (puntosActuales >= totalTazas) {
            this.ui.premio.innerText = "Bebida lista";
            this.ui.premio.classList.add('premio-listo');
            
            if (animarNuevos && puntosActuales === totalTazas) {
                this.celebrar();
            }
        } else {
            this.ui.premio.innerText = "En progreso";
            this.ui.premio.classList.remove('premio-listo');
        }

        this.puntosAnteriores = puntosActuales;
        this.primeraCarga = false;
    }

    actualizarRecompensas(puntos, desc3Usado, desc5Usado) {
        const reward3 = document.querySelector('[data-reward="3"]');
        const reward5 = document.querySelector('[data-reward="5"]');
        const reward8 = document.querySelector('[data-reward="8"]');

        // Reset states
        [reward3, reward5, reward8].forEach(r => {
            r.classList.remove('active', 'completed');
        });

        // Reward 3
        if (desc3Usado) {
            reward3.classList.add('completed');
            this.ui.status3.innerText = 'Canjeado';
        } else if (puntos >= 3) {
            reward3.classList.add('active');
            this.ui.status3.innerText = 'Disponible';
        } else {
            this.ui.status3.innerText = `${3 - puntos} sellos`;
        }

        // Reward 5
        if (desc5Usado) {
            reward5.classList.add('completed');
            this.ui.status5.innerText = 'Canjeado';
        } else if (puntos >= 5) {
            reward5.classList.add('active');
            this.ui.status5.innerText = 'Disponible';
        } else {
            this.ui.status5.innerText = `${5 - puntos} sellos`;
        }

        // Reward 8
        if (puntos >= 8) {
            reward8.classList.add('active');
            this.ui.status8.innerText = 'Disponible';
        } else {
            this.ui.status8.innerText = `${8 - puntos} sellos`;
        }
    }

    dispararParticulas(targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 8; i++) {
            const p = document.createElement('div');
            p.className = `particle ${Math.random() > 0.5 ? 'light' : ''}`;
            document.body.appendChild(p);

            const angle = (Math.PI * 2 * i) / 8;
            const velocity = 20 + Math.random() * 25;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            p.style.left = centerX + 'px';
            p.style.top = centerY + 'px';

            p.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
            ], {
                duration: 600,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards'
            });

            setTimeout(() => p.remove(), 700);
        }
    }

    celebrar() {
        const container = this.ui.celebrationContainer;
        const colors = ['', 'gray', 'light'];

        for (let i = 0; i < 40; i++) {
            const confetti = document.createElement('div');
            confetti.className = `confetti ${colors[Math.floor(Math.random() * colors.length)]}`;

            const startX = Math.random() * window.innerWidth;
            const startY = -20;
            const endX = startX + (Math.random() - 0.5) * 200;
            const endY = window.innerHeight + 20;
            const rotation = Math.random() * 720 - 360;
            const duration = 2000 + Math.random() * 1000;
            const delay = Math.random() * 500;

            confetti.style.left = startX + 'px';
            confetti.style.top = startY + 'px';
            confetti.style.width = (4 + Math.random() * 6) + 'px';
            confetti.style.height = (4 + Math.random() * 6) + 'px';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';

            container.appendChild(confetti);

            confetti.animate([
                { 
                    transform: `translate(0, 0) rotate(0deg)`, 
                    opacity: 1 
                },
                { 
                    transform: `translate(${endX - startX}px, ${endY}px) rotate(${rotation}deg)`, 
                    opacity: 0 
                }
            ], {
                duration: duration,
                delay: delay,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
                fill: 'forwards'
            });

            setTimeout(() => confetti.remove(), duration + delay + 100);
        }
    }

    obtenerSvgDescuento() {
        return `
        <svg class="stamp-discount" viewBox="0 0 44 60" xmlns="http://www.w3.org/2000/svg">
            <circle class="discount-circle" cx="22" cy="35" r="18" />
            <text class="discount-symbol" x="22" y="41" text-anchor="middle">%</text>
        </svg>`;
    }

    obtenerSvgTaza() {
        return `
        <svg class="stamp-cup" viewBox="0 0 44 60" xmlns="http://www.w3.org/2000/svg">
            <path class="steam-line" d="M16,12 Q16,8 18,6" />
            <path class="steam-line" d="M22,10 Q22,5 24,2" />
            <path class="steam-line" d="M28,12 Q28,8 30,6" />
            
            <path class="cup-body" d="M8,18 L10,50 Q10,56 16,56 L28,56 Q34,56 34,50 L36,18 Z" />
            <path class="cup-fill" d="M10,22 L12,48 Q12,52 16,52 L28,52 Q32,52 32,48 L34,22 Z" />
            <path class="cup-handle" d="M36,24 Q44,24 44,34 Q44,44 36,44" />
        </svg>`;
    }

    cerrarSesion() {
        if (this.unsubscribe) this.unsubscribe();
        localStorage.removeItem('miTarjetaCafeTEL');
        location.reload();
    }
}

window.onload = () => {
    new BekiAppPremium();
};

// --- PWA INSTALLATION LOGIC ---
let eventoInstalacion = null;
const btnInstalar = document.getElementById('btnInstalarApp');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion = e;
    if (btnInstalar) btnInstalar.style.display = 'block';
});

if (btnInstalar) {
    btnInstalar.addEventListener('click', async () => {
        if (!eventoInstalacion) return;
        eventoInstalacion.prompt();
        const { outcome } = await eventoInstalacion.userChoice;
        if (outcome === 'accepted') {
            btnInstalar.style.display = 'none';
        }
        eventoInstalacion = null;
    });
}

window.addEventListener('appinstalled', () => {
    if (btnInstalar) btnInstalar.style.display = 'none';
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered', reg.scope))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}
