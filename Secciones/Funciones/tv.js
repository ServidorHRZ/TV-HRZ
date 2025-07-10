let todosLosCanales = [];
let canalActual = null;
let hls = null;
let categoriasUnicas = [];
let canalesFavoritos = JSON.parse(localStorage.getItem('favoritos')) || [];

// Constantes para el manejo de caché
const CACHE_VERSION = '1.0';
const CACHE_KEYS = {
    CANALES: 'hrztv_canales_cache',
    TIMESTAMP: 'hrztv_cache_timestamp',
    VERSION: 'hrztv_cache_version'
};

// Función para manejar el caché
function gestionarCache() {
    const cacheVersion = localStorage.getItem(CACHE_KEYS.VERSION);
    const ultimaActualizacion = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
    
    // Forzar actualización si:
    // 1. La versión del caché es diferente
    // 2. Han pasado más de 1 hora desde la última actualización
    // 3. No hay timestamp guardado
    if (cacheVersion !== CACHE_VERSION || 
        !ultimaActualizacion || 
        Date.now() - parseInt(ultimaActualizacion) > 1 * 60 * 60 * 1000) { // 1 hora en lugar de 6
        
        // Limpiar todo el caché
        Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
        localStorage.setItem(CACHE_KEYS.VERSION, CACHE_VERSION);
        
        // Forzar nueva carga de canales
        return false;
    }
    
    return true;
}

// Función para verificar caché
function esCacheActualizado() {
    const ultimaActualizacion = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (!ultimaActualizacion) return false;
    
    const TIEMPO_CACHE = 1 * 60 * 60 * 1000; // 1 hora en lugar de 6
    const tiempoTranscurrido = Date.now() - parseInt(ultimaActualizacion);
    return tiempoTranscurrido < TIEMPO_CACHE;
}

