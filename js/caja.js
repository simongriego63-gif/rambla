import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

class BekiCajaApp {
    constructor() {
        this.db = db;
        this.html5QrCode = null;
        this.clienteActual = null;
        this.pinCorrecto = "2026"; 

        this.ui = {
            login: document.getElementById('pantallaLogin'),
            busqueda: document.getElementById('pantallaBusqueda'),
            acciones: document.getElementById('pantallaAcciones'),
            contenedorAcciones: document.getElementById('contenedorAcciones'),
            contenedorPremios: document.getElementById('contenedorPremios'),
            loader: document.getElementById('mensajeLoader'),
            pinInput: document.getElementById('inputPin'),
            errorCamara: document.getElementById('errorCamara'),
            modalAlerta: document.getElementById('modalAlertaCustom'),
            textoAlerta: document.getElementById('textoAlertaCustom'),
            modalConfirm: document.getElementById('modalConfirmCustom'),
            textoConfirm: document.getElementById('textoConfirmCustom')
        };

        this.audioBeep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'); 

        this.iniciarEventos();
        this.verificarSeguridad();
    }

    mostrarAlerta(mensaje) {
        this.ui.textoAlerta.innerText = mensaje;
        this.ui.modalAlerta.style.display = 'flex';
    }

    mostrarConfirmacion(mensaje, callbackAceptar) {
        this.ui.textoConfirm.innerText = mensaje;
        this.ui.modalConfirm.style.display = 'flex';
        
        // Limpiamos eventos previos para que no se dupliquen
        const btnAceptar = document.getElementById('btnAceptarConfirm');
        const nuevoBtnAceptar = btnAceptar.cloneNode(true);
        btnAceptar.parentNode.replaceChild(nuevoBtnAceptar, btnAceptar);
        
        nuevoBtnAceptar.onclick = () => {
            this.ui.modalConfirm.style.display = 'none';
            callbackAceptar();
        };
        
        document.getElementById('btnCancelarConfirm').onclick = () => {
            this.ui.modalConfirm.style.display = 'none';
        };
    }

    iniciarEventos() {
        document.getElementById('btnCerrarAlerta').addEventListener('click', () => {
            this.ui.modalAlerta.style.display = 'none';
        });

        document.getElementById('btnDesbloquear').addEventListener('click', () => this.verificarPin());
        this.ui.pinInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') this.verificarPin(); });
        
        document.getElementById('btnBuscarManual').addEventListener('click', () => {
            let tel = document.getElementById('inputTelBusqueda').value.replace(/\D/g,'');
            if(tel.length < 8) return this.mostrarAlerta("Número inválido. Ingrese al menos 8 dígitos.");
            this.pausarCamara();
            this.buscarClienteEnFirebase(tel);
        });

        document.getElementById('btnSumar').addEventListener('click', () => this.modificarSellos(1));
        document.getElementById('btnRestar').addEventListener('click', () => this.modificarSellos(-1));
        document.getElementById('btnVolver').addEventListener('click', () => this.volverABuscar());
    }

    reproducirBeep() { try { this.audioBeep.play().catch(e=>{}); } catch(e){} }
    vibrar(patron) { if ("vibrate" in navigator) { navigator.vibrate(patron); } }

    verificarSeguridad() {
        if (localStorage.getItem('baristaAutorizado') === 'true') {
            this.ui.login.style.display = 'none';
            this.iniciarCamara();
        }
    }

    verificarPin() {
        const pinIngresado = this.ui.pinInput.value;
        if (pinIngresado === this.pinCorrecto) {
            localStorage.setItem('baristaAutorizado', 'true');
            this.ui.login.style.display = 'none';
            this.iniciarCamara();
        } else {
            this.ui.pinInput.classList.add('error-shake');
            this.vibrar([100, 50, 100]); 
            setTimeout(() => {
                this.ui.pinInput.classList.remove('error-shake');
                this.ui.pinInput.value = '';
            }, 400);
        }
    }

