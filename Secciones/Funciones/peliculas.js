// Las funciones de Firestore se cargan desde firestore-peliculas-simple.js
// No necesitamos imports para evitar problemas de CORS

// Constantes para el manejo de caché local (mejorado)
const CACHE_VERSION = '2.1'; // Incrementado para nueva versión de cache
const CACHE_KEYS = {
    PELICULAS: 'hrztv_peliculas_firestore_cache',
    ANUNCIOS: 'hrztv_anuncios_firestore_cache',
    TIMESTAMP: 'hrztv_firestore_timestamp',
    VERSION: 'hrztv_firestore_version'
};

// Variables globales
let todasLasPeliculas = [];
let currentSlide = 0;
let announcements = [];
let autoSlideInterval;
let startX;
let currentTranslate = 0;
let isDragging = false;

// Agregar estas variables globales
let touchStartX = 0;
let touchEndX = 0;
let touchStartTime = 0;
let touchEndTime = 0;
let minSwipeDistance = 100;
let maxSwipeTime = 300;
let hasMoved = false;

// Función para manejar el caché local mejorado
function gestionarCacheLocal() {
    const cacheVersion = localStorage.getItem(CACHE_KEYS.VERSION);
    
    // Si la versión del caché es diferente o no existe, limpiar todo el caché
    if (cacheVersion !== CACHE_VERSION) {
        Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
        localStorage.setItem(CACHE_KEYS.VERSION, CACHE_VERSION);
    }
}

// Función para verificar si el caché está actualizado
function esCacheActualizado() {
    const ultimaActualizacion = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (!ultimaActualizacion) return false;
    
    // Verificar si han pasado más de 24 horas desde la última actualización
    const TIEMPO_CACHE = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
    return (Date.now() - parseInt(ultimaActualizacion)) < TIEMPO_CACHE;
}

// Función para cargar contenido con caché mejorado
async function cargarContenidoConCache(tipo) {
    const cacheKey = CACHE_KEYS[tipo.toUpperCase()];
    const contenidoCache = localStorage.getItem(cacheKey);
    
    try {
        // Si hay caché válido, usarlo primero
        if (contenidoCache && esCacheActualizado()) {
            console.log(`⚡ Cargando ${tipo} desde cache (rápido)`);
            const datosCache = JSON.parse(contenidoCache);
            actualizarInterfaz(tipo, datosCache);
            
            // Actualizar en segundo plano solo si es necesario
            actualizarContenidoEnSegundoPlano(tipo);
            return datosCache;
        } else {
            // Si no hay caché o está desactualizado, cargar desde el servidor
            console.log(`🔄 Cargando ${tipo} desde servidor`);
            return await cargarContenidoDesdeServidor(tipo);
        }
    } catch (error) {
        console.error(`Error cargando ${tipo}:`, error);
        // Si hay error, usar caché aunque esté desactualizado
        if (contenidoCache) {
            console.log(`🔄 Usando cache desactualizado para ${tipo}`);
            const datosCache = JSON.parse(contenidoCache);
            actualizarInterfaz(tipo, datosCache);
            return datosCache;
        }
        throw error;
    }
}