// Función modificada para cargar canales
async function cargarCanales() {
    try {
        // Mostrar indicador de carga inicial
        const contenedor = document.getElementById('canales-container');
        contenedor.innerHTML = '<p class="carga-mensaje">Cargando canales...</p>';

        // Intentar cargar desde caché primero
        const canalesCache = localStorage.getItem(CACHE_KEYS.CANALES);
        
        if (canalesCache && esCacheActualizado()) {
            todosLosCanales = JSON.parse(canalesCache);
            inicializarInterfaz();
            return;
        }

        // Cargar canales locales únicamente
        const respuestaLocal = await fetch('../DataBase/canales.json');
        if (!respuestaLocal.ok) {
            throw new Error('No se pudieron cargar los canales locales');
        }
        
        const dataLocal = await respuestaLocal.json();
        todosLosCanales = dataLocal.canales || [];
        
        // Actualizar interfaz con canales locales
        if (todosLosCanales.length > 0) {
            localStorage.setItem(CACHE_KEYS.CANALES, JSON.stringify(todosLosCanales));
            localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
            inicializarInterfaz();
        }

    } catch (error) {
        console.error('Error al cargar los canales:', error);
        const contenedor = document.getElementById('canales-container');
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <p>Error al cargar los canales. Por favor, intenta recargar la página.</p>
                <button onclick="location.reload()" style="
                    padding: 10px 20px;
                    background: var(--primary-color);
                    border: none;
                    border-radius: 5px;
                    color: var(--background-color);
                    cursor: pointer;
                ">Recargar página</button>
            </div>
        `;
    }
}

// Función para inicializar la interfaz
function inicializarInterfaz() {
    if (!todosLosCanales || todosLosCanales.length === 0) {
        const contenedor = document.getElementById('canales-container');
        contenedor.innerHTML = '<p>No hay canales disponibles</p>';
        return;
    }

    crearBotonesCategorias();
    mostrarTodo();
    
    // Reproducir el primer canal automáticamente solo al inicio
    if (todosLosCanales.length > 0 && !canalActual) {
        reproducirCanal(todosLosCanales[0]);
    }

    // Remover mensaje de carga si existe
    const mensajeCarga = document.querySelector('.carga-mensaje');
    if (mensajeCarga) {
        mensajeCarga.remove();
    }
}

// Función para buscar canales
function buscarCanales(query) {
    if (!query) {
        mostrarCanales(todosLosCanales);
        return;
    }

    const queryLower = query.toLowerCase();
    const canalesFiltrados = todosLosCanales.filter(canal => 
        canal.nombre.toLowerCase().includes(queryLower) ||
        canal.categoria.toLowerCase().includes(queryLower)
    );

    mostrarCanales(canalesFiltrados);
}

// Asegurarse de que el DOM esté cargado antes de iniciar
document.addEventListener('DOMContentLoaded', () => {
    gestionarCache();
    cargarCanales();
    
    const buscadorInput = document.querySelector('.buscador-input');
    let timeoutId;

    buscadorInput.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            buscarCanales(e.target.value);
        }, 300);
    });
});

function mostrarCanales(canalesAMostrar) {
    const contenedor = document.querySelector('.canales-scroll');
    const fragment = document.createDocumentFragment();
    
    canalesAMostrar.forEach(canal => {
        const canalElement = document.createElement('div');
        canalElement.className = 'canal-item';
        canalElement.dataset.canalId = canal.id;
        
        canalElement.innerHTML = `
            <img src="${canal.logo}" alt="${canal.nombre}" loading="lazy">
            <div class="canal-info">
                <h4>${canal.nombre}</h4>
                <p>${canal.descripcion || ''}</p>
            </div>
            <button class="favorito-icon ${canalesFavoritos.includes(canal.id) ? 'activo' : ''}" 
                    onclick="event.stopPropagation(); toggleFavorito(${canal.id})">
                <i class="fas fa-heart"></i>
            </button>
        `;
        
        canalElement.onclick = () => reproducirCanal(canal);
        fragment.appendChild(canalElement);
    });
    
    contenedor.innerHTML = '';
    contenedor.appendChild(fragment);
}

function reproducirCanal(canal) {
    canalActual = canal;
    const reproductorIframe = document.getElementById('reproductor-iframe');
    const reproductorHtml5 = document.getElementById('reproductor-html5');

    // Actualizar la información del canal
    document.getElementById('canal-actual-nombre').textContent = canal.nombre;
    document.getElementById('canal-actual-descripcion').textContent = canal.descripcion || '';

    // Detener reproductor HLS anterior si existe
    if (hls) {
        hls.destroy();
        hls = null;
    }

    // Limpiar reproductores
    reproductorIframe.style.display = 'none';
    reproductorHtml5.style.display = 'none';

    // Configurar iframe sin restricciones
    reproductorIframe.removeAttribute('sandbox');
    reproductorIframe.removeAttribute('referrerpolicy');

    if (canal.nombre === "Win Sports +") {
        reproductorIframe.style.display = 'block';
        reproductorIframe.src = canal.url_stream;
    }
    else if (canal.url_stream.includes('embed.sdfgnks') || canal.url_stream.includes('embed.php')) {
        reproductorIframe.style.display = 'block';
        reproductorIframe.src = canal.url_stream;
    }
    else if (canal.url_stream.includes('.m3u8')) {
        reproductorHtml5.style.display = 'block';
        
        if (Hls.isSupported()) {
            hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            hls.loadSource(canal.url_stream);
            hls.attachMedia(reproductorHtml5);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                reproductorHtml5.play().catch(error => {
                    console.error('Error reproduciendo el canal:', error);
                });
            });
        }
    }
    else {
        reproductorIframe.style.display = 'block';
        reproductorIframe.src = canal.url_stream;
    }

    // Actualizar el estado visual de los canales
    const canales = document.querySelectorAll('.canal-item');
    canales.forEach(item => {
        if (item.dataset.canalId === canal.id.toString()) {
            item.classList.add('activo');
        } else {
            item.classList.remove('activo');
        }
    });

    // Asegurarse de que la capa bloqueadora esté activa
    const capaBloqueadora = document.querySelector('.capa-bloqueadora');
    capaBloqueadora.style.display = 'block';
}

function obtenerCategorias() {
    const categorias = new Set();
    todosLosCanales.forEach(canal => {
        if (canal.categoria) {
            categorias.add(canal.categoria);
        }
    });
    categoriasUnicas = Array.from(categorias);
    return categoriasUnicas;
}

function crearBotonesCategorias() {
    // Crear versión móvil (scroll horizontal)
    const categoriasContainer = document.querySelector('.categorias-scroll');
    if (categoriasContainer) {
        categoriasContainer.innerHTML = '';
        obtenerCategorias().forEach(categoria => {
            const btn = document.createElement('button');
            btn.className = 'categoria-btn';
            btn.textContent = categoria;
            btn.onclick = () => filtrarPorCategoria(categoria);
            categoriasContainer.appendChild(btn);
        });
    }

    // Crear versión desktop (dropdown)
    const menuOpciones = document.querySelector('.menu-opciones');
    let dropdownExistente = document.querySelector('.categorias-dropdown');
    
    if (!dropdownExistente) {
        dropdownExistente = document.createElement('div');
        dropdownExistente.className = 'categorias-dropdown';
        menuOpciones.appendChild(dropdownExistente);
    }

    dropdownExistente.innerHTML = '';
    obtenerCategorias().forEach(categoria => {
        const btn = document.createElement('button');
        btn.className = 'categoria-btn';
        btn.textContent = categoria;
        btn.onclick = () => {
            filtrarPorCategoria(categoria);
            toggleCategorias();
        };
        dropdownExistente.appendChild(btn);
    });
}

function mostrarTodo() {
    actualizarBotonesMenu('Todo');
    document.querySelector('.categorias-scroll').style.display = 'none';
    mostrarCanales(todosLosCanales);
}

function mostrarCategorias() {
    actualizarBotonesMenu('Categorías');
    if (window.innerWidth >= 1024) {
        // Versión desktop
        const dropdown = document.querySelector('.categorias-dropdown');
        dropdown.classList.toggle('mostrar');
    } else {
        // Versión móvil
        document.querySelector('.categorias-scroll').style.display = 'flex';
    }
}

function mostrarFavoritos() {
    actualizarBotonesMenu('Favoritos');
    document.querySelector('.categorias-scroll').style.display = 'none';
    const canalesFav = todosLosCanales.filter(canal => 
        canalesFavoritos.includes(canal.id)
    );
    mostrarCanales(canalesFav);
}

function filtrarPorCategoria(categoria) {
    const canalesFiltrados = todosLosCanales
        .filter(canal => canal.categoria === categoria)
        .sort((a, b) => {
            if (a.nombre.startsWith('ESPN') && b.nombre.startsWith('ESPN')) {
                const numA = parseInt(a.nombre.replace('ESPN', '')) || 1;
                const numB = parseInt(b.nombre.replace('ESPN', '')) || 1;
                return numA - numB;
            } else if (a.nombre.startsWith('Fox Sports') && b.nombre.startsWith('Fox Sports')) {
                const numA = parseInt(a.nombre.replace('Fox Sports', '')) || 1;
                const numB = parseInt(b.nombre.replace('Fox Sports', '')) || 1;
                return numA - numB;
            }
            return a.nombre.localeCompare(b.nombre);
        });
    
    mostrarCanales(canalesFiltrados);
    
    // Actualizar botones de categoría en el dropdown
    document.querySelectorAll('.categorias-dropdown .categoria-btn').forEach(btn => {
        btn.classList.toggle('activa', btn.textContent === categoria);
    });
    
    // Actualizar botones de categoría en el scroll móvil
    document.querySelectorAll('.categorias-scroll .categoria-btn').forEach(btn => {
        btn.classList.toggle('activa', btn.textContent === categoria);
    });
}

function actualizarBotonesMenu(opcionActiva) {
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.toggle('activo', btn.textContent === opcionActiva);
    });
}

function toggleFavorito(canalId) {
    const index = canalesFavoritos.indexOf(canalId);
    if (index === -1) {
        canalesFavoritos.push(canalId);
    } else {
        canalesFavoritos.splice(index, 1);
    }
    localStorage.setItem('favoritos', JSON.stringify(canalesFavoritos));
    actualizarIconosFavoritos();
}

function actualizarIconosFavoritos() {
    document.querySelectorAll('.canal-item').forEach(item => {
        const canalId = parseInt(item.dataset.canalId);
        const iconoFav = item.querySelector('.favorito-icon');
        if (iconoFav) {
            iconoFav.classList.toggle('activo', canalesFavoritos.includes(canalId));
        }
    });
}

function cargarCanal(canal) {
    const reproductorIframe = document.querySelector('.reproductor-iframe');
    const infoCanal = document.querySelector('.info-canal-actual');
    
    // Asegurarse de que el iframe esté limpio antes de cargar nuevo contenido
    reproductorIframe.src = '';
    
    setTimeout(() => {
        if (canal.url_stream.includes('hls.html?get=')) {
            // Si es una URL de HLS, usarla directamente
            reproductorIframe.src = canal.url_stream;
        } else if (canal.url_stream.includes('embed.php')) {
            // Si es una URL de embed, usarla directamente
            reproductorIframe.src = canal.url_stream;
        } else {
            // Para otras URLs, crear un reproductor personalizado
            reproductorIframe.src = `https://television-libre.tv/html/hls.html?get=${btoa(canal.url_stream)}`;
        }
        
        // Actualizar información del canal
        infoCanal.innerHTML = `
            <h2>${canal.nombre}</h2>
            <p>${canal.descripcion}</p>
        `;
    }, 100);
}

