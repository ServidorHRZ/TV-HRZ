window.addEventListener('load', () => {
    const peliculaSeleccionada = JSON.parse(localStorage.getItem('peliculaSeleccionada'));
    
    if (peliculaSeleccionada) {
        // Función para actualizar la información en ambos layouts
        const updateLayouts = () => {
            // Actualizar layout PC
            document.getElementById('movie-title-pc').textContent = peliculaSeleccionada.titulo;
            document.getElementById('movie-description-pc').textContent = peliculaSeleccionada.descripcion || 'Descripción no disponible.';
            document.getElementById('movie-poster-pc').src = peliculaSeleccionada.imagen;
            document.getElementById('movie-poster-pc').alt = peliculaSeleccionada.titulo;

            // Insertar el reproductor en PC
            const playerWrapperPC = document.getElementById('player-wrapper-pc');
            playerWrapperPC.innerHTML = `
                <iframe 
                    src="${peliculaSeleccionada.enlace}"
                    allowfullscreen
                    allow="autoplay; fullscreen; encrypted-media"
                    webkitallowfullscreen 
                    mozallowfullscreen
                    sandbox="allow-same-origin allow-scripts"
                    scrolling="no"
                    style="border: none;">
                </iframe>
            `;

            // Configurar el botón de trailer para PC
            const trailerButtonPC = document.getElementById('trailerButton-pc');
            if (peliculaSeleccionada.trailer && trailerButtonPC) {
                trailerButtonPC.style.display = 'flex';
                trailerButtonPC.innerHTML = `
                    <i class="fas fa-play"></i>
                    <span>TRAILER</span>
                `;
                
                trailerButtonPC.addEventListener('click', () => {
                    // Mostrar el modal
                    const trailerModal = document.getElementById('trailerModal');
                    const trailerModalTitle = document.getElementById('trailerModalTitle');
                    const trailerModalContainer = document.getElementById('trailerContainer');
                    
                    trailerModal.classList.add('show');
                    trailerModalTitle.textContent = `Trailer - ${peliculaSeleccionada.titulo}`;
                    
                    // Insertar el trailer
                    trailerModalContainer.innerHTML = `
                        <iframe 
                            src="${peliculaSeleccionada.trailer}?autoplay=1&mute=0"
                            allowfullscreen
                            allow="autoplay; fullscreen"
                            style="border: none;">
                        </iframe>
                    `;
                    
                    // Prevenir scroll del body
                    document.body.style.overflow = 'hidden';
                });
            } else if (trailerButtonPC) {
                trailerButtonPC.style.display = 'none';
            }

            // Cargar y mostrar recomendaciones desde Firestore
            const cargarRecomendaciones = async () => {
                try {
                    // Intentar cargar desde Firestore primero
                    let todasLasPeliculas = [];
                    
                    if (window.firestorePeliculas && window.firestorePeliculas.cargarPeliculasDesdeFirestore) {
                        todasLasPeliculas = await window.firestorePeliculas.cargarPeliculasDesdeFirestore();
                    }
                    
                    // Si no hay películas desde Firestore, intentar desde JSON como fallback
                    if (todasLasPeliculas.length === 0) {
                        console.log('Fallback: Cargando recomendaciones desde JSON');
                        const response = await fetch('../DataBase/peliculas.json');
                        const data = await response.json();
                        todasLasPeliculas = data.peliculas;
                    }
                    
                    // Filtrar películas del mismo género
                    const peliculasSimilares = todasLasPeliculas
                        .filter(p => {
                            // Verificar si hay géneros en común
                            return p.id !== peliculaSeleccionada.id && // Excluir la película actual
                                   p.disponible && // Solo películas disponibles
                                   Array.isArray(p.genero) && 
                                   Array.isArray(peliculaSeleccionada.genero) &&
                                   p.genero.some(g => peliculaSeleccionada.genero.includes(g));
                        })
                        .slice(0, 7); // 7 recomendaciones en una sola fila

                    const recomendacionesContainer = document.getElementById('recommendations-container');
                    if (peliculasSimilares.length > 0) {
                        recomendacionesContainer.innerHTML = peliculasSimilares
                            .map(pelicula => `
                                <div class="recommendation-item" data-pelicula-id="${pelicula.id}">
                                    <img src="${pelicula.imagen}" alt="${pelicula.titulo}" loading="lazy">
                                    <div class="recommendation-title">${pelicula.titulo}</div>
                                </div>
                            `).join('');

                        // Agregar event listeners después de crear los elementos
                        recomendacionesContainer.querySelectorAll('.recommendation-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const peliculaId = item.dataset.peliculaId;
                                const peliculaSeleccionada = todasLasPeliculas.find(p => p.id === parseInt(peliculaId));
                                if (peliculaSeleccionada) {
                                    localStorage.setItem('peliculaSeleccionada', JSON.stringify(peliculaSeleccionada));
                                    window.location.reload();
                                }
                            });
                        });
                    } else {
                        // Si no hay películas similares, mostrar películas aleatorias
                        const peliculasAleatorias = todasLasPeliculas
                            .filter(p => p.id !== peliculaSeleccionada.id && p.disponible)
                            .sort(() => Math.random() - 0.5)
                            .slice(0, 7);

                        recomendacionesContainer.innerHTML = peliculasAleatorias
                            .map(pelicula => `
                                <div class="recommendation-item" data-pelicula-id="${pelicula.id}">
                                    <img src="${pelicula.imagen}" alt="${pelicula.titulo}" loading="lazy">
                                    <div class="recommendation-title">${pelicula.titulo}</div>
                                </div>
                            `).join('');

                        // Agregar event listeners después de crear los elementos
                        recomendacionesContainer.querySelectorAll('.recommendation-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const peliculaId = item.dataset.peliculaId;
                                const peliculaSeleccionada = todasLasPeliculas.find(p => p.id === parseInt(peliculaId));
                                if (peliculaSeleccionada) {
                                    localStorage.setItem('peliculaSeleccionada', JSON.stringify(peliculaSeleccionada));
                                    window.location.reload();
                                }
                            });
                        });
                    }
                } catch (error) {
                    console.error('Error al cargar las recomendaciones:', error);
                    document.getElementById('recommendations-container').innerHTML = '<p>Error al cargar las recomendaciones</p>';
                }
            };

            // Ejecutar la función de cargar recomendaciones
            cargarRecomendaciones();

            // Actualizar layout móvil
            document.getElementById('movie-title').textContent = peliculaSeleccionada.titulo;
            document.getElementById('movie-year').textContent = peliculaSeleccionada.año;
            document.getElementById('movie-description').textContent = peliculaSeleccionada.descripcion || 'Descripción no disponible.';
            document.getElementById('movie-poster').src = peliculaSeleccionada.imagen;
            document.getElementById('movie-poster').alt = peliculaSeleccionada.titulo;

            // Insertar el reproductor en móvil
            const playerWrapperMobile = document.getElementById('player-wrapper');
            playerWrapperMobile.innerHTML = `
                <iframe 
                    src="${peliculaSeleccionada.enlace}"
                    allowfullscreen
                    allow="autoplay; fullscreen; encrypted-media"
                    webkitallowfullscreen 
                    mozallowfullscreen
                    sandbox="allow-same-origin allow-scripts"
                    scrolling="no"
                    style="border: none;">
                </iframe>
            `;

            // Configurar botones de Mi Lista
            const setupMiListaButton = (buttonId, isPC = false) => {
                const button = document.getElementById(buttonId);
                if (!button) return;

                // Verificar si la película está en Mi Lista
                const miLista = JSON.parse(localStorage.getItem('miListaPeliculas') || '[]');
                const estaEnLista = miLista.some(p => p.id === peliculaSeleccionada.id);

                // Actualizar estado visual del botón
                button.classList.toggle('en-lista', estaEnLista);
                
                if (isPC) {
                    // Para PC: con iconos también
                    button.innerHTML = `
                        <i class="fas ${estaEnLista ? 'fa-check' : 'fa-plus'}"></i>
                        <span>${estaEnLista ? 'EN MI LISTA' : 'MI LISTA'}</span>
                    `;
                } else {
                    // Para móvil: con iconos
                    button.innerHTML = `
                        <i class="fas ${estaEnLista ? 'fa-check' : 'fa-plus'}"></i>
                        <span>${estaEnLista ? 'En mi lista' : 'Mi lista'}</span>
                    `;
                }

                // Agregar event listener
                button.onclick = () => {
                    const miLista = JSON.parse(localStorage.getItem('miListaPeliculas') || '[]');
                    const index = miLista.findIndex(p => p.id === peliculaSeleccionada.id);

                    if (index === -1) {
                        // Agregar a la lista
                        miLista.push(peliculaSeleccionada);
                        button.classList.add('en-lista');
                        
                        if (isPC) {
                            button.innerHTML = `
                                <i class="fas fa-check"></i>
                                <span>EN MI LISTA</span>
                            `;
                        } else {
                            button.innerHTML = `
                                <i class="fas fa-check"></i>
                                <span>En mi lista</span>
                            `;
                        }
                    } else {
                        // Quitar de la lista
                        miLista.splice(index, 1);
                        button.classList.remove('en-lista');
                        
                        if (isPC) {
                            button.innerHTML = `
                                <i class="fas fa-plus"></i>
                                <span>MI LISTA</span>
                            `;
                        } else {
                            button.innerHTML = `
                                <i class="fas fa-plus"></i>
                                <span>Mi lista</span>
                            `;
                        }
                    }

                    localStorage.setItem('miListaPeliculas', JSON.stringify(miLista));
                };
            };

            // Configurar botones para PC y móvil
            setupMiListaButton('likeButton-pc', true); // PC version
            setupMiListaButton('likeButton', false);   // Mobile version

            // Configurar el botón de trailer para móvil
            const trailerButton = document.getElementById('trailerButton');
            const trailerModal = document.getElementById('trailerModal');
            const closeTrailerModal = document.getElementById('closeTrailerModal');
            const trailerModalContainer = document.getElementById('trailerContainer');
            const trailerModalTitle = document.getElementById('trailerModalTitle');

            if (trailerButton && peliculaSeleccionada.trailer) {
                trailerButton.style.display = 'flex';
                
                trailerButton.addEventListener('click', () => {
                    // Mostrar el modal
                    trailerModal.classList.add('show');
                    trailerModalTitle.textContent = `Trailer - ${peliculaSeleccionada.titulo}`;
                    
                    // Insertar el trailer
                    trailerModalContainer.innerHTML = `
                        <iframe 
                            src="${peliculaSeleccionada.trailer}?autoplay=1&mute=0"
                            allowfullscreen
                            allow="autoplay; fullscreen"
                            style="border: none;">
                        </iframe>
                    `;
                    
                    // Prevenir scroll del body
                    document.body.style.overflow = 'hidden';
                });

                // Cerrar modal
                const closeModal = () => {
                    trailerModal.classList.remove('show');
                    trailerModalContainer.innerHTML = ''; // Detener el video
                    document.body.style.overflow = 'auto';
                };

                closeTrailerModal.addEventListener('click', closeModal);

                // Cerrar modal al hacer clic fuera del contenido
                trailerModal.addEventListener('click', (e) => {
                    if (e.target === trailerModal) {
                        closeModal();
                    }
                });

                // Cerrar modal con la tecla Escape
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && trailerModal.classList.contains('show')) {
                        closeModal();
                    }
                });
            } else {
                // Ocultar el botón si no hay trailer
                if (trailerButton) {
                    trailerButton.style.display = 'none';
                }
            }
        };

        updateLayouts();

        // Manejar el botón de reconexión para PC
        const btnReconectarPC = document.getElementById('btnReconectar-pc');
        btnReconectarPC.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>REINTENTAR CONEXION</span>
        `;
        
        btnReconectarPC.addEventListener('click', () => {
            const iframe = document.querySelector('#player-wrapper-pc iframe');
            if (iframe) {
                const srcActual = iframe.src;
                iframe.src = '';
                setTimeout(() => {
                    iframe.src = srcActual;
                }, 100);
            }
        });

        // Manejar el botón de reconexión para móvil
        document.getElementById('btnReconectar').addEventListener('click', () => {
            const iframe = document.querySelector('#player-wrapper iframe');
            if (iframe) {
                const srcActual = iframe.src;
                iframe.src = '';
                setTimeout(() => {
                    iframe.src = srcActual;
                }, 100);
            }
        });

        // Función para seleccionar y reproducir una película
        window.seleccionarPelicula = (pelicula) => {
            try {
                localStorage.setItem('peliculaSeleccionada', JSON.stringify(pelicula));
                window.location.reload();
            } catch (error) {
                console.error('Error al seleccionar la película:', error);
            }
        };
    } else {
        alert('No se ha seleccionado ninguna película');
        window.location.href = 'Peliculas.html';
    }
});