// Función para cargar contenido desde el servidor
async function cargarContenidoDesdeServidor(tipo) {
    try {
        let datos;
        
        if (tipo === 'peliculas') {
            // Verificar que las funciones de Firestore estén disponibles
            if (!window.firestorePeliculas) {
                throw new Error('Funciones de Firestore no están disponibles');
            }
            
            // Verificar conexión con Firestore
            const conexionOK = await window.firestorePeliculas.verificarConexionFirestore();
            if (!conexionOK) {
                throw new Error('No se pudo conectar con Firestore');
            }

            // Cargar películas desde Firestore
            const peliculas = await window.firestorePeliculas.cargarPeliculasDesdeFirestore();
            
            if (peliculas && peliculas.length > 0) {
                datos = { peliculas: peliculas.filter(p => p.disponible !== false) };
                console.log(`✅ Cargadas ${datos.peliculas.length} películas desde Firestore`);
            } else {
                throw new Error('No se encontraron películas en Firestore');
            }
        } else if (tipo === 'anuncios') {
            // Para anuncios, usar películas destacadas
            if (window.firestorePeliculas && window.firestorePeliculas.cargarPeliculasDestacadas) {
                const peliculasDestacadas = await window.firestorePeliculas.cargarPeliculasDestacadas();
                datos = { announcements: peliculasDestacadas || todasLasPeliculas.slice(0, 5) };
            } else {
                // Usar primeras 5 películas como fallback
                datos = { announcements: todasLasPeliculas.slice(0, 5) };
            }
        }
        
        // Guardar en caché
        localStorage.setItem(CACHE_KEYS[tipo.toUpperCase()], JSON.stringify(datos));
        localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
        
        // Actualizar interfaz
        actualizarInterfaz(tipo, datos);
        
        return datos;
    } catch (error) {
        console.error(`Error cargando ${tipo} desde Firestore:`, error);
        
        // Respaldo: intentar cargar desde JSON local
        try {
            console.warn(`⚠️ Usando respaldo JSON para ${tipo}`);
            const response = await fetch('../DataBase/peliculas.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const datos = await response.json();
            
            if (tipo === 'anuncios') {
                datos.announcements = datos.peliculas.slice(0, 5);
            }
            
            // Guardar en caché
            localStorage.setItem(CACHE_KEYS[tipo.toUpperCase()], JSON.stringify(datos));
            localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
            
            // Actualizar interfaz
            actualizarInterfaz(tipo, datos);
            
            return datos;
        } catch (backupError) {
            console.error(`Error en respaldo JSON para ${tipo}:`, backupError);
            throw error;
        }
    }
}

// Función para actualizar contenido en segundo plano
async function actualizarContenidoEnSegundoPlano(tipo) {
    try {
        const datosNuevos = await cargarContenidoDesdeServidor(tipo);
        const datosCache = JSON.parse(localStorage.getItem(CACHE_KEYS[tipo.toUpperCase()]));
        
        // Comparar y actualizar solo si hay cambios
        if (JSON.stringify(datosNuevos) !== JSON.stringify(datosCache)) {
            console.log(`🔄 Actualizando ${tipo} en segundo plano - Se encontraron cambios`);
            localStorage.setItem(CACHE_KEYS[tipo.toUpperCase()], JSON.stringify(datosNuevos));
            localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
            actualizarInterfaz(tipo, datosNuevos);
        } else {
            console.log(`✅ ${tipo} está actualizado - No hay cambios`);
        }
    } catch (error) {
        console.error(`Error actualizando ${tipo} en segundo plano:`, error);
    }
}

// Función para actualizar la interfaz según el tipo de contenido
function actualizarInterfaz(tipo, datos) {
    switch (tipo) {
        case 'peliculas':
            todasLasPeliculas = datos.peliculas;
            mostrarPeliculasPorCategorias(todasLasPeliculas);
            // Precargar imágenes en segundo plano
            precargarImagenes(todasLasPeliculas);
            break;
        case 'anuncios':
            announcements = datos.announcements;
            mostrarAnuncios();
            break;
    }
}

// Función para precargar imágenes
function precargarImagenes(peliculas) {
    const imagenes = [];
    
    peliculas.forEach(pelicula => {
        if (pelicula.imagen) {
            const img = new Image();
            img.src = pelicula.imagen;
            imagenes.push(img);
        }
        if (pelicula.miniatura) {
            const img = new Image();
            img.src = pelicula.miniatura;
            imagenes.push(img);
        }
    });
    
    console.log(`📸 Precargando ${imagenes.length} imágenes...`);
}

// Función principal para cargar contenido (reemplaza cargarContenidoConFirestore)
async function cargarContenidoPrincipal() {
    try {
        console.log('🚀 Iniciando carga de películas con cache mejorado...');
        
        // Cargar películas con cache
        await cargarContenidoConCache('peliculas');
        
        // Cargar anuncios con cache
        await cargarContenidoConCache('anuncios');
        
        console.log('✅ Carga completada');
    } catch (error) {
        console.error('💥 Error en carga principal:', error);
        await cargarDesdeRespaldo();
    }
}

// Función de respaldo para cargar desde JSON local o cache
async function cargarDesdeRespaldo() {
    try {
        console.log('🔄 Intentando cargar desde cache local...');
        
        // Intentar cargar desde cache local primero
        const cacheLocal = localStorage.getItem(CACHE_KEYS.PELICULAS);
        if (cacheLocal) {
            const datosCache = JSON.parse(cacheLocal);
            console.log('⚡ Cargado desde cache local');
            
            // Usar el nuevo sistema de actualización de interfaz
            actualizarInterfaz('peliculas', datosCache);
            
            const anunciosCache = localStorage.getItem(CACHE_KEYS.ANUNCIOS);
            if (anunciosCache) {
                const anunciosData = JSON.parse(anunciosCache);
                actualizarInterfaz('anuncios', anunciosData);
            }
            return;
        }

        // Si no hay cache, intentar cargar desde JSON como último recurso
        console.log('📁 Intentando cargar desde JSON local...');
        const response = await fetch('../DataBase/peliculas.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const datos = await response.json();
        if (datos && datos.peliculas) {
            const peliculasData = { peliculas: datos.peliculas.filter(p => p.disponible !== false) };
            console.log(`📄 Cargadas ${peliculasData.peliculas.length} películas desde JSON local`);
            
            // Actualizar interfaz con nuevo sistema
            actualizarInterfaz('peliculas', peliculasData);
            
            // Crear anuncios desde las primeras películas
            const anunciosData = { announcements: peliculasData.peliculas.slice(0, 5) };
            actualizarInterfaz('anuncios', anunciosData);
        }

    } catch (error) {
        console.error('💥 Error en todos los métodos de carga:', error);
        mostrarErrorCarga();
    }
}

// Función para mostrar error de carga
function mostrarErrorCarga() {
    const categoriasWrapper = document.querySelector('.categorias-wrapper');
    if (categoriasWrapper) {
        categoriasWrapper.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #fff;">
                <h2>❌ Error de Conexión</h2>
                <p>No se pudieron cargar las películas. Por favor:</p>
                <ul style="list-style: none; padding: 0;">
                    <li>• Verifica tu conexión a internet</li>
                    <li>• Recarga la página</li>
                    <li>• Asegúrate de que Firestore esté configurado correctamente</li>
                </ul>
                <button onclick="location.reload()" style="
                    background: linear-gradient(45deg, #ff6b35, #f7931e);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 20px;
                ">🔄 Recargar Página</button>
            </div>
        `;
    }
}

// Función para organizar peliculas por categorías (mantenida igual)
function organizarPorCategorias(peliculas) {
    const categorias = {
        'estrenos': { titulo: 'Estrenos', peliculas: [], mantenerOrden: false },
        'mi_lista': { titulo: 'Mi Lista', peliculas: [], mantenerOrden: false },
        'programacion': { titulo: 'Programación', peliculas: [], mantenerOrden: false },
        'accion': { titulo: 'Acción y Mucho Más', peliculas: [], mantenerOrden: false },
        'familiar': { titulo: 'Películas Familiares', peliculas: [], mantenerOrden: false },
        'netflix': { titulo: 'Netflix', peliculas: [], mantenerOrden: false },
        'amazon': { titulo: 'Amazon Prime', peliculas: [], mantenerOrden: false },
        'hbo': { titulo: 'HBO Max', peliculas: [], mantenerOrden: false },
        'disney': { titulo: 'Disney+', peliculas: [], mantenerOrden: false },
        'paramount': { titulo: 'Paramount+', peliculas: [], mantenerOrden: false },
        'apple': { titulo: 'Apple TV+', peliculas: [], mantenerOrden: false },
        'hulu': { titulo: 'Hulu', peliculas: [], mantenerOrden: false },
        'peacock': { titulo: 'Peacock', peliculas: [], mantenerOrden: false },
        'starz': { titulo: 'Starz', peliculas: [], mantenerOrden: false },
        'showtime': { titulo: 'Showtime', peliculas: [], mantenerOrden: false },
        'crunchyroll': { titulo: 'Crunchyroll', peliculas: [], mantenerOrden: false },
        'suspenso': { titulo: 'Suspenso y Drama', peliculas: [], mantenerOrden: false },
        'marvel': { titulo: 'Marvel', peliculas: [], mantenerOrden: false },
        'dc': { titulo: 'DC Comics', peliculas: [], mantenerOrden: false },
        'animacion': { titulo: 'Animación', peliculas: [], mantenerOrden: false },
        'clasicos': { titulo: 'Clásicos', peliculas: [], mantenerOrden: false },
        'cristiana': { titulo: 'Películas Cristianas', peliculas: [], mantenerOrden: false },
        'comedia': { titulo: 'Comedia', peliculas: [], mantenerOrden: false },
        'rapidosyfuriosos': { titulo: 'Rápidos y Furiosos', peliculas: [], mantenerOrden: false },
        'anime': { titulo: 'Anime', peliculas: [], mantenerOrden: false },
        'ciencia_ficcion': { titulo: 'Ciencia Ficcion', peliculas: [], mantenerOrden: false },
        'terror': { titulo: 'Terror', peliculas: [], mantenerOrden: false },
        'navidad': { titulo: 'Películas de Navidad', peliculas: [], mantenerOrden: false },
        'drama': { titulo: 'Drama', peliculas: [], mantenerOrden: false },
        'deportes': { titulo: 'Deportes', peliculas: [], mantenerOrden: false },
        'reality_show': { titulo: 'Reality Show', peliculas: [], mantenerOrden: false },
        'talk_show': { titulo: 'Talk Show', peliculas: [], mantenerOrden: false },
        'noticias': { titulo: 'Noticias', peliculas: [], mantenerOrden: false },
        'infantil': { titulo: 'Infantil', peliculas: [], mantenerOrden: false },
        'educativo': { titulo: 'Educativo', peliculas: [], mantenerOrden: false },
        'cocina': { titulo: 'Cocina', peliculas: [], mantenerOrden: false },
        'viajes': { titulo: 'Viajes', peliculas: [], mantenerOrden: false },
        'naturaleza': { titulo: 'Naturaleza', peliculas: [], mantenerOrden: false },
        'tecnologia': { titulo: 'Tecnología', peliculas: [], mantenerOrden: false },
    };

    // Función para mezclar array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Agregar películas a categorías
    peliculas.forEach(pelicula => {
        // Agregar a la categoría Estrenos si tiene la propiedad estreno
        if (pelicula.estreno) {
            categorias['estrenos'].peliculas.push(pelicula);
        }
        
        if (Array.isArray(pelicula.genero)) {
            pelicula.genero.forEach(gen => {
                const generoLower = gen.toLowerCase();
                if (categorias[generoLower]) {
                    categorias[generoLower].peliculas.push(pelicula);
                }
            });
        } else if (typeof pelicula.genero === 'string') {
            const generoLower = pelicula.genero.toLowerCase();
            if (categorias[generoLower]) {
                categorias[generoLower].peliculas.push(pelicula);
            }
        }
        
        if (pelicula.plataforma) {
            const plataformaLower = pelicula.plataforma.toLowerCase();
            if (categorias[plataformaLower]) {
                categorias[plataformaLower].peliculas.push(pelicula);
            }
        }
    });

    // Ordenar películas en cada categoría (nuevas primero)
    for (const categoria of Object.values(categorias)) {
        const nuevas = categoria.peliculas.filter(p => p.nuevo);
        const noNuevas = categoria.peliculas.filter(p => !p.nuevo);

        if (!categoria.mantenerOrden) {
            shuffleArray(noNuevas);
        }

        categoria.peliculas = [...nuevas, ...noNuevas];
    }

    return categorias;
}

// Función para mostrar peliculas por categorías
function mostrarPeliculasPorCategorias(peliculas) {
    const categoriasWrapper = document.querySelector('.categorias-wrapper');
    if (!categoriasWrapper) return;

    const logosCategoria = {
        'netflix': ['../logos/1.jpeg'],
        'amazon': ['../logos/2.jpeg'],
        'animacion': ['../logos/3.jpeg'],
        'marvel': ['../logos/7.png'],
        'dc': ['../logos/4.jpeg'],
        'hbo': ['https://cdn.teletime.com.br/wp-content/uploads/2021/03/hbo-max-logo.jpg'],
        'disney': ['../logos/3.jpeg'],
        'paramount': ['https://www.paramountplus.com/assets/pplus/PPlus_Logo_1200x630_BLUE.png'],
        'apple': ['../logos/apple-tv.png'],
        'hulu': ['../logos/hulu.png'],
        'peacock': ['../logos/peacock.png'],
        'starz': ['../logos/starz.png'],
        'showtime': ['../logos/showtime.png'],
        'crunchyroll': ['../logos/crunchyroll.png'],
        'estrenos': ['https://cdnsnte1.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/02/20120506/boton_nuevo_paz.png'],
    };

    categoriasWrapper.innerHTML = '';
    
    // Mostrar Mi Lista de Peliculas primero
    const miListaPeliculas = JSON.parse(localStorage.getItem('miListaPeliculas') || '[]');
    
    if (miListaPeliculas.length > 0) {
        const seccionMiLista = document.createElement('div');
        seccionMiLista.className = 'categoria-seccion';
        
        seccionMiLista.innerHTML = `
            <h2 class="categoria-titulo">Mi Lista <i class="fas fa-heart" style="color: #00ffff;"></i></h2>
            <div class="categoria-contenedor">
                ${miListaPeliculas.map(pelicula => `
                    <div class="movie-card" data-pelicula='${JSON.stringify(pelicula)}'>
                        ${pelicula.nuevo ? `<div class="badge">Recién Agregado</div>` : (pelicula.badge && pelicula.badge !== 'nuevo' ? `<div class="badge">${pelicula.badge}</div>` : '')}
                        <img src="${pelicula.imagen}" alt="${pelicula.titulo}">
                        <div class="movie-info">
                            <h3>${pelicula.titulo}</h3>
                            <p>${pelicula.año || ''}</p>
                        </div>  
                    </div>
                `).join('')}
            </div>
            <button class="nav-arrow prev"><i class="fas fa-chevron-left"></i></button>
            <button class="nav-arrow next"><i class="fas fa-chevron-right"></i></button>
        `;
        
        categoriasWrapper.appendChild(seccionMiLista);

        // Agregar event listeners a las tarjetas de Mi Lista
        const miListaCards = seccionMiLista.querySelectorAll('.movie-card');
        miListaCards.forEach(card => {
            card.addEventListener('click', () => {
                try {
                    const peliculaData = JSON.parse(card.getAttribute('data-pelicula'));
                    abrirPelicula(peliculaData);
                } catch (error) {
                    console.error('Error al procesar pelicula de Mi Lista:', error);
                }
            });
        });
    }
    
    const categorias = organizarPorCategorias(peliculas);

    for (const [key, categoria] of Object.entries(categorias)) {
        if (categoria.peliculas.length > 0) {
            const seccion = document.createElement('div');
            seccion.className = 'categoria-seccion';
            
            const logosHTML = logosCategoria[key] ? 
                logosCategoria[key].map(logo => 
                    `<img src="${logo}" alt="${categoria.titulo} logo" class="categoria-logo">`
                ).join('') : '';
            
            seccion.innerHTML = `
                <h2 class="categoria-titulo">
                    ${categoria.titulo}
                    <div class="logos-container">
                        ${logosHTML}
                    </div>
                </h2>
                <div class="categoria-contenedor">
                    ${categoria.peliculas.map(pelicula => `
                        <div class="movie-card" data-pelicula='${JSON.stringify(pelicula)}'>
                            ${pelicula.nuevo ? `<div class="badge">Recién Agregado</div>` : (pelicula.badge && pelicula.badge !== 'nuevo' ? `<div class="badge">${pelicula.badge}</div>` : '')}
                            <img src="${pelicula.imagen}" alt="${pelicula.titulo}">
                            <div class="movie-info">
                                <h3>${pelicula.titulo}</h3>
                                <p>${pelicula.año || ''}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="nav-arrow prev"><i class="fas fa-chevron-left"></i></button>
                <button class="nav-arrow next"><i class="fas fa-chevron-right"></i></button>
            `;
            
            categoriasWrapper.appendChild(seccion);
        }
    }

    // Agregar event listeners a todas las movie-cards
    document.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const peliculaData = card.getAttribute('data-pelicula');
            abrirPelicula(peliculaData);
        });

    });

    // Agregar listener para actualizar la interfaz cuando cambie Mi Lista
    window.addEventListener('miListaPeliculasActualizada', () => {
        mostrarPeliculasPorCategorias(todasLasPeliculas);
    });

    // Configurar las flechas de navegación después de crear las secciones
    setupNavArrows();
}

