let isMuted = false;
        let youtubePlayer = null;

        // Función para silenciar el trailer
        function muteTrailer() {
            const trailerFrame = document.getElementById('trailer-player');
            const soundToggle = document.getElementById('sound-toggle');
            const soundIcon = soundToggle.querySelector('i');
            
            if (!isMuted) {
                let currentSrc = trailerFrame.src;
                trailerFrame.src = currentSrc + '&mute=1';
                soundIcon.className = 'fas fa-volume-mute';
                isMuted = true;
            }
        }

        // Función para controlar el sonido del trailer
        function toggleTrailerSound() {
            const trailerFrame = document.getElementById('trailer-player');
            const soundToggle = document.getElementById('sound-toggle');
            const soundIcon = soundToggle.querySelector('i');
            
            let currentSrc = trailerFrame.src;
            let newSrc = '';

            if (isMuted) {
                newSrc = currentSrc.replace('&mute=1', '');
                soundIcon.className = 'fas fa-volume-up';
            } else {
                newSrc = currentSrc + '&mute=1';
                soundIcon.className = 'fas fa-volume-mute';
            }

            isMuted = !isMuted;
            trailerFrame.src = newSrc;
        }

        function prevenirRedirecciones() {
            // Prevenir redirecciones en iframes
            const iframes = document.getElementsByTagName('iframe');
            for (let iframe of iframes) {
                iframe.sandbox = "allow-scripts allow-same-origin allow-forms";
                
                iframe.addEventListener('load', function() {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        
                        // Prevenir redirecciones dentro del iframe
                        iframeDoc.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }, true);

                        // Bloquear popups y anuncios
                        iframeDoc.addEventListener('beforeunload', function(e) {
                            e.preventDefault();
                            return false;
                        });

                        // Deshabilitar scripts maliciosos
                        const scripts = iframeDoc.getElementsByTagName('script');
                        for (let script of scripts) {
                            if (script.src && !script.src.includes('HRZ')) {
                                script.remove();
                            }
                        }

                        // Bloquear ventanas emergentes
                        iframeDoc.window.open = function() { return null; };
                        iframeDoc.window.alert = function() { return null; };
                        iframeDoc.window._blank = null;

                    } catch (e) {
                        // Error esperado por cross-origin
                        console.log("Error de acceso al iframe por cross-origin");
                    }
                });
            }

            // Prevenir redirecciones de ventana principal
            window.onbeforeunload = function(e) {
                const currentTime = new Date().getTime();
                const timeSinceLoad = currentTime - window.performance.timing.navigationStart;
                
                if (e && e.target && e.target.location && e.target.location.href) {
                    const newUrl = e.target.location.href;
                    if (newUrl.includes('HRZ') || newUrl.includes('Secciones')) {
                        return;
                    }
                }
                
                if (timeSinceLoad > 1000) {
                    e.preventDefault();
                    return false;
                }
            };

            // Bloquear popups
            window.addEventListener('click', function(e) {
                window.onbeforeunload = null;
                setTimeout(function() {
                    window.onbeforeunload = function() { return false; };
                }, 0);
            }, true);

            // Sobrescribir funciones de redirección
            window.open = function() { return null; };
            window.alert = function() { return null; };
            window._blank = null;
        }

        document.addEventListener('DOMContentLoaded', function() {
            const serieSeleccionada = JSON.parse(localStorage.getItem('serieSeleccionada'));
            if (serieSeleccionada) {
                cargarInformacionSerie(serieSeleccionada);
                if (serieSeleccionada.enProceso) {
                    mostrarModalEnProceso(serieSeleccionada);
                }
                prevenirRedirecciones();
            }
        });

        // Agregar observador de mutaciones
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    prevenirRedirecciones();
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Función para manejar el estado de capítulos vistos
        function inicializarSistemaVistas() {
            // Crear objeto para almacenar vistas si no existe
            if (!localStorage.getItem('capitulosVistos')) {
                localStorage.setItem('capitulosVistos', JSON.stringify({}));
            }
        }

        // Función para marcar/desmarcar capítulo como visto
        function toggleCapituloVisto(serieId, temporada, episodio) {
            const capitulosVistos = JSON.parse(localStorage.getItem('capitulosVistos'));
            const key = `${serieId}-${temporada}-${episodio}`;
            
            if (!capitulosVistos[key]) {
                capitulosVistos[key] = {
                    fecha: new Date().toISOString(),
                    visto: true
                };
            } else {
                capitulosVistos[key].visto = !capitulosVistos[key].visto;
            }
            
            localStorage.setItem('capitulosVistos', JSON.stringify(capitulosVistos));
            return capitulosVistos[key].visto;
        }

        // Función para verificar si un capítulo está visto
        function esCapituloVisto(serieId, temporada, episodio) {
            const capitulosVistos = JSON.parse(localStorage.getItem('capitulosVistos'));
            const key = `${serieId}-${temporada}-${episodio}`;
            return capitulosVistos[key]?.visto || false;
        }

        // Modificar la función de cargar información de serie
        function cargarInformacionSerie(serie) {
            console.log("Cargando serie:", serie); // Debug

            // Verificar si la serie es válida
            if (!serie || !serie.titulo) {
                console.error("Serie no válida:", serie);
                return;
            }

            // Asegurarse de que el contenedor existe
            const container = document.querySelector('.container');
            if (!container) {
                console.error("No se encontró el contenedor");
                return;
            }

            // Crear o actualizar el botón de Mi Lista
            let btnAgregarLista = document.getElementById('agregarLista');
            if (!btnAgregarLista) {
                btnAgregarLista = document.createElement('button');
                btnAgregarLista.id = 'agregarLista';
                btnAgregarLista.className = 'agregar-lista-btn';
                const heroSection = document.querySelector('.hero-section');
                heroSection.appendChild(btnAgregarLista);
            }

            // Función para verificar si la serie está en Mi Lista
            function estaEnMiLista(serie) {
                const miLista = JSON.parse(localStorage.getItem('miListaSeries') || '[]');
                return miLista.some(item => item.id === serie.id);
            }

            // Función para actualizar el botón
            function actualizarBoton() {
                const enLista = estaEnMiLista(serie);
                btnAgregarLista.className = `agregar-lista-btn ${enLista ? 'en-lista' : ''}`;
                btnAgregarLista.innerHTML = enLista ? 
                    `<i class="fas fa-check"></i><span>En Mi Lista</span>` :
                    `<i class="fas fa-plus"></i><span>Mi Lista</span>`;
            }

            // Manejar clic en el botón
            btnAgregarLista.onclick = function() {
                let miLista = JSON.parse(localStorage.getItem('miListaSeries') || '[]');
                const enLista = estaEnMiLista(serie);

                if (!enLista) {
                    // Crear objeto de serie limpio
                    const serieLimpia = {
                        id: serie.id || Date.now(),
                        titulo: serie.titulo,
                        imagen: serie.imagen || serie.miniatura_episodios,
                        año: serie.año,
                        genero: serie.genero,
                        descripcion: serie.descripcion,
                        temporadas: serie.temporadas,
                        trailer: serie.trailer,
                        director: serie.director,
                        actores: serie.actores,
                        nuevo: serie.nuevo || false,
                        disponible: serie.disponible || true,
                        badge: serie.badge || null,
                        miniatura_episodios: serie.miniatura_episodios || serie.imagen
                    };

                    miLista.unshift(serieLimpia); // Agregar al principio de la lista
                    console.log("Serie agregada:", serieLimpia);
                } else {
                    miLista = miLista.filter(item => item.id !== serie.id);
                    console.log("Serie eliminada:", serie.titulo);
                }

                localStorage.setItem('miListaSeries', JSON.stringify(miLista));
                actualizarBoton();

                // Notificar cambio
                const evento = new CustomEvent('miListaSeriesActualizada', {
                    detail: { serie: serie, agregada: !enLista }
                });
                window.dispatchEvent(evento);

                // Mostrar feedback
                alert(enLista ? 'Eliminado de Mi Lista' : 'Agregado a Mi Lista');
            };

            // Actualizar estado inicial del botón
            actualizarBoton();

            // Verificar si la serie tiene temporadas
            if (!serie.temporadas || serie.temporadas.length === 0) {
                mostrarModalEnProceso(serie);
                return;
            }

            // Cargar el trailer con sonido activado
            const trailerPlayer = document.getElementById('trailer-player');
            if (serie.trailer) {
                trailerPlayer.src = `${serie.trailer}?autoplay=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${serie.trailer.split('/').pop()}`;
            }

            // Configurar el botón de sonido
            const soundToggle = document.getElementById('sound-toggle');
            soundToggle.onclick = toggleTrailerSound;

            // Resto de la carga de información
            document.getElementById('serie-imagen-hero').src = serie.imagen;
            document.getElementById('serie-titulo-hero').textContent = serie.titulo;
            document.getElementById('serie-descripcion-hero').textContent = serie.descripcion;
            document.getElementById('serie-año-hero').textContent = serie.año;
            document.getElementById('serie-director-hero').textContent = serie.director;
            document.getElementById('serie-actores-hero').textContent = serie.actores.join(', ');

            // Cargar temporadas
            const temporadasContainer = document.getElementById('temporadas-container');
            temporadasContainer.innerHTML = ''; // Limpiar contenedor

            // Crear selector de temporadas (solo para PC)
            if (window.innerWidth >= 769) {
                const temporadaSelector = document.createElement('div');
                temporadaSelector.className = 'temporada-selector';
                temporadaSelector.innerHTML = `
                    <div class="temporada-actual">
                        <span>Temporada 1</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="temporadas-dropdown">
                        ${serie.temporadas.map((temp, index) => `
                            <div class="temporada-option ${index === 0 ? 'selected' : ''}" data-temporada="${temp.numero}">
                                <span>Temporada ${temp.numero}</span>
                                <i class="fas ${index === 0 ? 'fa-check' : ''}"></i>
                            </div>
                        `).join('')}
                    </div>
                `;
                temporadasContainer.appendChild(temporadaSelector);

                // Manejar eventos del selector
                const temporadaActual = temporadaSelector.querySelector('.temporada-actual');
                const temporadasDropdown = temporadaSelector.querySelector('.temporadas-dropdown');
                const temporadaOptions = temporadaSelector.querySelectorAll('.temporada-option');

                temporadaActual.addEventListener('click', () => {
                    temporadasDropdown.classList.toggle('active');
                });

                // Cerrar dropdown al hacer clic fuera
                document.addEventListener('click', (e) => {
                    if (!temporadaSelector.contains(e.target)) {
                        temporadasDropdown.classList.remove('active');
                    }
                });

                temporadaOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        const tempNumero = option.dataset.temporada;
                        
                        // Actualizar selector
                        temporadaActual.querySelector('span').textContent = `Temporada ${tempNumero}`;
                        temporadaOptions.forEach(opt => {
                            opt.classList.remove('selected');
                            opt.querySelector('i').className = 'fas';
                        });
                        option.classList.add('selected');
                        option.querySelector('i').className = 'fas fa-check';
                        
                        // Mostrar temporada seleccionada
                        document.querySelectorAll('.temporada').forEach(temp => {
                            temp.classList.remove('active');
                        });
                        document.querySelector(`.temporada[data-numero="${tempNumero}"]`).classList.add('active');
                        
                        temporadasDropdown.classList.remove('active');
                    });
                });
            }

            // Crear contenedor de temporadas
            serie.temporadas.forEach((temporada, index) => {
                const temporadaElement = document.createElement('div');
                temporadaElement.className = `temporada ${index === 0 ? 'active' : ''}`;
                temporadaElement.setAttribute('data-numero', temporada.numero);
                
                temporadaElement.innerHTML = `
                    ${window.innerWidth < 769 ? `
                        <div class="temporada-titulo">
                            Temporada ${temporada.numero}
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    ` : ''}
                    <div class="episodios" style="${window.innerWidth < 769 ? 'display: none;' : ''}">
                        ${temporada.episodios.map(episodio => {
                            const estaVisto = esCapituloVisto(serie.id, temporada.numero, episodio.numero);
                            return `
                                <div class="episodio ${estaVisto ? 'visto' : ''}" data-url="${episodio.url}" 
                                     data-serie="${serie.id}" 
                                     data-temporada="${temporada.numero}" 
                                     data-episodio="${episodio.numero}">
                                    <div class="episodio-thumbnail-container">
                                        <div class="episodio-numero">${episodio.numero}</div>
                                        <div class="episodio-thumbnail">
                                            <img src="${episodio.imagen || serie.imagen}" alt="Episodio ${episodio.numero}">
                                        </div>
                                    </div>
                                    <div class="episodio-contenido">
                                        <div class="episodio-titulo">${episodio.titulo}</div>
                                        <div class="episodio-descripcion">${episodio.descripcion}</div>
                                    </div>
                                    <div class="episodio-visto ${estaVisto ? 'visto' : ''}" 
                                         title="Marcar como visto">
                                        <i class="fas fa-check"></i>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;

                // Solo agregar eventos de expansión para móvil
                if (window.innerWidth < 769) {
                    const tituloTemporada = temporadaElement.querySelector('.temporada-titulo');
                    tituloTemporada.addEventListener('click', () => {
                        const episodios = temporadaElement.querySelector('.episodios');
                        const estaActivo = temporadaElement.classList.contains('active');
                        
                        // Cerrar todas las temporadas
                        document.querySelectorAll('.temporada').forEach(t => {
                            t.classList.remove('active');
                            t.querySelector('.episodios').style.display = 'none';
                        });

                        // Abrir/cerrar la temporada actual
                        if (!estaActivo) {
                            temporadaElement.classList.add('active');
                            episodios.style.display = 'block';
                        }
                    });
                }

                temporadasContainer.appendChild(temporadaElement);
            });

            // Función para reproducir automáticamente el primer capítulo en PC
            function reproducirPrimerCapitulo() {
                if (window.innerWidth >= 769) { // Solo en PC
                    const primeraTemporada = serie.temporadas[0];
                    if (primeraTemporada && primeraTemporada.episodios.length > 0) {
                        const primerEpisodio = primeraTemporada.episodios[0];
                        const episodioElement = document.querySelector(`.episodio[data-episodio="1"]`);
                        
                        if (episodioElement) {
                            // Abrir la primera temporada
                            const temporadaElement = episodioElement.closest('.temporada');
                            temporadaElement.classList.add('active');
                            temporadaElement.querySelector('.episodios').style.display = 'block';
                            
                            // Reproducir el primer episodio
                            const videoUrl = episodioElement.getAttribute('data-url');
                            const episodioPlayer = document.getElementById('episodio-player');
                            const episodiosPlayer = document.getElementById('episodios-player');
                            const btnReconectar = document.getElementById('btnReconectar');
                            const btnAnterior = document.getElementById('btnAnterior');
                            const btnSiguiente = document.getElementById('btnSiguiente');
                            
                            // Silenciar el trailer
                            muteTrailer();
                            
                            episodioPlayer.src = videoUrl;
                            episodiosPlayer.classList.add('active');
                            btnReconectar.style.display = 'flex';
                            btnAnterior.style.display = 'flex';
                            btnSiguiente.style.display = 'flex';
                            
                            // Agregar clase para el diseño lateral
                            container.classList.add('con-diseno-lateral');
                            
                            // Marcar como playing
                            episodioElement.classList.add('playing');
                            
                            // Configurar el botón de reconexión
                            btnReconectar.onclick = () => {
                                const srcActual = episodioPlayer.src;
                                episodioPlayer.src = '';
                                setTimeout(() => {
                                    episodioPlayer.src = srcActual;
                                }, 100);
                            };

                            // Configurar botones de navegación
                            btnAnterior.onclick = () => {
                                const episodioActual = document.querySelector('.episodio.playing');
                                const episodioAnterior = episodioActual.previousElementSibling;
                                if (episodioAnterior && episodioAnterior.classList.contains('episodio')) {
                                    episodioAnterior.click();
                                }
                            };

                            btnSiguiente.onclick = () => {
                                const episodioActual = document.querySelector('.episodio.playing');
                                const episodioSiguiente = episodioActual.nextElementSibling;
                                if (episodioSiguiente && episodioSiguiente.classList.contains('episodio')) {
                                    episodioSiguiente.click();
                                }
                            };
                        }
                    }
                }
            }

            // Llamar a la función después de un breve retraso para asegurar que todo esté cargado
            setTimeout(reproducirPrimerCapitulo, 500);

            // Modificar el manejo de click en episodios
            document.querySelectorAll('.episodio').forEach(episodio => {
                episodio.addEventListener('click', (e) => {
                    if (!e.target.closest('.episodio-visto')) {
                        const videoUrl = episodio.getAttribute('data-url');
                        const episodioPlayer = document.getElementById('episodio-player');
                        const episodiosPlayer = document.getElementById('episodios-player');
                        const btnReconectar = document.getElementById('btnReconectar');
                        const btnAnterior = document.getElementById('btnAnterior');
                        const btnSiguiente = document.getElementById('btnSiguiente');
                        const container = document.querySelector('.container');

                        // Silenciar el trailer cuando se reproduce un episodio
                        muteTrailer();

                        episodioPlayer.src = videoUrl;
                        episodiosPlayer.classList.add('active');
                        btnReconectar.style.display = 'flex';
                        btnAnterior.style.display = 'flex';
                        btnSiguiente.style.display = 'flex';
                        
                        // Agregar clase para el diseño lateral
                        container.classList.add('con-diseno-lateral');

                        // Desplazamiento suave hacia el reproductor
                        episodiosPlayer.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start'
                        });

                        // Configurar el botón de reconexión y navegación
                        btnReconectar.onclick = () => {
                            const srcActual = episodioPlayer.src;
                            episodioPlayer.src = '';
                            setTimeout(() => {
                                episodioPlayer.src = srcActual;
                            }, 100);
                        };

                        // Configurar botones de navegación
                        btnAnterior.onclick = () => {
                            const episodioActual = document.querySelector('.episodio.playing');
                            const episodioAnterior = episodioActual.previousElementSibling;
                            if (episodioAnterior && episodioAnterior.classList.contains('episodio')) {
                                episodioAnterior.click();
                            }
                        };

                        btnSiguiente.onclick = () => {
                            const episodioActual = document.querySelector('.episodio.playing');
                            const episodioSiguiente = episodioActual.nextElementSibling;
                            if (episodioSiguiente && episodioSiguiente.classList.contains('episodio')) {
                                episodioSiguiente.click();
                            }
                        };

                        // Marcar como visto después de 30 segundos
                        setTimeout(() => {
                            const serieId = episodio.dataset.serie;
                            const temporadaNum = episodio.dataset.temporada;
                            const episodioNum = episodio.dataset.episodio;
                            
                            const estaVisto = toggleCapituloVisto(serieId, temporadaNum, episodioNum);
                            episodio.classList.add('visto');
                            episodio.querySelector('.episodio-visto').classList.add('visto');
                        }, 30000);

                        // Remover la clase 'playing' de todos los episodios
                        document.querySelectorAll('.episodio').forEach(ep => ep.classList.remove('playing'));
                        
                        // Agregar la clase 'playing' al episodio actual
                        episodio.classList.add('playing');
                    }
                });
            });
        }

        // Inicializar cuando se carga la página
        document.addEventListener('DOMContentLoaded', () => {
            inicializarSistemaVistas();
            const serieSeleccionada = JSON.parse(localStorage.getItem('serieSeleccionada'));
            if (serieSeleccionada) {
                cargarInformacionSerie(serieSeleccionada);
            }
        });

        function mostrarModalEnProceso(serie) {
            // Crear el modal
            const modalHTML = `
                <div class="modal-overlay" id="modal-en-proceso">
                    <div class="modal-content">
                        <div class="modal-header">
                            <i class="fas fa-clock-rotate-left fa-2x"></i>
                            <h3>¡Contenido en actualización!</h3>
                        </div>
                        <div class="modal-body">
                            <div class="progress-ring">
                                <div class="progress-circle"></div>
                            </div>
                            <p class="modal-title">¡Grandes noticias para los fans de ${serie.titulo}!</p>
                            <p class="modal-message">Estamos trabajando para traerte todos los episodios de esta increíble serie. Mientras tanto, ya puedes disfrutar de los capítulos disponibles.</p>
                            <div class="modal-status">
                                <div class="status-item">
                                    <i class="fas fa-check-circle"></i>
                                    <span>Capítulos disponibles listos para ver</span>
                                </div>
                                <div class="status-item">
                                    <i class="fas fa-spinner fa-spin"></i>
                                    <span>Nuevos episodios en proceso</span>
                                </div>
                            </div>
                        </div>
                        <button class="modal-close">Entendido</button>
                    </div>
                </div>
            `;

            // Insertar el modal en el documento
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Añadir estilos
            const style = document.createElement('style');
            style.textContent = `
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    animation: fadeIn 0.3s ease;
                }

                .modal-content {
                    background: linear-gradient(145deg, #1a1a1a, #000000);
                    border: 2px solid var(--primary-color);
                    border-radius: 20px;
                    padding: 30px;
                    max-width: 500px;
                    width: 90%;
                    position: relative;
                    box-shadow: 0 0 30px rgba(0, 255, 255, 0.2);
                    animation: slideIn 0.3s ease;
                }

                .modal-header {
                    text-align: center;
                    margin-bottom: 20px;
                    color: var(--primary-color);
                }

                .modal-header i {
                    margin-bottom: 15px;
                    animation: pulse 2s infinite;
                }

                .modal-header h3 {
                    font-size: 1.8em;
                    margin: 10px 0;
                }

                .modal-body {
                    text-align: center;
                }

                .modal-title {
                    color: var(--secondary-color);
                    font-size: 1.2em;
                    font-weight: bold;
                    margin: 15px 0;
                }

                .modal-message {
                    color: rgba(255, 255, 255, 0.8);
                    line-height: 1.6;
                    margin-bottom: 20px;
                }

                .modal-status {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 10px;
                    padding: 15px;
                    margin: 20px 0;
                }

                .status-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 10px 0;
                    color: var(--secondary-color);
                }

                .status-item i {
                    color: var(--primary-color);
                }

                .modal-close {
                    background: var(--primary-color);
                    color: var(--background-color);
                    border: none;
                    padding: 12px 30px;
                    border-radius: 25px;
                    font-size: 1.1em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: block;
                    margin: 20px auto 0;
                }

                .modal-close:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 255, 255, 0.3);
                }

                .progress-ring {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    border: 3px solid rgba(0, 255, 255, 0.1);
                    position: relative;
                    margin: 0 auto 20px;
                }

                .progress-circle {
                    position: absolute;
                    top: -3px;
                    left: -3px;
                    right: -3px;
                    bottom: -3px;
                    border-radius: 50%;
                    border: 3px solid transparent;
                    border-top-color: var(--primary-color);
                    animation: spin 1s linear infinite;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);

            // Añadir funcionalidad para cerrar el modal
            const modal = document.getElementById('modal-en-proceso');
            const closeButton = modal.querySelector('.modal-close');
            
            closeButton.addEventListener('click', () => {
                modal.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => modal.remove(), 300);
            });
        }

        // Modificar la URL del video para incluir la API de YouTube
        function getYouTubeEmbedUrl(url) {
            if (url.includes('youtube.com')) {
                // Agregar enablejsapi=1 para permitir el control mediante la API
                return url + '?enablejsapi=1&autoplay=1&controls=0&showinfo=0&rel=0&loop=1&playlist=' + 
                    url.split('/').pop();
            }
            return url;
        }

        // Cargar la API de YouTube
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }