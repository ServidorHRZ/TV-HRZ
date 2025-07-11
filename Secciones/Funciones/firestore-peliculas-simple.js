// Funciones para manejar películas con Firebase Firestore - Versión sin módulos
// Para evitar problemas de CORS, incluimos todo en un solo archivo

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBQ99rjxbIGm48Rb5upnYnE-E_xHvY0UUE",
    authDomain: "tv-hrz.firebaseapp.com",
    projectId: "tv-hrz",
    storageBucket: "tv-hrz.firebasestorage.app",
    messagingSenderId: "604680147180",
    appId: "1:604680147180:web:24fe7cf9c337ced45d55c9",
    measurementId: "G-XWWTT6VRFT"
};

// Variables globales para Firebase
let db;
let firebaseApp;

// Cache local para optimizar rendimiento
const cacheFirestore = {
    peliculas: null,
    timestamp: null,
    tiempoVida: 30 * 60 * 1000 // 30 minutos
};

// Función para inicializar Firebase
async function inicializarFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase SDK no está cargado');
            return false;
        }

        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.app();
        }
        
        db = firebase.firestore();
        console.log('✅ Firebase inicializado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error inicializando Firebase:', error);
        return false;
    }
}

/**
 * Función principal para cargar todas las películas desde Firestore
 */
async function cargarPeliculasDesdeFirestore() {
    try {
        console.log('📥 Cargando películas desde Firestore...');
        
        // Verificar que Firebase esté inicializado
        if (!db) {
            const inicializado = await inicializarFirebase();
            if (!inicializado) {
                throw new Error('No se pudo inicializar Firebase');
            }
        }
        
        // Verificar cache primero
        if (cacheFirestore.peliculas && esCacheValido()) {
            console.log('⚡ Usando cache de Firestore');
            return cacheFirestore.peliculas;
        }

        const peliculasRef = db.collection('peliculas');
        const snapshot = await peliculasRef.get();
        
        if (snapshot.empty) {
            console.warn('⚠️ No se encontraron películas en Firestore');
            return [];
        }

        const peliculas = [];
        snapshot.forEach((doc) => {
            const datos = doc.data();
            // Asegurarse de que la película esté disponible
            if (datos.disponible !== false) {
                peliculas.push({
                    id: doc.id,
                    ...datos
                });
            }
        });

        // Ordenar por ID para mantener consistencia
        peliculas.sort((a, b) => parseInt(a.id) - parseInt(b.id));

        // Guardar en cache
        cacheFirestore.peliculas = peliculas;
        cacheFirestore.timestamp = Date.now();

        console.log(`✅ Cargadas ${peliculas.length} películas desde Firestore`);
        return peliculas;

    } catch (error) {
        console.error('❌ Error cargando películas desde Firestore:', error);
        
        // Si hay error, intentar usar cache aunque esté expirado
        if (cacheFirestore.peliculas) {
            console.log('🔄 Usando cache expirado como respaldo');
            return cacheFirestore.peliculas;
        }
        
        // Como último recurso, devolver array vacío
        return [];
    }
}

/**
 * Función para cargar películas destacadas (para anuncios)
 */
async function cargarPeliculasDestacadas() {
    try {
        const todasLasPeliculas = await cargarPeliculasDesdeFirestore();
        const destacadas = todasLasPeliculas.filter(pelicula => pelicula.destacado === true);
        
        if (destacadas.length > 0) {
            return destacadas;
        } else {
            // Si no hay destacadas, devolver las primeras 5
            return todasLasPeliculas.slice(0, 5);
        }
    } catch (error) {
        console.error('Error cargando películas destacadas:', error);
        return [];
    }
}

/**
 * Función para buscar películas por título
 */
async function buscarPeliculasFirestore(termino) {
    try {
        const todasLasPeliculas = await cargarPeliculasDesdeFirestore();
        const terminoLower = termino.toLowerCase();
        
        return todasLasPeliculas.filter(pelicula => 
            pelicula.titulo.toLowerCase().includes(terminoLower) ||
            (pelicula.descripcion && pelicula.descripcion.toLowerCase().includes(terminoLower)) ||
            (Array.isArray(pelicula.genero) && pelicula.genero.some(g => g.toLowerCase().includes(terminoLower))) ||
            (typeof pelicula.genero === 'string' && pelicula.genero.toLowerCase().includes(terminoLower))
        );
    } catch (error) {
        console.error('Error buscando películas:', error);
        return [];
    }
}

/**
 * Función para verificar si el cache es válido
 */
function esCacheValido() {
    if (!cacheFirestore.timestamp) return false;
    return (Date.now() - cacheFirestore.timestamp) < cacheFirestore.tiempoVida;
}

/**
 * Función para verificar conexión con Firestore
 */
async function verificarConexionFirestore() {
    try {
        if (!db) {
            const inicializado = await inicializarFirebase();
            if (!inicializado) return false;
        }
        
        const peliculasRef = db.collection('peliculas');
        const snapshot = await peliculasRef.limit(1).get();
        console.log('✅ Conexión con Firestore verificada');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión con Firestore:', error);
        return false;
    }
}

/**
 * Función para limpiar el cache manualmente
 */
function limpiarCacheFirestore() {
    cacheFirestore.peliculas = null;
    cacheFirestore.timestamp = null;
    console.log('🧹 Cache de Firestore limpiado');
}

/**
 * Función para obtener estadísticas de la base de datos
 */
async function obtenerEstadisticasFirestore() {
    try {
        const peliculas = await cargarPeliculasDesdeFirestore();
        
        const stats = {
            total: peliculas.length,
            disponibles: peliculas.filter(p => p.disponible !== false).length,
            nuevas: peliculas.filter(p => p.nuevo === true).length,
            destacadas: peliculas.filter(p => p.destacado === true).length,
            categorias: {}
        };

        // Contar por categorías
        peliculas.forEach(pelicula => {
            if (Array.isArray(pelicula.genero)) {
                pelicula.genero.forEach(categoria => {
                    stats.categorias[categoria] = (stats.categorias[categoria] || 0) + 1;
                });
            } else if (pelicula.genero) {
                const categoria = pelicula.genero;
                stats.categorias[categoria] = (stats.categorias[categoria] || 0) + 1;
            }
        });

        return stats;
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return null;
    }
}

// Función para debugging - mostrar información del cache
function mostrarInfoCache() {
    console.log('📊 Información del cache de Firestore:');
    console.log('- Películas en cache:', cacheFirestore.peliculas ? cacheFirestore.peliculas.length : 0);
    console.log('- Timestamp:', cacheFirestore.timestamp ? new Date(cacheFirestore.timestamp).toLocaleString() : 'N/A');
    console.log('- Cache válido:', esCacheValido());
    console.log('- Tiempo restante:', cacheFirestore.timestamp ? Math.max(0, Math.round((cacheFirestore.tiempoVida - (Date.now() - cacheFirestore.timestamp)) / 1000 / 60)) + ' minutos' : 'N/A');
}

// Exponer funciones globalmente
window.firestorePeliculas = {
    cargarPeliculasDesdeFirestore,
    cargarPeliculasDestacadas,
    buscarPeliculasFirestore,
    verificarConexionFirestore,
    limpiarCacheFirestore,
    obtenerEstadisticasFirestore,
    mostrarInfoCache,
    inicializarFirebase
};

console.log('🔥 Firestore-Películas Simple cargado. Funciones disponibles en window.firestorePeliculas'); 