// Función para obtener peliculas aleatorias para los posters  
function obtenerPeliculasAleatorias(peliculas, cantidad) {
    const peliculasDisponibles = peliculas.filter(p => p.disponible);
    const peliculasAleatorias = [];
    const copiasPeliculas = [...peliculasDisponibles];
    
    for (let i = 0; i < cantidad && copiasPeliculas.length > 0; i++) {
        const indiceAleatorio = Math.floor(Math.random() * copiasPeliculas.length);
        peliculasAleatorias.push(copiasPeliculas[indiceAleatorio]);
        copiasPeliculas.splice(indiceAleatorio, 1);
    }
    
    return peliculasAleatorias;
}

// Modificar la función mostrarAnuncios
function mostrarAnuncios() {
    const container = document.getElementById('announcementsContainer');
    container.innerHTML = '';

    const postersAleatorios = obtenerPeliculasAleatorias(todasLasPeliculas, 5);
    const esPC = window.innerWidth > 768;

    postersAleatorios.forEach((pelicula, index) => {
        const slide = document.createElement('div');
        slide.className = 'announcement-slide';
        
        const trailerSrc = esPC && pelicula.trailer ? 
            `${pelicula.trailer}?autoplay=0&mute=0&controls=0&showinfo=0&rel=0&loop=1&playlist=${pelicula.trailer.split('embed/')[1]}&enablejsapi=1&disablekb=1&modestbranding=1&iv_load_policy=3` 
            : '';

        const contenidoMedia = esPC && pelicula.trailer ? `
            <iframe 
                id="trailerFrame_${pelicula.id}"
                src="${trailerSrc}"
                class="announcement-trailer"
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                style="pointer-events: none;"
                allowfullscreen>
            </iframe>
            <button class="sound-toggle" onclick="toggleSound(${pelicula.id})" style="z-index: 3;">
                <i class="fas fa-volume-up"></i>
            </button>
        ` : `
            <img src="${pelicula.imagen}" alt="${pelicula.titulo}" class="announcement-image">
        `;

        const miLista = JSON.parse(localStorage.getItem('miListaPeliculas') || '[]');
        const estaEnMiLista = miLista.some(p => p.id === pelicula.id);
        
        const botonVerAhoraHTML = `
            <button class="ver-ahora-btn" data-pelicula='${JSON.stringify(pelicula)}' onclick="abrirPelicula(this.getAttribute('data-pelicula'))">
                <i class="fas fa-play"></i> Reproducir
            </button>
        `;
        
        const botonMiListaHTML = `
            <button class="mi-lista-btn ${estaEnMiLista ? 'en-mi-lista' : ''}" 
                    data-pelicula='${JSON.stringify(pelicula)}' 
                    onclick="toggleMiLista(this)">
                <i class="fas ${estaEnMiLista ? 'fa-check' : 'fa-plus'}"></i>
                Mi lista
            </button>
        `;

        slide.innerHTML = `
            ${contenidoMedia}
            <div class="announcement-content">
                <div class="content-main">
                    <div class="info-container">
                        <h2 class="announcement-title">${pelicula.titulo}</h2>
                        <p class="announcement-description">${pelicula.descripcion || 'Una emocionante pelicula que te mantendrá al borde de tu asiento.'}</p>
                    </div>
                </div>
                <div class="announcement-info">
                    ${botonVerAhoraHTML}
                    ${botonMiListaHTML}
                </div>
            </div>
        `;
        container.appendChild(slide);
        
        if (index === 0 && esPC && pelicula.trailer) {
            setTimeout(() => {
                const iframe = document.getElementById(`trailerFrame_${pelicula.id}`);
                iframe.src = iframe.src.replace('autoplay=0', 'autoplay=1');
            }, 1000);
        }
    });
    
    updateSlidePosition();
}