    iniciarCamara() {
        this.ui.errorCamara.style.display = 'none';
        if (!this.html5QrCode) { this.html5QrCode = new Html5Qrcode("reader"); }
        
        this.html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 180, height: 180 } },
            (decodedText) => this.onScanSuccess(decodedText),
            () => { }
        ).catch((err) => {
            console.error("Fallo cámara: ", err);
            this.ui.errorCamara.style.display = 'block'; 
        });
    }

    pausarCamara() {
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            this.html5QrCode.stop().catch(err => console.log(err));
        }
    }

    onScanSuccess(decodedText) {
        this.reproducirBeep();
        this.vibrar(100);
        this.pausarCamara();
        this.buscarClienteEnFirebase(decodedText);
    }

    async buscarClienteEnFirebase(telefono) {
        this.ui.busqueda.style.display = 'none';
        this.ui.loader.style.display = 'block';

        try {
            const docRef = doc(this.db, "clientes", telefono);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const datos = docSnap.data();
                
                // Guardamos todos los datos relevantes del cliente
                this.clienteActual = {
                    id: telefono,
                    puntos: datos.puntos || 0,
                    desc3Usado: datos.desc3Usado || false,
                    desc5Usado: datos.desc5Usado || false
                };
                
                document.getElementById('uiNombre').innerText = datos.nombre;
                document.getElementById('uiTel').innerText = telefono;
                document.getElementById('uiSellos').innerText = this.clienteActual.puntos;
                document.getElementById('uiAvatar').innerText = datos.nombre.charAt(0).toUpperCase();

                this.renderizarBotonesEspeciales();

                this.ui.loader.style.display = 'none';
                this.ui.acciones.style.display = 'flex'; 
            } else {
                this.mostrarAlerta("Cliente no encontrado en la base de datos.");
                this.volverABuscar();
            }
        } catch (error) {
            console.error(error);
            this.mostrarAlerta("Error de conexión con el servidor.");
            this.volverABuscar();
        }
    }

    // LÓGICA NUEVA: Evalúa qué botones mostrar según los puntos y usos
    renderizarBotonesEspeciales() {
        this.ui.contenedorPremios.innerHTML = '';
        this.ui.contenedorAcciones.classList.remove('glow-premio');
        
        const ptos = this.clienteActual.puntos;
        let tienePremioPendiente = false;

        // Mostrar Sumar Sello (A menos que ya tenga 8)
        document.getElementById('btnSumar').style.display = ptos < 8 ? 'block' : 'none';

        // Lógica Sello 3 (15% OFF)
        if (ptos >= 3 && !this.clienteActual.desc3Usado) {
            this.crearBotonDescuento("Canjear 15% OFF (Sello 3)", 'desc3Usado');
            tienePremioPendiente = true;
        }

        // Lógica Sello 5 (25% OFF)
        if (ptos >= 5 && !this.clienteActual.desc5Usado) {
            this.crearBotonDescuento("Canjear 25% OFF (Sello 5)", 'desc5Usado');
            tienePremioPendiente = true;
        }

        // Lógica Sello 8 (Premio Final)
        if (ptos >= 8) {
            const btnCanjeTotal = document.createElement('button');
            btnCanjeTotal.className = 'btn btn-canje';
            btnCanjeTotal.style.display = 'block';
            btnCanjeTotal.innerHTML = '☕ Entregar Bebida Gratis';
            btnCanjeTotal.onclick = () => this.canjearPremioFinal();
            this.ui.contenedorPremios.appendChild(btnCanjeTotal);
            tienePremioPendiente = true;
        }

        if(tienePremioPendiente) {
            this.ui.contenedorAcciones.classList.add('glow-premio');
        }
    }

    crearBotonDescuento(texto, campoDb) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-premio-intermedio';
        btn.innerHTML = `% ${texto}`;
        btn.onclick = () => this.registrarDescuento(campoDb, texto);
        this.ui.contenedorPremios.appendChild(btn);
    }

    async registrarDescuento(campoDb, nombreDesc) {
        this.mostrarConfirmacion(`¿Confirmas aplicar el descuento: ${nombreDesc}?`, async () => {
            try {
                const docRef = doc(this.db, "clientes", this.clienteActual.id);
                // Usamos sintaxis dinámica para actualizar el booleano
                await updateDoc(docRef, { [campoDb]: true }); 
                
                this.vibrar([100, 50, 100]); 
                this.clienteActual[campoDb] = true; // Actualizamos la memoria
                this.renderizarBotonesEspeciales(); // Recargamos UI

            } catch(e) {
                this.mostrarAlerta("Ocurrió un error al canjear el descuento.");
            }
        });
    }

    async modificarSellos(cantidad) {
        if(cantidad === -1 && this.clienteActual.puntos <= 0) return;
        if(cantidad === 1 && this.clienteActual.puntos >= 8) return;

        const btn = document.getElementById('btnSumar');
        const btnOriginalText = btn.innerText;
        btn.innerText = "...";
        btn.disabled = true;

        try {
            const docRef = doc(this.db, "clientes", this.clienteActual.id);
            await updateDoc(docRef, { puntos: increment(cantidad) });
            
            this.clienteActual.puntos += cantidad;
            document.getElementById('uiSellos').innerText = this.clienteActual.puntos;
            
            // EFECTO POSITIVO AL SUMAR
            if(cantidad === 1) {
                this.vibrar(50); 
                btn.classList.add('btn-success');
                btn.innerText = "¡Sumado! ✓";
                setTimeout(() => {
                    btn.classList.remove('btn-success');
                    this.renderizarBotonesEspeciales(); 
                    btn.disabled = false;
                    btn.innerText = btnOriginalText;
                }, 1000);
            } else {
                this.renderizarBotonesEspeciales();
                btn.disabled = false;
                btn.innerText = btnOriginalText;
            }

        } catch(e) {
            this.mostrarAlerta("Ocurrió un error al guardar el sello.");
            btn.disabled = false;
            btn.innerText = btnOriginalText;
        } 
    }

    canjearPremioFinal() {
        this.mostrarConfirmacion("¿Confirmas la entrega de la bebida gratis? Se reiniciará la tarjeta.", async () => {
            try {
                const docRef = doc(this.db, "clientes", this.clienteActual.id);
                const fechaAutomatica = new Date().toISOString(); 
                
                // Reiniciamos todo el progreso para una nueva tarjeta
                await updateDoc(docRef, { 
                    puntos: 0,
                    desc3Usado: false,
                    desc5Usado: false,
                    ultimoPremio: fechaAutomatica, 
                    totalPremiosCanjeados: increment(1) 
                }); 
                
                this.vibrar([100, 50, 100, 50, 200]); 
                this.mostrarAlerta("¡Premio registrado y tarjeta reiniciada!");
                this.volverABuscar(); 
            } catch(e) {
                this.mostrarAlerta("Error al reiniciar la tarjeta.");
            }
        });
    }

    volverABuscar() {
        this.ui.acciones.style.display = 'none';
        this.ui.loader.style.display = 'none';
        this.ui.busqueda.style.display = 'block';
        document.getElementById('inputTelBusqueda').value = "";
        this.clienteActual = null;
        this.iniciarCamara();
    }
}

window.onload = () => {
    window.miCaja = new BekiCajaApp(); 
};
