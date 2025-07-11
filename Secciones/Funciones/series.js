 // Constantes para el manejo de caché
 const CACHE_VERSION = '1.0';
 const CACHE_KEYS = {
     SERIES: 'hrztv_series_cache',
     PELICULAS: 'hrztv_peliculas_cache',
     ANUNCIOS: 'hrztv_anuncios_cache',
     TIMESTAMP: 'hrztv_cache_timestamp',
     VERSION: 'hrztv_cache_version'
 };

 // Función para manejar el caché
 function gestionarCache() {
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

 // Función para cargar contenido con caché
 async function cargarContenidoConCache(tipo) {
     const cacheKey = CACHE_KEYS[tipo.toUpperCase()];
     const contenidoCache = localStorage.getItem(cacheKey);
     
     try {
         // Si hay caché válido, usarlo primero
         if (contenidoCache && esCacheActualizado()) {
             const datosCache = JSON.parse(contenidoCache);
             actualizarInterfaz(tipo, datosCache);
             
             // Actualizar en segundo plano
             actualizarContenidoEnSegundoPlano(tipo);
         } else {
             // Si no hay caché o está desactualizado, cargar desde el servidor
             await cargarContenidoDesdeServidor(tipo);
         }
     } catch (error) {
         console.error(`Error cargando ${tipo}:`, error);
         // Si hay error, usar caché aunque esté desactualizado
         if (contenidoCache) {
             actualizarInterfaz(tipo, JSON.parse(contenidoCache));
         }
     }
 }

 // Función para cargar contenido desde el servidor
 async function cargarContenidoDesdeServidor(tipo) {
     try {
         let datos;
         
         if (tipo === 'series' || tipo === 'peliculas') {
             // Usar Firestore para cargar series
             if (window.firestoreSeries) {
                 console.log('🔄 Cargando series desde Firestore...');
                 datos = await window.firestoreSeries.cargarSeries();
             } else {
                 console.warn('⚠️ Firestore no disponible, usando JSON local');
                 const response = await fetch('../DataBase/series.json');
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                 datos = await response.json();
             }
         } else if (tipo === 'anuncios') {
             // Para anuncios, usamos las series disponibles
             if (window.firestoreSeries) {
                 const seriesData = await window.firestoreSeries.cargarSeries();
                 datos = seriesData;
                 datos.announcements = datos.series.filter(serie => serie.destacado);
             } else {
                 const response = await fetch('../DataBase/series.json');
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                 datos = await response.json();
                 datos.announcements = datos.series.filter(serie => serie.destacado);
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
             const response = await fetch('../DataBase/series.json');
             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
             const datos = await response.json();
             
             if (tipo === 'anuncios') {
                 datos.announcements = datos.series.filter(serie => serie.destacado);
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
             localStorage.setItem(CACHE_KEYS[tipo.toUpperCase()], JSON.stringify(datosNuevos));
             localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
             actualizarInterfaz(tipo, datosNuevos);
         }
     } catch (error) {
         console.error(`Error actualizando ${tipo} en segundo plano:`, error);
     }
 }

 // Función para actualizar la interfaz según el tipo de contenido
 function actualizarInterfaz(tipo, datos) {
     switch (tipo) {
         case 'series':
             todasLasSeries = datos.series.filter(serie => serie.disponible);
             mostrarSeriesPorCategorias(todasLasSeries);
             break;
         case 'peliculas':
             todasLasSeries = datos.series.filter(serie => serie.disponible);
             mostrarSeriesPorCategorias(todasLasSeries);
             break;
         case 'anuncios':
             announcements = datos.announcements;
             mostrarAnuncios();
             break;
     }
 }

 // Función para precargar imágenes
 function precargarImagenes(datos) {
     const imagenes = [];
     
     datos.forEach(item => {
         if (item.imagen) {
             const img = new Image();
             img.src = item.imagen;
             imagenes.push(img);
         }
         if (item.miniatura) {
             const img = new Image();
             img.src = item.miniatura;
             imagenes.push(img);
         }
     });
 }

 // Variables globales
 let todasLasSeries = [];
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
 let minSwipeDistance = 100; // Aumentado para requerir un deslizamiento más largo
 let maxSwipeTime = 300; // Tiempo máximo para considerar un swipe válido

 // Agregar una variable para rastrear si hubo movimiento
 let hasMoved = false;

 // Función para organizar series por categorías
 function organizarPorCategorias(series) {
     const categorias = {
         'estrenos': { titulo: 'Estrenos', series: [], mantenerOrden: false },
         'mi_lista': { titulo: 'Mi Lista', series: [], mantenerOrden: false },
         'neflix': { titulo: 'Netflix', series: [], mantenerOrden: false },
         'crimen': { titulo: 'Crimen y Suspenso', series: [], mantenerOrden: false },
         'amazon': { titulo: 'Amazon Prime', series: [], mantenerOrden: false },
         'accion': { titulo: 'Accion y Mucho Mas', series: [], mantenerOrden: false },
         'marvel': { titulo: 'Marvel', series: [], mantenerOrden: false },
         'dc': { titulo: 'DC Comics', series: [], mantenerOrden: false },
         'cartoon': { titulo: 'Cartoon Network', series: [], mantenerOrden: false },
         'disney': { titulo: 'Disney+', series: [], mantenerOrden: false },
         'nick': { titulo: 'Nickelodeon', series: [], mantenerOrden: false },
         'discoverykids': { titulo: 'Discovery Kids', series: [], mantenerOrden: false },
         'anime': { titulo: 'Anime', series: [], mantenerOrden: false },
         'novelas': { titulo: 'Novelas', series: [], mantenerOrden: false },
         'deportes': { titulo: 'Deportes', series: [], mantenerOrden: false },
         
     };

     // Función para mezclar array
     function shuffleArray(array) {
         for (let i = array.length - 1; i > 0; i--) {
             const j = Math.floor(Math.random() * (i + 1));
             [array[i], array[j]] = [array[j], array[i]];
         }
         return array;
     }

     // Agregar series a categorías
     series.forEach(serie => {
         // Agregar a la categoría Estrenos si tiene la propiedad estreno
         if (serie.estreno) {
             categorias['estrenos'].series.push(serie);
         }
         
         if (Array.isArray(serie.genero)) {
             serie.genero.forEach(gen => {
                 const generoLower = gen.toLowerCase();
                 if (categorias[generoLower]) {
                     categorias[generoLower].series.push(serie);
                 }
             });
         } else if (typeof serie.genero === 'string') {
             const generoLower = serie.genero.toLowerCase();
             if (categorias[generoLower]) {
                 categorias[generoLower].series.push(serie);
             }
         }
         
         if (serie.plataforma) {
             const plataformaLower = serie.plataforma.toLowerCase();
             if (categorias[plataformaLower]) {
                 categorias[plataformaLower].series.push(serie);
             }
         }
     });

     // Ordenar series en cada categoría (nuevas primero)
     for (const categoria of Object.values(categorias)) {
         const nuevas = categoria.series.filter(s => s.nuevo);
         const noNuevas = categoria.series.filter(s => !s.nuevo);

         if (!categoria.mantenerOrden) {
             shuffleArray(noNuevas);
         }

         categoria.series = [...nuevas, ...noNuevas];
     }

     return categorias;
 }

 // Función para mostrar series por categorías
 function mostrarSeriesPorCategorias(series) {
     const categoriasWrapper = document.querySelector('.categorias-wrapper');
     if (!categoriasWrapper) return;

     const logosCategoria = {
         'neflix': ['../logos/1.jpeg'],
         'amazon': ['../logos/2.jpeg'],
         'animacion': ['../logos/3.jpeg'],
         'marvel': ['../logos/7.png'],
         'dc': ['../logos/4.jpeg'],
         'nuevos': ['https://cdnsnte1.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/02/20120506/boton_nuevo_paz.png'],
     };

     categoriasWrapper.innerHTML = '';
     
     // Mostrar Mi Lista de Series primero
     const miListaSeries = JSON.parse(localStorage.getItem('miListaSeries') || '[]');
     
     if (miListaSeries.length > 0) {
         const seccionMiLista = document.createElement('div');
         seccionMiLista.className = 'categoria-seccion';
         
         seccionMiLista.innerHTML = `
             <h2 class="categoria-titulo">Mi Lista <i class="fas fa-heart" style="color: #00ffff;"></i></h2>
             <div class="categoria-contenedor">
                 ${miListaSeries.map(serie => `
                     <div class="movie-card" data-serie='${JSON.stringify(serie)}'>
                         ${serie.badge ? `<div class="badge">${serie.badge}</div>` : ''}
                         <img src="${serie.imagen}" alt="${serie.titulo}">
                         <div class="movie-info">
                             <h3>${serie.titulo}</h3>
                             <p>${serie.año || ''}</p>
                         </div>  
                     </div>
                 `).join('')}
             </div>
             <button class="nav-arrow prev"><i class="fas fa-chevron-left"></i></button>
             <button class="nav-arrow next"><i class="fas fa-chevron-right"></i></button>
         `;
         
         categoriasWrapper.appendChild(seccionMiLista);
     }
     
     const categorias = organizarPorCategorias(series);

     for (const [key, categoria] of Object.entries(categorias)) {
         if (categoria.series.length > 0) {
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
                     ${categoria.series.map(serie => `
                         <div class="movie-card" data-serie='${JSON.stringify(serie)}'>
                             ${serie.nuevo ? `<div class="badge">NUEVO</div>` : ''}
                             ${serie.badge ? `<div class="badge">${serie.badge}</div>` : ''}
                             <img src="${serie.imagen}" alt="${serie.titulo}">
                             <div class="movie-info">
                                 <h3>${serie.titulo}</h3>
                                 <p>${serie.año || ''}</p>
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
             const serieData = card.getAttribute('data-serie');
             abrirSerie(serieData);
         });
     });

     // Agregar listener para actualizar la interfaz cuando cambie Mi Lista
     window.addEventListener('miListaSeriesActualizada', () => {
         mostrarSeriesPorCategorias(todasLasSeries);
     });

     // Configurar las flechas de navegación después de crear las secciones
     setupNavArrows();
 }

 // Función para obtener series aleatorias para los posters
 function obtenerSeriesAleatorias(series, cantidad) {
     const seriesDisponibles = series.filter(s => s.disponible);
     const seriesAleatorias = [];
     const copiasSeries = [...seriesDisponibles];
     
     for (let i = 0; i < cantidad && copiasSeries.length > 0; i++) {
         const indiceAleatorio = Math.floor(Math.random() * copiasSeries.length);
         seriesAleatorias.push(copiasSeries[indiceAleatorio]);
         copiasSeries.splice(indiceAleatorio, 1);
     }
     
     return seriesAleatorias;
 }

 // Modificar la función mostrarAnuncios
 function mostrarAnuncios() {
     const container = document.getElementById('announcementsContainer');
     container.innerHTML = '';
     
     const postersAleatorios = obtenerSeriesAleatorias(todasLasSeries, 5);
     const esPC = window.innerWidth > 768;

     postersAleatorios.forEach((serie, index) => {
         const slide = document.createElement('div');
         slide.className = 'announcement-slide';
         
         const trailerSrc = esPC && serie.trailer ? 
             `${serie.trailer}?autoplay=0&mute=0&controls=0&showinfo=0&rel=0&loop=1&playlist=${serie.trailer.split('embed/')[1]}&enablejsapi=1&disablekb=1&modestbranding=1&iv_load_policy=3` 
             : '';

         const contenidoMedia = esPC && serie.trailer ? `
             <iframe 
                 id="trailerFrame_${serie.id}"
                 src="${trailerSrc}"
                 class="announcement-trailer"
                 frameborder="0" 
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                 style="pointer-events: none;"
                 allowfullscreen>
             </iframe>
             <button class="sound-toggle" onclick="toggleSound(${serie.id})" style="z-index: 3;">
                 <i class="fas fa-volume-up"></i>
             </button>
         ` : `
             <img src="${serie.imagen}" alt="${serie.titulo}" class="announcement-image">
         `;

         const miLista = JSON.parse(localStorage.getItem('miListaSeries') || '[]');
         const estaEnMiLista = miLista.some(s => s.id === serie.id);
         
         const botonVerAhoraHTML = `
             <button class="ver-ahora-btn" data-serie='${serie.id}' onclick="abrirSerie(${serie.id})">
                 <i class="fas fa-play"></i> Reproducir
             </button>
         `;
         
         const botonMiListaHTML = `
             <button class="mi-lista-btn ${estaEnMiLista ? 'en-mi-lista' : ''}" 
                     data-serie='${serie.id}' 
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
                         <h2 class="announcement-title">${serie.titulo}</h2>
                         <p class="announcement-description">${serie.descripcion || 'Una emocionante serie que te mantendrá al borde de tu asiento.'}</p>
                     </div>
                 </div>
                 <div class="announcement-info">
                     ${botonVerAhoraHTML}
                     ${botonMiListaHTML}
                 </div>
             </div>
         `;
         container.appendChild(slide);
         
         if (index === 0 && esPC && serie.trailer) {
             setTimeout(() => {
                 const iframe = document.getElementById(`trailerFrame_${serie.id}`);
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

 // Función para ver serie
 async function verSerie(serieId) {
     try {
         let serie;
         
         // Intentar cargar desde Firestore primero
         if (window.firestoreSeries) {
             serie = await window.firestoreSeries.obtenerSeriePorId(serieId);
         }
         
         // Si no se encuentra en Firestore, intentar desde JSON local
         if (!serie) {
             console.warn('⚠️ Serie no encontrada en Firestore, intentando JSON local');
             const response = await fetch('../DataBase/series.json');
             const data = await response.json();
             serie = data.series.find(s => s.id === serieId);
         }
         
         if (serie) {
             localStorage.setItem('serieSeleccionada', JSON.stringify(serie));
             window.location.href = 'serie.html';
         } else {
             console.error('Serie no encontrada con ID:', serieId);
         }
     } catch (error) {
         console.error('Error al cargar serie:', error);
         
         // Respaldo final: intentar desde JSON local
         try {
             const response = await fetch('../DataBase/series.json');
             const data = await response.json();
             const serie = data.series.find(s => s.id === serieId);
             if (serie) {
                 localStorage.setItem('serieSeleccionada', JSON.stringify(serie));
                 window.location.href = 'serie.html';
             }
         } catch (backupError) {
             console.error('Error en respaldo:', backupError);
         }
     }
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

 // Event Listeners
 document.addEventListener('DOMContentLoaded', () => {
     gestionarCache();
     
     // Cargar contenido con caché
     cargarContenidoConCache('series');
     cargarContenidoConCache('anuncios');
     
     setupCarouselTouch();
     handleScrollAudio(); // Agregar el manejo del audio
     agregarEstilosScroll();
     enableDragScroll();
     
     const carousel = document.querySelector('.announcements-carousel');
     if (carousel) {
         carousel.addEventListener('mouseenter', stopAutoSlide);
         carousel.addEventListener('mouseleave', startAutoSlide);
     }

     // Agregar un pequeño retraso para asegurar que los iframes estén cargados
     setTimeout(iniciarReproduccionAutomatica, 1000);
 });

 // Búsqueda
 document.getElementById('search-input').addEventListener('input', (e) => {
     searchSeries(e.target.value);
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
     const miListaSeries = JSON.parse(localStorage.getItem('miListaSeries') || '[]');
     
     if (miListaSeries.length > 0) {
         const miListaHTML = `
         <div class="categoria-seccion">
                 <h2 class="categoria-titulo">Mi Lista de Series <i class="fas fa-heart" style="color: #00ffff;"></i></h2>
                 <div class="categoria-contenedor">
                     ${miListaSeries.map(serie => `
                         <div class="movie-card" data-serie='${JSON.stringify(serie)}'>
                             ${serie.badge ? `<div class="badge">${serie.badge}</div>` : ''}
                             <img src="${serie.imagen}" alt="${serie.titulo}">
                             <div class="movie-info">
                                 <h3>${serie.titulo}</h3>
                                 <p>${serie.año || ''}</p>
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

 // Escuchar cambios en Mi Lista de Series
 window.addEventListener('miListaSeriesActualizada', () => {
     cargarCategorias();
 });

 // Recargar categorías cuando se actualiza Mi Lista de Series
 window.addEventListener('storage', function(e) {
     if (e.key === 'miListaSeries') {
         console.log("Actualizando Mi Lista de Series");
         mostrarSeriesPorCategorias(series);
     }
 });

 // Agregar esta nueva función para manejar la apertura de series
 function abrirSerie(serieData) {
     try {
         let serie;
         
         if (typeof serieData === 'string') {
             try {
                 serie = JSON.parse(serieData);
             } catch {
                 console.error('Error al parsear datos de serie');
                 return;
             }
         } else if (typeof serieData === 'number') {
             serie = todasLasSeries.find(s => s.id === serieData);
         } else {
             serie = serieData;
         }

         if (!serie) {
             console.error('No se encontraron datos de la serie');
             return;
         }

         if (!serie.id || !serie.titulo) {
             console.error('Datos de serie incompletos');
             return;
         }

         localStorage.setItem('serieSeleccionada', JSON.stringify(serie));
         window.location.href = 'serie.html';
     } catch (error) {
         console.error('Error al abrir serie:', error);
     }
 }

 // Modificar la función de búsqueda
 function searchSeries(query) {
     const announcementsCarousel = document.querySelector('.announcements-carousel');
     
     // Si no hay búsqueda, mostrar todo normalmente
     if (!query.trim()) {
         mostrarSeriesPorCategorias(todasLasSeries);
         if (announcementsCarousel) {
             announcementsCarousel.style.display = 'block';
         }
         return;
     }

     const busqueda = query.toLowerCase().trim();
     const seriesFiltradas = todasLasSeries.filter(serie => 
         serie.titulo.toLowerCase().includes(busqueda) ||
         (serie.genero && (
             Array.isArray(serie.genero) 
                 ? serie.genero.some(g => g.toLowerCase().includes(busqueda))
                 : serie.genero.toLowerCase().includes(busqueda)
         ))
     );

     // Ocultar el carrusel durante la búsqueda en todas las plataformas
     if (announcementsCarousel) {
         announcementsCarousel.style.display = 'none';
     }

     // Mostrar resultados directamente en las categorías
     mostrarSeriesPorCategorias(seriesFiltradas);
 }

 // Modificar la función setupBuscador para manejar la visibilidad del carrusel
 function setupBuscador() {
     const searchInput = document.getElementById('search-input');
     const headerSearch = document.getElementById('headerSearch');
     const announcementsCarousel = document.querySelector('.announcements-carousel');

     searchInput.addEventListener('input', (e) => {
         searchSeries(e.target.value);
     });

     // Agregar manejo de la tecla Escape
     document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape') {
             headerSearch.classList.remove('active');
             searchInput.value = '';
             if (announcementsCarousel) {
                 announcementsCarousel.style.display = 'block';
             }
             mostrarSeriesPorCategorias(todasLasSeries);
         }
     });

     // Restaurar el carrusel cuando se borra la búsqueda
     searchInput.addEventListener('search', () => {
         if (!searchInput.value) {
             if (announcementsCarousel) {
                 announcementsCarousel.style.display = 'block';
             }
             mostrarSeriesPorCategorias(todasLasSeries);
         }
     });
 }

 // Agregar función para controlar el sonido
 function toggleSound(serieId) {
     const iframe = document.getElementById(`trailerFrame_${serieId}`);
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
         let serieData;
         const serieAttr = boton.getAttribute('data-serie');
         
         // Verificar si es un ID o un objeto JSON
         if (!isNaN(serieAttr)) {
             // Si es un ID, buscar la serie en todasLasSeries
             serieData = todasLasSeries.find(s => s.id === parseInt(serieAttr));
         } else {
             // Si es un objeto JSON, parsearlo
             try {
                 serieData = JSON.parse(serieAttr);
             } catch {
                 console.error('Error al parsear datos de serie');
                 return;
             }
         }

         if (!serieData) {
             console.error('No se encontraron datos de la serie');
             return;
         }

         const miLista = JSON.parse(localStorage.getItem('miListaSeries') || '[]');
         const indice = miLista.findIndex(s => s.id === serieData.id);
         
         if (indice === -1) {
             // Agregar al principio de mi lista usando unshift
             miLista.unshift(serieData);
             boton.innerHTML = '<i class="fas fa-check"></i> Mi lista';
             boton.classList.add('en-mi-lista');
         } else {
             // Quitar de mi lista
             miLista.splice(indice, 1);
             boton.innerHTML = '<i class="fas fa-plus"></i> Mi lista';
             boton.classList.remove('en-mi-lista');
         }
         
         localStorage.setItem('miListaSeries', JSON.stringify(miLista));
         
         // Disparar evento personalizado
         window.dispatchEvent(new CustomEvent('miListaSeriesActualizada'));
     } catch (error) {
         console.error('Error en toggleMiLista:', error);
     }
 }