// Modificar la función updateSlidePosition
function updateSlidePosition() {
    const container = document.getElementById('announcementsContainer');
    if (!container) return;

    const slides = document.querySelectorAll('.announcement-slide');
    
    slides.forEach((slide, index) => {
        const iframe = slide.querySelector('iframe');
        if (iframe) {
            if (index === currentSlide) {
                // Activar solo el video del slide actual
                const newSrc = iframe.src
                    .replace('autoplay=0', 'autoplay=1')
                    .replace('mute=1', 'mute=0');
                if (iframe.src !== newSrc) {
                    iframe.src = newSrc;
                }
            } else {
                // Detener completamente los otros videos
                const baseUrl = iframe.src.split('?')[0];
                iframe.src = `${baseUrl}?autoplay=0&mute=1&controls=0&showinfo=0&rel=0&loop=1&enablejsapi=1&disablekb=1&modestbranding=1&iv_load_policy=3`;
            }
        }
        slide.classList.toggle('active', index === currentSlide);
    });
    
    container.style.transform = `translateX(-${currentSlide * 100}%)`;
}

function startAutoSlide() {
    stopAutoSlide(); // Detener el intervalo existente
    
    const esPC = window.innerWidth > 768;
    const intervalo = esPC ? 60000 : 10000; // 60s para PC, 10s para móvil
    
    // Asegurarse de que el carrusel existe
    const container = document.getElementById('announcementsContainer');
    if (!container) return;
    
    autoSlideInterval = setInterval(() => {
        const slides = document.querySelectorAll('.announcement-slide');
        if (!slides.length) return;
        
        currentSlide = (currentSlide + 1) % slides.length;
        
        // Aplicar la transición suave
        container.style.transition = 'transform 0.5s ease';
        updateSlidePosition();
    }, intervalo);
}

