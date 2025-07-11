// Funciones para manejar películas con Firebase Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, orderBy, query, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Cache local para optimizar rendimiento
const cacheFirestore = {
    peliculas: null,
    timestamp: null,
    tiempoVida: 30 * 60 * 1000 // 30 minutos
};

/**
 * Función principal para cargar todas las películas desde Firestore
 */
export async function cargarPeliculasDesdeFirestore() {
    try {
        console.log('📥 Cargando películas desde Firestore...');
        
        // Verificar cache primero
        if (cacheFirestore.peliculas && esCacheValido()) {
            console.log('⚡ Usando cache de Firestore');
            return cacheFirestore.peliculas;
        }

        const peliculasRef = collection(db, 'peliculas');
        const snapshot = await getDocs(peliculasRef);
        
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
 * Función para cargar películas por categoría específica
 */
export async function cargarPeliculasPorCategoria(categoria) {
    try {
        const todasLasPeliculas = await cargarPeliculasDesdeFirestore();
        
        return todasLasPeliculas.filter(pelicula => {
            if (Array.isArray(pelicula.genero)) {
                return pelicula.genero.some(g => g.toLowerCase() === categoria.toLowerCase());
            } else if (typeof pelicula.genero === 'string') {
                return pelicula.genero.toLowerCase() === categoria.toLowerCase();
            }
            return false;
        });

    } catch (error) {
        console.error(`Error cargando películas de categoría ${categoria}:`, error);
        return [];
    }
}

/**
 * Función para cargar películas nuevas/estrenos
 */
export async function cargarPeliculasNuevas() {
    try {
        const todasLasPeliculas = await cargarPeliculasDesdeFirestore();
        return todasLasPeliculas.filter(pelicula => pelicula.nuevo === true || pelicula.estreno === true);
    } catch (error) {
        console.error('Error cargando películas nuevas:', error);
        return [];
    }
}

/**
 * Función para cargar películas destacadas (para anuncios)
 */
export async function cargarPeliculasDestacadas() {
    try {
        const todasLasPeliculas = await cargarPeliculasDesdeFirestore();
        return todasLasPeliculas.filter(pelicula => pelicula.destacado === true);
    } catch (error) {
        console.error('Error cargando películas destacadas:', error);
        return [];
    }
}

/**
 * Función para buscar películas por título
 */
export async function buscarPeliculas(termino) {
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
 * Función para obtener una película específica por ID
 */
export async function obtenerPeliculaPorId(id) {
    try {
        const docRef = doc(db, 'peliculas', id.toString());
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            console.warn(`Película con ID ${id} no encontrada`);
            return null;
        }
    } catch (error) {
        console.error(`Error obteniendo película ${id}:`, error);
        return null;
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
 * Función para limpiar el cache manualmente
 */
export function limpiarCacheFirestore() {
    cacheFirestore.peliculas = null;
    cacheFirestore.timestamp = null;
    console.log('🧹 Cache de Firestore limpiado');
}

/**
 * Función para verificar conexión con Firestore
 */
export async function verificarConexionFirestore() {
    try {
        const peliculasRef = collection(db, 'peliculas');
        const snapshot = await getDocs(query(peliculasRef, limit(1)));
        console.log('✅ Conexión con Firestore verificada');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión con Firestore:', error);
        return false;
    }
}

/**
 * Función para obtener estadísticas de la base de datos
 */
export async function obtenerEstadisticasFirestore() {
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
export function mostrarInfoCache() {
    console.log('📊 Información del cache de Firestore:');
    console.log('- Películas en cache:', cacheFirestore.peliculas ? cacheFirestore.peliculas.length : 0);
    console.log('- Timestamp:', cacheFirestore.timestamp ? new Date(cacheFirestore.timestamp).toLocaleString() : 'N/A');
    console.log('- Cache válido:', esCacheValido());
    console.log('- Tiempo restante:', cacheFirestore.timestamp ? Math.max(0, Math.round((cacheFirestore.tiempoVida - (Date.now() - cacheFirestore.timestamp)) / 1000 / 60)) + ' minutos' : 'N/A');
}

// Exponer funciones para debugging en la consola
window.firestorePeliculas = {
    cargarPeliculasDesdeFirestore,
    cargarPeliculasPorCategoria,
    cargarPeliculasNuevas,
    cargarPeliculasDestacadas,
    buscarPeliculas,
    obtenerPeliculaPorId,
    limpiarCacheFirestore,
    verificarConexionFirestore,
    obtenerEstadisticasFirestore,
    mostrarInfoCache
};

console.log('🔥 Módulo Firestore-Películas cargado. Funciones disponibles en window.firestorePeliculas'); 