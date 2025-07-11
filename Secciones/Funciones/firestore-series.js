// Sistema de gestión de Series con Firestore - Compatibilidad v9
// Configuración Firebase usando variables globales

// Verificar que Firebase esté cargado
if (typeof firebase === 'undefined') {
    console.error('Firebase no está cargado. Asegúrate de incluir el SDK antes de este script.');
    throw new Error('Firebase no está disponible');
}

// Configuración e inicialización usando compat
const firebaseConfig = {
    apiKey: "AIzaSyBQ99rjxbIGm48Rb5upnYnE-E_xHvY0UUE",
    authDomain: "tv-hrz.firebaseapp.com",
    projectId: "tv-hrz",
    storageBucket: "tv-hrz.firebasestorage.app",
    messagingSenderId: "604680147180",
    appId: "1:604680147180:web:24fe7cf9c337ced45d55c9",
    measurementId: "G-XWWTT6VRFT"
};

// Inicializar Firebase solo si no está ya inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Obtener instancia de Firestore
const db = firebase.firestore();

// Configuración del caché
const CACHE_CONFIG = {
    DURACION_MINUTOS: 30,
    KEY_SERIES: 'firestore_series_cache',
    KEY_TIMESTAMP: 'firestore_series_timestamp'
};

// Función para obtener series desde Firestore
async function obtenerSeriesDesdeFirestore() {
    try {
        console.log('🔄 Cargando series desde Firestore...');
        
        const seriesRef = db.collection('series');
        const snapshot = await seriesRef.get();
        
        if (snapshot.empty) {
            console.warn('⚠️ No se encontraron series en Firestore');
            return { series: [] };
        }

        const series = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            series.push({
                firestore_id: doc.id,
                ...data
            });
        });

        console.log(`✅ Cargadas ${series.length} series desde Firestore`);
        
        // Ordenar por ID para mantener consistencia
        series.sort((a, b) => a.id - b.id);
        
        return { series };
    } catch (error) {
        console.error('❌ Error al obtener series de Firestore:', error);
        throw error;
    }
}

// Función para verificar si el caché está vigente
function esCacheVigente() {
    const timestamp = localStorage.getItem(CACHE_CONFIG.KEY_TIMESTAMP);
    if (!timestamp) return false;
    
    const tiempoTranscurrido = Date.now() - parseInt(timestamp);
    const tiempoLimite = CACHE_CONFIG.DURACION_MINUTOS * 60 * 1000;
    
    return tiempoTranscurrido < tiempoLimite;
}

// Función para guardar en caché
function guardarEnCache(series) {
    try {
        localStorage.setItem(CACHE_CONFIG.KEY_SERIES, JSON.stringify(series));
        localStorage.setItem(CACHE_CONFIG.KEY_TIMESTAMP, Date.now().toString());
        console.log('💾 Series guardadas en caché local');
    } catch (error) {
        console.warn('⚠️ Error al guardar en caché:', error);
    }
}

// Función para obtener desde caché
function obtenerDesdeCache() {
    try {
        const data = localStorage.getItem(CACHE_CONFIG.KEY_SERIES);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.warn('⚠️ Error al leer caché:', error);
        return null;
    }
}