function stopAutoSlide() {
    if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
    }
}

// Modificar la función nextSlide
function nextSlide() {
    const slides = document.querySelectorAll('.announcement-slide');
    
    // Detener el video actual antes de cambiar
    const currentIframe = slides[currentSlide].querySelector('iframe');
    if (currentIframe) {
        const baseUrl = currentIframe.src.split('?')[0];
        currentIframe.src = `${baseUrl}?autoplay=0&mute=1&controls=0&showinfo=0&rel=0&loop=1&enablejsapi=1&disablekb=1&modestbranding=1&iv_load_policy=3`;
    }
    
    currentSlide = (currentSlide + 1) % slides.length;
    updateSlidePosition();
}

// Modificar la función goToSlide
function goToSlide(index) {
    const slides = document.querySelectorAll('.announcement-slide');
    
    // Detener el video actual antes de cambiar
    const currentIframe = slides[currentSlide].querySelector('iframe');
    if (currentIframe) {
        const baseUrl = currentIframe.src.split('?')[0];
        currentIframe.src = `${baseUrl}?autoplay=0&mute=1&controls=0&showinfo=0&rel=0&loop=1&enablejsapi=1&disablekb=1&modestbranding=1&iv_load_policy=3`;
    }
    
    currentSlide = index;
    updateSlidePosition();
}

// Función para ver pelicula
function verPelicula(peliculaId) {
    fetch('../DataBase/peliculas.json')
        .then(response => response.json())
        .then(data => {
            const pelicula = data.peliculas.find(p => p.id === peliculaId);
            if (pelicula) {
                localStorage.setItem('peliculaSeleccionada', JSON.stringify(pelicula));
                window.location.href = 'movie.html';
            }
        })
        .catch(error => console.error('Error:', error));
}

// Función para limpiar cache manualmente
function limpiarCacheManualmente() {
    Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
    console.log('🧹 Cache limpiado manualmente');
    location.reload(); // Recargar página para obtener datos frescos
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const categoriasWrapper = document.querySelector('.categorias-wrapper');
    if (categoriasWrapper) {
        categoriasWrapper.style.display = 'block';
    }
    
    gestionarCacheLocal();
    cargarContenidoPrincipal(); // Cambiado a cargarContenidoPrincipal
    
    setupCarouselTouch();
    handleScrollAudio();
});

// Búsqueda
document.getElementById('search-input').addEventListener('input', (e) => {
    searchPeliculas(e.target.value);
});

// Efecto de scroll en el header
window.addEventListener('scroll', function() {
    const header = document.querySelector('.top-header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Agregar el código para el manejo del buscador en el header
const searchToggle = document.getElementById('searchToggle');
const searchClose = document.getElementById('searchClose');
const headerSearch = document.getElementById('headerSearch');
const searchInput = document.getElementById('search-input');

// Función para limpiar y cerrar la búsqueda
function limpiarYCerrarBusqueda() {
    headerSearch.classList.remove('active');
    searchInput.value = ''; // Limpiar el input
    document.getElementById('resultadosBusqueda').style.display = 'none';
    mostrarSeriesPorCategorias(todasLasSeries);
}

// Event listener para el botón de cerrar
searchClose.addEventListener('click', limpiarYCerrarBusqueda);

// Event listener para el botón de abrir búsqueda
searchToggle.addEventListener('click', () => {
    headerSearch.classList.add('active');
    searchInput.focus();
});

// Event listener para la tecla Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        limpiarYCerrarBusqueda();
    }
});
// Carousel Touch  encargadao de la barra de anuncios
function setupCarouselTouch() {
    const container = document.getElementById('announcementsContainer');
    if (!container) return;
    
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartTime = new Date().getTime();
        hasMoved = false; // Reiniciar el indicador de movimiento
        stopAutoSlide();
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        touchEndX = e.touches[0].clientX;
        // Marcar que hubo movimiento solo si el desplazamiento es significativo
        if (Math.abs(touchEndX - touchStartX) > 10) {
            hasMoved = true;
            e.preventDefault();
        }
    }, { passive: false });

    container.addEventListener('touchend', () => {
        touchEndTime = new Date().getTime();
        // Solo procesar el swipe si realmente hubo movimiento
        if (hasMoved) {
            handleSwipe();
        }
        startAutoSlide();
    });
}

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const swipeTime = touchEndTime - touchStartTime;
    
    // Solo procesar el swipe si cumple con todos los criterios
    if (Math.abs(swipeDistance) > minSwipeDistance && 
        swipeTime < maxSwipeTime && 
        hasMoved) { // Agregar verificación de movimiento
        
        const slides = document.querySelectorAll('.announcement-slide');
        if (swipeDistance > 0) {
            // Swipe derecha - slide anterior
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        } else {
            // Swipe izquierda - siguiente slide
            currentSlide = (currentSlide + 1) % slides.length;
        }
        
        const container = document.getElementById('announcementsContainer');
        if (container) {
            container.style.transition = 'transform 0.3s ease';
            updateSlidePosition();
        }
    }
}

