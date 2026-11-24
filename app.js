const btnInstalar = document.getElementById('btn-instalar');
const btnPrepararCamara = document.getElementById('btn-preparar-camara');
const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');
const btnAlternarCamara = document.getElementById('btn-alternar-camara');
const btnApagarCamara = document.getElementById('btn-apagar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');
const visorVideo = document.getElementById('visor-camara');
const mensajeEstado = document.getElementById('mensaje-estado');

let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then((registro) => {
            console.log('SW registrado con scope', registro.scope);
        })
        .catch((error) => {
            console.error('No se pudo registrar el SW', error);
        });
}

// ---------- instalacion ----------

window.addEventListener('beforeinstallprompt', (event) => {
    // evita el mini banner automatico, lo lanzamos desde nuestro boton
    event.preventDefault();
    eventoInstalacionDiferido = event;
    btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
    if (!eventoInstalacionDiferido) return;

    eventoInstalacionDiferido.prompt();
    eventoInstalacionDiferido.userChoice
        .then((resultado) => {
            console.log('Respuesta de instalacion:', resultado.outcome);
            if (resultado.outcome === 'accepted') {
                btnInstalar.hidden = true;
            }
        })
        .finally(() => {
            // el evento solo se puede usar una vez
            eventoInstalacionDiferido = null;
        });
});

window.addEventListener('appinstalled', () => {
    console.log('App instalada');
    btnInstalar.hidden = true;
});

// en iphone no existe beforeinstallprompt, se muestran los pasos manuales
function verificarEntornoIOS() {
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const estaInstalada = window.navigator.standalone === true ||
                          window.matchMedia('(display-mode: standalone)').matches;

    if (esIOS && !estaInstalada) {
        const guiaIOS = document.getElementById('instrucciones-ios');
        if (guiaIOS) guiaIOS.hidden = false;
    }
}

// ---------- camara ----------

function actualizarMensajeEstado(texto) {
    mensajeEstado.textContent = texto;
}

function actualizarBotones() {
    const camaraEncendida = streamActual !== null;
    btnAlternarCamara.disabled = !camaraEncendida;
    btnApagarCamara.disabled = !camaraEncendida;
    // si la camara no prendio se puede volver a intentar
    btnPrepararCamara.hidden = camaraEncendida;
}

function detenerCamaraActiva() {
    if (streamActual) {
        streamActual.getTracks().forEach((track) => {
            track.stop();
        });
        streamActual = null;
    }
}

function iniciarCamara(modo) {
    // en movil no se puede abrir otro lente con el anterior encendido
    detenerCamaraActiva();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        actualizarMensajeEstado('Este navegador no permite usar la cámara (se necesita HTTPS).');
        return Promise.resolve();
    }

    const restricciones = {
        video: { facingMode: modo },
        audio: false
    };

    actualizarMensajeEstado('Encendiendo cámara...');

    return navigator.mediaDevices.getUserMedia(restricciones)
        .then((stream) => {
            streamActual = stream;
            visorVideo.srcObject = stream;
            actualizarMensajeEstado(`Cámara activa (${modo === 'environment' ? 'Trasera' : 'Frontal'})`);
        })
        .catch((error) => {
            if (error.name === 'NotAllowedError') {
                actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
            } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
                actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
            } else if (error.name === 'NotReadableError') {
                actualizarMensajeEstado('La cámara está ocupada por otra aplicación.');
            } else {
                actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
            }
        })
        .finally(() => {
            actualizarBotones();
        });
}

// paso 1: solo se muestra el aviso, todavia no se pide el permiso
btnPrepararCamara.addEventListener('click', () => {
    avisoPermiso.hidden = false;
});

// paso 2: con el consentimiento ya se llama a getUserMedia
btnConfirmarPermiso.addEventListener('click', () => {
    avisoPermiso.hidden = true;
    iniciarCamara(modoCamaraActual);
});

btnAlternarCamara.addEventListener('click', () => {
    modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';
    iniciarCamara(modoCamaraActual);
});

btnApagarCamara.addEventListener('click', () => {
    detenerCamaraActiva();
    visorVideo.srcObject = null;
    actualizarMensajeEstado('Cámara apagada');
    actualizarBotones();
});

verificarEntornoIOS();