// Función principal para cargar series con sistema de respaldo
async function cargarSeries() {
    // 1. Intentar desde caché si está vigente
    if (esCacheVigente()) {
        const seriesCache = obtenerDesdeCache();
        if (seriesCache) {
            console.log('⚡ Usando series desde caché local');
            return seriesCache;
        }
    }

    try {
        // 2. Intentar desde Firestore
        const seriesFirestore = await obtenerSeriesDesdeFirestore();
        guardarEnCache(seriesFirestore);
        return seriesFirestore;
    } catch (error) {
        console.error('❌ Error al cargar desde Firestore:', error);
        
        try {
            // 3. Respaldo: usar caché aunque esté expirado
            const seriesCache = obtenerDesdeCache();
            if (seriesCache) {
                console.warn('⚠️ Usando caché expirado como respaldo');
                return seriesCache;
            }
        } catch (cacheError) {
            console.error('❌ Error al leer caché de respaldo:', cacheError);
        }

        try {
            // 4. Último respaldo: archivo JSON local
            console.warn('🔄 Intentando cargar desde archivo JSON local...');
            const response = await fetch('../DataBase/series.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const seriesJSON = await response.json();
            console.log('📁 Series cargadas desde archivo JSON local');
            return seriesJSON;
        } catch (jsonError) {
            console.error('❌ Error al cargar desde JSON local:', jsonError);
            
            // 5. Error final - devolver estructura vacía
            console.error('💥 Todas las fuentes de datos fallaron');
            return { 
                series: [],
                error: 'No se pudieron cargar las series desde ninguna fuente'
            };
        }
    }
}

// Función para subir una serie a Firestore
async function subirSerie(serie) {
    try {
        console.log(`🔄 Subiendo serie: ${serie.titulo} con ID: ${serie.id}...`);
        
        // Eliminar firestore_id si existe para evitar conflictos
        const { firestore_id, ...datosLimpios } = serie;
        
        // Usar el ID original de la serie como ID del documento
        const serieId = serie.id.toString();
        const docRef = db.collection('series').doc(serieId);
        
        await docRef.set(datosLimpios);
        console.log(`✅ Serie subida con ID original: ${serieId}`);
        
        return {
            success: true,
            id: serieId,
            serie: serie.titulo
        };
    } catch (error) {
        console.error(`❌ Error al subir serie ${serie.titulo}:`, error);
        throw error;
    }
}

// Función para subir múltiples series
async function subirMultiplesSeries(series, onProgress = null) {
    const resultados = {
        exitosas: [],
        fallidas: [],
        total: series.length
    };
    
    for (let i = 0; i < series.length; i++) {
        const serie = series[i];
        
        try {
            const resultado = await subirSerie(serie);
            resultados.exitosas.push(resultado);
            
            if (onProgress) {
                onProgress({
                    actual: i + 1,
                    total: series.length,
                    serie: serie.titulo,
                    estado: 'exitoso'
                });
            }
        } catch (error) {
            const errorInfo = {
                serie: serie.titulo,
                id: serie.id,
                error: error.message
            };
            resultados.fallidas.push(errorInfo);
            
            if (onProgress) {
                onProgress({
                    actual: i + 1,
                    total: series.length,
                    serie: serie.titulo,
                    estado: 'error',
                    error: error.message
                });
            }
        }
        
        // Pausa pequeña para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return resultados;
}

// Función para limpiar caché
function limpiarCacheSeries() {
    localStorage.removeItem(CACHE_CONFIG.KEY_SERIES);
    localStorage.removeItem(CACHE_CONFIG.KEY_TIMESTAMP);
    console.log('🧹 Caché de series limpiado');
}

// Función para obtener una serie específica por ID
async function obtenerSeriePorId(id) {
    try {
        const series = await cargarSeries();
        return series.series.find(serie => serie.id === parseInt(id));
    } catch (error) {
        console.error('❌ Error al obtener serie por ID:', error);
        return null;
    }
}

// Función para buscar series
async function buscarSeries(termino) {
    try {
        const series = await cargarSeries();
        const terminoLower = termino.toLowerCase();
        
        return series.series.filter(serie => 
            serie.titulo.toLowerCase().includes(terminoLower) ||
            (Array.isArray(serie.genero) && 
             serie.genero.some(g => g.toLowerCase().includes(terminoLower))) ||
            (typeof serie.genero === 'string' && 
             serie.genero.toLowerCase().includes(terminoLower))
        );
    } catch (error) {
        console.error('❌ Error al buscar series:', error);
        return [];
    }
}

// Función para verificar conectividad con Firestore
async function verificarConexionFirestore() {
    try {
        console.log('🔍 Verificando conexión con Firestore...');
        const testRef = db.collection('test').doc('connection');
        await testRef.get();
        console.log('✅ Conexión con Firestore exitosa');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión con Firestore:', error);
        return false;
    }
}

// Función para obtener estadísticas de la colección
async function obtenerEstadisticasSeries() {
    try {
        const snapshot = await db.collection('series').get();
        const total = snapshot.size;
        
        let disponibles = 0;
        let nuevas = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.disponible) disponibles++;
            if (data.nuevo) nuevas++;
        });
        
        return {
            total,
            disponibles,
            nuevas,
            noDisponibles: total - disponibles
        };
    } catch (error) {
        console.error('❌ Error al obtener estadísticas:', error);
        return null;
    }
}

// Función para limpiar toda la colección de series en Firestore
async function limpiarColeccionSeries(onProgress = null) {
    try {
        console.log('🧹 Iniciando limpieza de colección de series...');
        
        const snapshot = await db.collection('series').get();
        const totalDocs = snapshot.size;
        
        if (totalDocs === 0) {
            console.log('✅ La colección ya está vacía');
            return { eliminados: 0, errores: 0 };
        }
        
        console.log(`📦 Encontrados ${totalDocs} documentos para eliminar`);
        
        let eliminados = 0;
        let errores = 0;
        
        // Eliminar documentos en lotes para mejor rendimiento
        const batch = db.batch();
        const docs = snapshot.docs;
        
        for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            batch.delete(doc.ref);
            
            if (onProgress) {
                onProgress({
                    actual: i + 1,
                    total: totalDocs,
                    documento: doc.id,
                    operacion: 'eliminando'
                });
            }
        }
        
        await batch.commit();
        eliminados = docs.length;
        
        console.log(`✅ Colección limpiada: ${eliminados} documentos eliminados`);
        
        return { eliminados, errores };
        
    } catch (error) {
        console.error('❌ Error al limpiar colección:', error);
        throw error;
    }
}

// Exponer funciones globalmente para compatibilidad
if (typeof window !== 'undefined') {
    window.firestoreSeries = {
        cargarSeries,
        obtenerSeriesDesdeFirestore,
        subirSerie,
        subirMultiplesSeries,
        limpiarCacheSeries,
        obtenerSeriePorId,
        buscarSeries,
        verificarConexionFirestore,
        obtenerEstadisticasSeries,
        limpiarColeccionSeries,
        esCacheVigente
    };
    
    console.log('🚀 Sistema Firestore para Series inicializado');
    console.log('📋 Funciones disponibles en window.firestoreSeries:', Object.keys(window.firestoreSeries));
}

// Para depuración en consola
window.debugFirestoreSeries = {
    mostrarCache: () => {
        const cache = obtenerDesdeCache();
        console.log('💾 Caché actual:', cache);
        return cache;
    },
    limpiarCache: limpiarCacheSeries,
    verificarExpiracion: () => {
        const vigente = esCacheVigente();
        console.log('⏰ Caché vigente:', vigente);
        return vigente;
    }
}; 