// Función mejorada para el scroll con mouse
function enableDragScroll() {
    const sliders = document.querySelectorAll('.categoria-contenedor');
    
    sliders.forEach(slider => {
        let isDown = false;
        let startX;
        let startY;
        let scrollLeft;
        let isHorizontalScroll = false;

        function startDragging(e) {
            isDown = true;
            slider.style.scrollBehavior = 'auto';
            slider.style.cursor = 'grabbing';
            
            startX = e.type === 'mousedown' ? e.pageX : e.touches[0].pageX;
            startY = e.type === 'mousedown' ? e.pageY : e.touches[0].pageY;
            scrollLeft = slider.scrollLeft;
        }

        function stopDragging() {
            isDown = false;
            isHorizontalScroll = false;
            slider.style.cursor = 'grab';
            slider.style.scrollBehavior = 'smooth';
        }
        
        function drag(e) {
            if (!isDown) return;

            const x = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX;
            const y = e.type === 'mousemove' ? e.pageY : e.touches[0].pageY;
            
            const deltaX = Math.abs(x - startX);
            const deltaY = Math.abs(y - startY);

            // Determinar dirección del scroll
            if (!isHorizontalScroll) {
                if (deltaX > deltaY && deltaX > 5) {
                    isHorizontalScroll = true;
                    e.preventDefault();
                } else if (deltaY > deltaX && deltaY > 5) {
                    isDown = false;
        return;
                }
            }

            if (isHorizontalScroll) {
                e.preventDefault();
                const walk = (x - startX) * 1.5; // Multiplicador de velocidad
                slider.scrollLeft = scrollLeft - walk;
            }
        }

        // Event Listeners
        slider.addEventListener('mousedown', startDragging);
        slider.addEventListener('mousemove', drag);
        slider.addEventListener('mouseup', stopDragging);
        slider.addEventListener('mouseleave', stopDragging);
        
        // Touch events
        slider.addEventListener('touchstart', startDragging, { passive: true });
        slider.addEventListener('touchmove', drag, { passive: false });
        slider.addEventListener('touchend', stopDragging);
    });
}

// Función para crear y manejar las flechas de navegación
function setupNavArrows() {
    const secciones = document.querySelectorAll('.categoria-seccion');
    
    secciones.forEach(seccion => {
        const contenedor = seccion.querySelector('.categoria-contenedor');
        const prevBtn = document.createElement('button');
        const nextBtn = document.createElement('button');
        
        prevBtn.className = 'nav-arrow prev';
        nextBtn.className = 'nav-arrow next';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        
        seccion.appendChild(prevBtn);
        seccion.appendChild(nextBtn);

        // Mostrar/ocultar flechas según la posición del scroll
        const updateArrowsVisibility = () => {
            const isScrollable = contenedor.scrollWidth > contenedor.clientWidth;
            const isAtStart = contenedor.scrollLeft <= 0;
            const isAtEnd = contenedor.scrollLeft >= contenedor.scrollWidth - contenedor.clientWidth;
         
            console.log(isScrollable, isAtStart, isAtEnd);
            if (isScrollable) {
                prevBtn.style.display = isAtStart ? 'none' : 'block';
                nextBtn.style.display = isAtEnd ? 'none' : 'block';
            } else {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
        };

        // Función de scroll más suave y lento
        const scroll = (direction) => {
            const scrollAmount = contenedor.clientWidth * 0.25; // Reducido a 25% del ancho visible
            const targetScroll = contenedor.scrollLeft + (direction === 'prev' ? -scrollAmount : scrollAmount);
            
            contenedor.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
        };

        // Event listeners
        prevBtn.addEventListener('click', () => scroll('prev'));
        nextBtn.addEventListener('click', () => scroll('next'));
        contenedor.addEventListener('scroll', updateArrowsVisibility);
        
        // Observar cambios en el contenedor
        const resizeObserver = new ResizeObserver(updateArrowsVisibility);
        resizeObserver.observe(contenedor);

        // Verificar visibilidad inicial
        updateArrowsVisibility();
    });
}

// Carousel Touch encargadao de la barra de anuncios    
function cargarCategorias() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = ''; // Limpiar contenido existente
    
    // Cargar Mi Lista de Series primero
    const miListaPeliculas = JSON.parse(localStorage.getItem('miListaPeliculas') || '[]');
    
    if (miListaPeliculas.length > 0) {
        const miListaHTML = `
        <div class="categoria-seccion">
                <h2 class="categoria-titulo">Mi Lista de Peliculas <i class="fas fa-heart" style="color: #00ffff;"></i></h2>
                <div class="categoria-contenedor">
                    ${miListaPeliculas.map(pelicula => `
                        <div class="movie-card" data-pelicula='${JSON.stringify(pelicula)}'>
                            ${pelicula.nuevo ? `<div class="badge">Recién Agregado</div>` : (pelicula.badge && pelicula.badge !== 'nuevo' ? `<div class="badge">${pelicula.badge}</div>` : '')}
                            <img src="${pelicula.imagen}" alt="${pelicula.titulo}">
                            <div class="movie-info">
                                <h3>${pelicula.titulo}</h3>
                                <p>${pelicula.año || ''}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="nav-arrow prev"><i class="fas fa-chevron-left"></i></button>
                <button class="nav-arrow next"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;
        mainContent.insertAdjacentHTML('beforeend', miListaHTML);
    }

}

// Función enableDragScroll eliminada - ya existe una versión anterior

// Escuchar cambios en Mi Lista de Series
window.addEventListener('miListaPeliculasActualizada', () => {
    cargarCategorias();
});

// Recargar categorías cuando se actualiza Mi Lista de Series
window.addEventListener('storage', function(e) {
    if (e.key === 'miListaPeliculas') {
        console.log("Actualizando Mi Lista de Peliculas");
        mostrarPeliculasPorCategorias(todasLasPeliculas);
    }
});