function toggleCategorias() {
    const dropdown = document.querySelector('.categorias-dropdown');
    dropdown.classList.toggle('mostrar');
}

// Agregar evento para cerrar el dropdown cuando se hace clic fuera
document.addEventListener('click', (e) => {
    if (window.innerWidth >= 1024) {
        const dropdown = document.querySelector('.categorias-dropdown');
        const categoriaBtn = document.querySelector('.menu-btn:nth-child(2)');
        
        if (!dropdown?.contains(e.target) && e.target !== categoriaBtn) {
            dropdown?.classList.remove('mostrar');
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const botonFullscreen = document.getElementById('botonPantallaCompleta');
    const reproductorPrincipal = document.querySelector('.reproductor-principal');
    
    botonFullscreen.addEventListener('click', function() {
        if (!document.fullscreenElement) {
            if (reproductorPrincipal.requestFullscreen) {
                reproductorPrincipal.requestFullscreen();
            } else if (reproductorPrincipal.webkitRequestFullscreen) {
                reproductorPrincipal.webkitRequestFullscreen();
            } else if (reproductorPrincipal.msRequestFullscreen) {
                reproductorPrincipal.msRequestFullscreen();
            }
            botonFullscreen.querySelector('i').classList.replace('fa-expand', 'fa-compress');
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            botonFullscreen.querySelector('i').classList.replace('fa-compress', 'fa-expand');
        }
    });

    document.addEventListener('fullscreenchange', function() {
        reproductorPrincipal.classList.toggle('fullscreen', document.fullscreenElement !== null);
    });
});