// Agregar esta nueva función para manejar la apertura de peliculas
function abrirPelicula(peliculaData) {
    try {
        let pelicula;
        
        if (typeof peliculaData === 'string') {
            try {
                pelicula = JSON.parse(peliculaData);
            } catch {
                console.error('Error al parsear datos de película');
                return;
            }
        } else if (typeof peliculaData === 'number') {
            pelicula = todasLasPeliculas.find(p => p.id === peliculaData);
        } else {
            pelicula = peliculaData;
        }

        if (!pelicula) {
            console.error('No se encontraron datos de la película');
            return;
        }

        if (!pelicula.id || !pelicula.titulo) {
            console.error('Datos de película incompletos');
            return;
        }

        localStorage.setItem('peliculaSeleccionada', JSON.stringify(pelicula));
        window.location.href = 'movie.html';
    } catch (error) {
        console.error('Error al abrir película:', error);
    }
}

 // Función de búsqueda optimizada con caché
async function searchPeliculas(query) {
    const announcementsCarousel = document.querySelector('.announcements-carousel');
    
    // Si no hay búsqueda, mostrar todo normalmente
    if (!query.trim()) {
        mostrarPeliculasPorCategorias(todasLasPeliculas);
        if (announcementsCarousel) {
            announcementsCarousel.style.display = 'block';
        }
        return;
    }

    try {
        const busqueda = query.toLowerCase().trim();
        
        // Buscar primero en los datos locales (más rápido)
        let peliculasFiltradas = todasLasPeliculas.filter(pelicula => 
            pelicula.titulo.toLowerCase().includes(busqueda) ||
            (pelicula.genero && (
                Array.isArray(pelicula.genero) 
                    ? pelicula.genero.some(g => g.toLowerCase().includes(busqueda))
                    : pelicula.genero.toLowerCase().includes(busqueda)
            ))
        );

        // Solo usar Firestore si no hay datos locales o si la búsqueda local está vacía
        if (peliculasFiltradas.length === 0 && window.firestorePeliculas && window.firestorePeliculas.buscarPeliculasFirestore) {
            try {
                console.log('🔍 Buscando en Firestore...');
                peliculasFiltradas = await window.firestorePeliculas.buscarPeliculasFirestore(busqueda);
            } catch (error) {
                console.warn('Error buscando en Firestore:', error);
            }
        }

        // Ocultar el carrusel durante la búsqueda en todas las plataformas
        if (announcementsCarousel) {
            announcementsCarousel.style.display = 'none';
        }

        // Mostrar resultados directamente en las categorías
        mostrarPeliculasPorCategorias(peliculasFiltradas);
        
    } catch (error) {
        console.error('Error en búsqueda:', error);
        // Mostrar mensaje de error o fallback
        mostrarPeliculasPorCategorias([]);
    }
}

// Función setupBuscador optimizada con debounce mejorado
function setupBuscador() {
    const searchInput = document.getElementById('search-input');
    const headerSearch = document.getElementById('headerSearch');
    const announcementsCarousel = document.querySelector('.announcements-carousel');

    // Agregar debounce optimizado para mejorar rendimiento
    let timeoutId;
    let lastQuery = '';
    
    searchInput.addEventListener('input', (e) => {
        const currentQuery = e.target.value;
        
        // Si es la misma búsqueda, no hacer nada
        if (currentQuery === lastQuery) return;
        
        clearTimeout(timeoutId);
        
        // Si el campo está vacío, mostrar todo inmediatamente
        if (!currentQuery.trim()) {
            if (announcementsCarousel) {
                announcementsCarousel.style.display = 'block';
            }
            mostrarPeliculasPorCategorias(todasLasPeliculas);
            lastQuery = currentQuery;
            return;
        }
        
        // Debounce para búsquedas
        timeoutId = setTimeout(async () => {
            await searchPeliculas(currentQuery);
            lastQuery = currentQuery;
        }, 200); // Reducido a 200ms para mejor respuesta
    });

    // Función para limpiar búsqueda
    function limpiarBusqueda() {
        headerSearch.classList.remove('active');
        searchInput.value = '';
        lastQuery = '';
        if (announcementsCarousel) {
            announcementsCarousel.style.display = 'block';
        }
        mostrarPeliculasPorCategorias(todasLasPeliculas);
    }

    // Agregar manejo de la tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            limpiarBusqueda();
        }
    });

    // Restaurar el carrusel cuando se borra la búsqueda
    searchInput.addEventListener('search', () => {
        if (!searchInput.value) {
            limpiarBusqueda();
        }
    });
}

// Agregar estilos CSS para el scroll con mouse
function agregarEstilosScroll() {
    const styles = `
        .categoria-contenedor {
            -webkit-overflow-scrolling: touch;
            overflow-x: auto;
            overflow-y: hidden;
            white-space: nowrap;
            padding: 5px 0;
            gap: 8px;
            scrollbar-width: none;
            -ms-overflow-style: none;
            cursor: grab;
            scroll-behavior: smooth;
            scroll-snap-type: x proximity;
        }

        .categoria-contenedor::-webkit-scrollbar {
            display: none;
        }

        .categoria-contenedor .movie-card {
            user-select: none;
            -webkit-user-select: none;
            scroll-snap-align: start;
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Inicialización optimizada para Firestore
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Iniciando HRZ TV con sistema de cache mejorado...');
    
    // Configurar interfaz básica
    setupBuscador();
    agregarEstilosScroll();
    enableDragScroll();
    setupCarouselTouch();
    handleScrollAudio();
    
    // Configurar botones de búsqueda
    const searchToggle = document.getElementById('searchToggle');
    const searchClose = document.getElementById('searchClose');
    const headerSearch = document.getElementById('headerSearch');
    const searchInput = document.getElementById('search-input');

    if (searchToggle && headerSearch && searchClose && searchInput) {
        searchToggle.addEventListener('click', () => {
            headerSearch.classList.add('active');
            searchInput.focus();
        });

        searchClose.addEventListener('click', () => {
            headerSearch.classList.remove('active');
            searchInput.value = '';
            searchPeliculas(''); // Limpiar búsqueda
        });
    }
    
    // Reducir delay para carga más rápida
    setTimeout(async () => {
        try {
            console.log('⏳ Cargando contenido...');
            await cargarContenidoPrincipal();
            console.log('✅ HRZ TV cargado completamente con cache optimizado');
        } catch (error) {
            console.error('Error en la inicialización:', error);
        }
    }, 500); // Reducido a 500ms para carga más rápida
});

// Carousel Touch encargadao de la barra de anuncios    
function mostrarResultadosBusqueda(resultados, contenedor) {
    if (resultados.length === 0) {
        contenedor.innerHTML = '<div class="resultado-item">No se encontraron resultados</div>';
    } else {
        contenedor.innerHTML = resultados.map(pelicula => `
            <div class="resultado-item" onclick="abrirPelicula(${pelicula.id})">
                <img src="${pelicula.imagen}" alt="${pelicula.titulo}" class="resultado-imagen">
                <div class="resultado-info">
                    <div class="resultado-titulo">${pelicula.titulo}</div>
                    <div class="resultado-instructor">
                        ${pelicula.año || 'Año no disponible'} • 
                        <span style="color: var(--primary-color)">${
                            Array.isArray(pelicula.genero) 
                                ? pelicula.genero.join(', ') 
                                : pelicula.genero || 'Género no especificado'
                        }</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    contenedor.style.display = 'block';
}

// Agregar función para controlar el sonido
function toggleSound(peliculaId) {
    const iframe = document.getElementById(`trailerFrame_${peliculaId}`);
    const button = document.querySelector(`.sound-toggle`);
    const icon = button.querySelector('i');
    
    // Crear nueva URL para el iframe
    let currentSrc = iframe.src;
    let isMuted = currentSrc.includes('mute=1');
    
    if (isMuted) {
        // Activar sonido
        iframe.src = currentSrc.replace('mute=1', 'mute=0');
        icon.className = 'fas fa-volume-up';
    } else {
        // Silenciar
        iframe.src = currentSrc.replace('mute=0', 'mute=1');
        icon.className = 'fas fa-volume-mute';
    }
}

// Modificar la función iniciarReproduccionAutomatica
function iniciarReproduccionAutomatica() {
    if (window.innerWidth <= 768) return; // Solo para PC
    
    const slides = document.querySelectorAll('.announcement-slide');
    slides.forEach((slide, index) => {
        const iframe = slide.querySelector('.announcement-trailer');
        if (iframe && index === currentSlide) {
            // Solo activar el video del slide actual
            iframe.src = iframe.src.replace('autoplay=0', 'autoplay=1');
        }
    });
}

// Agregar función para manejar el scroll y el audio
function handleScrollAudio() {
    const carousel = document.querySelector('.announcements-carousel');
    if (!carousel) return;

    // Variable para almacenar el estado anterior del audio
    let prevAudioState = new Map();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const iframes = document.querySelectorAll('.announcement-trailer');
            iframes.forEach(iframe => {
                if (!entry.isIntersecting) {
                    // Guardar estado actual y silenciar
                    let currentSrc = iframe.src;
                    prevAudioState.set(iframe.id, currentSrc.includes('mute=0'));
                    if (currentSrc.includes('mute=0')) {
                        iframe.src = currentSrc.replace('mute=0', 'mute=1');
                        const soundButton = iframe.parentElement.querySelector('.sound-toggle i');
                        if (soundButton) {
                            soundButton.className = 'fas fa-volume-mute';
                        }
                    }
                } else {
                    // Restaurar estado anterior si estaba con sonido
                    let currentSrc = iframe.src;
                    if (prevAudioState.get(iframe.id)) {
                        iframe.src = currentSrc.replace('mute=1', 'mute=0');
                        const soundButton = iframe.parentElement.querySelector('.sound-toggle i');
                        if (soundButton) {
                            soundButton.className = 'fas fa-volume-up';
                        }
                    }
                }
            });
        });
    }, {
        threshold: 0.5 // Trigger cuando el 50% del carrusel está visible/invisible
    });

    observer.observe(carousel);
}

// Agregar listener para cambios de tamaño de ventana
window.addEventListener('resize', () => {
    // Reiniciar el intervalo cuando cambie el tamaño de la ventana
    if (autoSlideInterval) {
        startAutoSlide();
    }
});

// Agregar la función toggleMiLista
function toggleMiLista(boton) {
    try {
        let peliculaData;
        const peliculaAttr = boton.getAttribute('data-pelicula');
        
        // Verificar si es un ID o un objeto JSON
        if (!isNaN(peliculaAttr)) {
            // Si es un ID, buscar la película en todasLasPeliculas
            peliculaData = todasLasPeliculas.find(p => p.id === parseInt(peliculaAttr));
        } else {
            // Si es un objeto JSON, parsearlo
            try {
                peliculaData = JSON.parse(peliculaAttr);
            } catch {
                console.error('Error al parsear datos de película');
                return;
            }
        }

        if (!peliculaData) {
            console.error('No se encontraron datos de la película');
            return;
        }

        const miLista = JSON.parse(localStorage.getItem('miListaPeliculas') || '[]');
        const indice = miLista.findIndex(p => p.id === peliculaData.id);
        
        if (indice === -1) {
            // Agregar al principio de mi lista usando unshift
            miLista.unshift(peliculaData);
            boton.innerHTML = '<i class="fas fa-check"></i> Mi lista';
            boton.classList.add('en-mi-lista');
        } else {
            // Quitar de mi lista
            miLista.splice(indice, 1);
            boton.innerHTML = '<i class="fas fa-plus"></i> Mi lista';
            boton.classList.remove('en-mi-lista');
        }
        
        localStorage.setItem('miListaPeliculas', JSON.stringify(miLista));
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('miListaPeliculasActualizada'));
    } catch (error) {
        console.error('Error en toggleMiLista:', error);
    }
}

// Exponer funciones para depuración
window.limpiarCachePeliculas = limpiarCacheManualmente;
window.debugPeliculas = {
    cache: () => console.log('📦 Cache:', {
        peliculas: localStorage.getItem(CACHE_KEYS.PELICULAS),
        anuncios: localStorage.getItem(CACHE_KEYS.ANUNCIOS),
        timestamp: localStorage.getItem(CACHE_KEYS.TIMESTAMP),
        actualizado: esCacheActualizado()
    }),
    limpiar: limpiarCacheManualmente,
    recargar: () => cargarContenidoPrincipal()
};