class GitHubAPI {
    constructor() {
        // Token de acceso personal de GitHub
        this.token = localStorage.getItem('github_token');
        this.baseUrl = 'https://api.github.com';
        this.owner = 'ServidorHRZ';
        this.repo = 'TV-HRZ';
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    getHeaders() {
        return {
            'Authorization': 'Basic ' + btoa(this.token + ':x-oauth-basic'),
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'TV-HRZ-Admin',
            'Content-Type': 'application/json'
        };
    }

    async getContents(path) {
        return this.retryOperation(async () => {
            try {
                console.log('Intentando obtener contenido de:', path);
                const response = await fetch(`${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${path}`, {
                    method: 'GET',
                    headers: this.getHeaders()
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Error Response:', {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                        errorData: errorData
                    });
                    throw new Error(`GitHub API error: ${response.status} - ${errorData.message || response.statusText}`);
                }

                const data = await response.json();
                console.log('Contenido obtenido correctamente');
                const content = decodeURIComponent(escape(atob(data.content)));
                return {
                    content: content,
                    sha: data.sha
                };
            } catch (error) {
                console.error('Error detallado al obtener contenido:', error);
                throw error;
            }
        });
    }

    async updateFile(path, content, sha) {
        return this.retryOperation(async () => {
            try {
                console.log('Intentando actualizar archivo:', path);
                const encodedContent = btoa(unescape(encodeURIComponent(content)));

                const response = await fetch(`${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${path}`, {
                    method: 'PUT',
                    headers: this.getHeaders(),
                    body: JSON.stringify({
                        message: `Actualización de ${path} - ${new Date().toISOString()}`,
                        content: encodedContent,
                        sha: sha
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Error Response:', {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                        errorData: errorData
                    });
                    throw new Error(`GitHub API error: ${response.status} - ${errorData.message || response.statusText}`);
                }

                console.log('Archivo actualizado correctamente');
                return await response.json();
            } catch (error) {
                console.error('Error detallado al actualizar archivo:', error);
                throw error;
            }
        });
    }

    async retryOperation(operation, retries = this.maxRetries) {
        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.error(`Intento ${i + 1} fallido:`, error);
                
                if (error.message && error.message.includes('401')) {
                    console.error('Error de autenticación. Detalles completos:', error);
                    throw new Error('Error de autenticación. Verifica el token de acceso.');
                }
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
            }
        }
        throw lastError;
    }
}

class AdminPanel {
    constructor() {
        this.github = new GitHubAPI();
        this.peliculas = [];
        this.series = [];
        this.seccionActual = 'dashboard';
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.currentTemporada = 1;
    }

    async init() {
        try {
            await this.checkAuth();
            await this.cargarDatos();
            this.setupEventListeners();
            this.actualizarEstadisticas();
            this.cambiarSeccion('dashboard');
            this.setupFormularios();
        } catch (error) {
            console.error('Error en la inicialización:', error);
            throw error;
        }
    }

    async checkAuth() {
        const adminUser = localStorage.getItem('admin_user');
        
        if (!adminUser) {
            // No hay sesión de administrador, redirigir a la página principal
            this.redirectToHome();
            return;
        }
        
        try {
            const userData = JSON.parse(adminUser);
            const validRoles = ['administrador', 'propietario'];
            
            if (!validRoles.includes(userData.rol)) {
                // El usuario no tiene un rol válido
                this.redirectToHome();
            }
            
            // Si llega hasta aquí, el usuario está autenticado correctamente
            console.log('Usuario autenticado:', userData.usuario);
        } catch (error) {
            console.error('Error al verificar autenticación:', error);
            this.redirectToHome();
        }
    }

    redirectToHome() {
        alert('Acceso no autorizado. Debes iniciar sesión como administrador.');
        window.location.href = '../index.html';
    }

    async cargarDatos() {
        try {
            // Cargar películas
            const peliculasData = await this.github.getContents('DataBase/peliculas.json');
            const peliculasJson = JSON.parse(peliculasData.content);
            this.peliculas = peliculasJson.peliculas || [];

            // Cargar series
            const seriesData = await this.github.getContents('DataBase/series.json');
            const seriesJson = JSON.parse(seriesData.content);
            this.series = seriesJson.series || [];

            this.actualizarTablas();
            this.actualizarEstadisticas();
        } catch (error) {
            console.error('Error al cargar datos:', error);
            mostrarError('Error al cargar los datos: ' + error.message);
            throw error;
        }
    }

    setupEventListeners() {
        // Navegación
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const seccion = e.currentTarget.getAttribute('href').substring(1);
                this.cambiarSeccion(seccion);
            });
        });

        // Formulario de configuración
        const configForm = document.getElementById('config-form');
        if (configForm) {
            configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const token = document.getElementById('github-token').value;
                if (token) {
                    localStorage.setItem('github_token', token);
                    location.reload();
                }
            });
        }
    }

    setupFormularios() {
        // Configurar formulario de películas
        const peliculaForm = document.getElementById('peliculaForm');
        if (peliculaForm) {
            peliculaForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.guardarPelicula();
            });
        }

        // Configurar formulario de series
        const serieForm = document.getElementById('serieForm');
        if (serieForm) {
            serieForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.guardarSerie();
            });
        }

        // Configurar formulario de episodios
        const episodioForm = document.getElementById('episodioForm');
        if (episodioForm) {
            episodioForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.guardarEpisodio(e);
            });
        }

        // Configurar botones de agregar
        const btnAgregarPelicula = document.querySelector('[onclick="mostrarModalAgregar(\'pelicula\')"]');
        if (btnAgregarPelicula) {
            btnAgregarPelicula.onclick = () => this.mostrarModalPelicula();
        }

        const btnAgregarSerie = document.querySelector('[onclick="mostrarModalAgregar(\'serie\')"]');
        if (btnAgregarSerie) {
            btnAgregarSerie.onclick = () => this.mostrarModalSerie();
        }
    }

    mostrarModalPelicula(pelicula = null) {
        const modal = document.getElementById('peliculaModal');
        const form = document.getElementById('peliculaForm');
        const titulo = document.getElementById('modalTitle');
        const imagenPreview = document.getElementById('imagenPreview');

        // Función para actualizar la vista previa
        const actualizarVistaPrevia = (url) => {
            imagenPreview.src = url || 'https://via.placeholder.com/300x450/000000/00ffff?text=Vista+Previa';
        };

        // Event listener para la URL de la imagen
        form.imagen.addEventListener('input', (e) => {
            actualizarVistaPrevia(e.target.value);
        });

        // Desmarcar todos los géneros
        form.querySelectorAll('input[name="genero"]').forEach(checkbox => {
            checkbox.checked = false;
        });

        if (pelicula) {
            titulo.textContent = 'Editar Película';
            form.titulo.value = pelicula.titulo || '';
            form.imagen.value = pelicula.imagen || '';
            form.enlace.value = pelicula.enlace || '';
            form.trailer.value = pelicula.trailer || '';
            form.anio.value = pelicula.año || '';
            form.descripcion.value = pelicula.descripcion || '';
            form.disponible.checked = pelicula.disponible !== false;
            form.nuevo.checked = pelicula.nuevo === true;
            form.querySelector('#peliculaId').value = pelicula.id;
            
            // Marcar los géneros correspondientes
            if (Array.isArray(pelicula.genero)) {
                pelicula.genero.forEach(genero => {
                    const checkbox = form.querySelector(`input[name="genero"][value="${genero}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            
            actualizarVistaPrevia(pelicula.imagen);
        } else {
            titulo.textContent = 'Agregar Película';
            form.reset();
            form.querySelector('#peliculaId').value = '';
            actualizarVistaPrevia();
        }

        modal.style.display = 'flex';
    }

    cerrarModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Función para convertir URL de YouTube al formato embed
    convertirURLYoutube(url) {
        if (!url) return '';
        
        // Patrones de URLs de YouTube
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/
        ];

        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return `https://www.youtube.com/embed/${match[1]}`;
            }
        }

        return url; // Retornar la URL original si no es de YouTube
    }

    async guardarPelicula() {
        try {
            const form = document.getElementById('peliculaForm');
            const peliculaId = form.querySelector('#peliculaId').value;
            
            // Obtener géneros seleccionados
            const generosSeleccionados = Array.from(form.querySelectorAll('input[name="genero"]:checked'))
                .map(checkbox => checkbox.value);

            // Encontrar el ID más alto actual y sumar 1 para el nuevo ID
            const nuevoId = peliculaId ? parseInt(peliculaId) : Math.max(0, ...this.peliculas.map(p => p.id)) + 1;

            const nuevaPelicula = {
                id: nuevoId,
                titulo: form.titulo.value.trim(),
                disponible: form.disponible.checked,
                nuevo: form.nuevo.checked,
                badge: form.nuevo.checked ? "Recién agregado" : "",
                año: parseInt(form.anio.value),
                trailer: this.convertirURLYoutube(form.trailer.value.trim()),
                genero: generosSeleccionados,
                imagen: form.imagen.value.trim(),
                enlace: form.enlace.value.trim(),
                descripcion: form.descripcion.value.trim()
            };

            if (peliculaId) {
                // Actualizar película existente
                const index = this.peliculas.findIndex(p => p.id === parseInt(peliculaId));
                if (index !== -1) {
                    this.peliculas[index] = { ...this.peliculas[index], ...nuevaPelicula };
                }
            } else {
                // Agregar nueva película
                this.peliculas.push(nuevaPelicula);
            }

            await this.guardarPeliculas();
            this.actualizarTablas();
            this.cerrarModal('peliculaModal');
            this.mostrarNotificacion('Película guardada exitosamente', 'success');
        } catch (error) {
            console.error('Error al guardar película:', error);
            this.mostrarNotificacion('Error al guardar la película', 'error');
        }
    }

    async guardarPeliculas() {
        try {
            const peliculasData = await this.github.getContents('DataBase/peliculas.json');
            const content = JSON.stringify({ peliculas: this.peliculas }, null, 2);
            
            // Intentar actualizar el archivo
            await this.github.updateFile('DataBase/peliculas.json', content, peliculasData.sha);
            
            // Si la actualización fue exitosa, mostrar notificación
            this.mostrarNotificacion('Películas guardadas correctamente', 'success');
        } catch (error) {
            console.error('Error al guardar películas:', error);
            
            // Mostrar mensaje de error más descriptivo
            let mensajeError = 'Error al guardar las películas';
            if (error.message.includes('409')) {
                mensajeError = 'El archivo fue modificado por otro usuario. Intentando de nuevo...';
                // Reintentar automáticamente en caso de conflicto
                try {
                    await this.cargarDatos();
                    await this.guardarPeliculas();
                    return;
                } catch (retryError) {
                    mensajeError = 'No se pudo guardar después de reintentar. Por favor, intenta de nuevo.';
                }
            }
            
            this.mostrarNotificacion(mensajeError, 'error');
            throw error;
        }
    }

    async guardarSerie() {
        try {
            const form = document.getElementById('serieForm');
            const serieId = form.querySelector('#serieId').value;
            
            // Si estamos editando, obtener la serie existente
            let serieExistente = null;
            if (serieId) {
                serieExistente = this.series.find(s => s.id === parseInt(serieId));
            }
            
            // Obtener géneros seleccionados
            const generosSeleccionados = Array.from(form.querySelectorAll('input[name="serieGenero"]:checked'))
                .map(checkbox => checkbox.value);
            
            // Encontrar el ID más alto actual y sumar 1 para el nuevo ID
            const nuevoId = serieId ? parseInt(serieId) : Math.max(0, ...this.series.map(s => s.id)) + 1;
            
            const nuevaSerie = {
                id: nuevoId,
                titulo: form.serieTitulo.value.trim(),
                imagen: form.serieImagen.value.trim(),
                trailer: this.convertirURLYoutube(form.serieTrailer.value.trim()),
                genero: generosSeleccionados,
                año: parseInt(form.serieAnio.value),
                descripcion: form.serieDescripcion.value.trim(),
                disponible: form.serieDisponible.checked,
                nuevo: form.serieNuevo.checked,
                badge: form.serieNuevo.checked ? "Recién agregado" : "",
                // Mantener campos adicionales si existen
                director: serieExistente?.director || "",
                actores: serieExistente?.actores || [],
                enProceso: serieExistente?.enProceso || false,
                temporadas: this.obtenerTemporadasDelFormulario()
            };

            if (serieId) {
                // Actualizar serie existente
                const index = this.series.findIndex(s => s.id === parseInt(serieId));
                if (index !== -1) {
                    // Combinar la serie existente con los nuevos datos
                    this.series[index] = { 
                        ...serieExistente,  // Mantener datos existentes
                        ...nuevaSerie       // Actualizar con nuevos datos
                    };
                }
            } else {
                // Agregar nueva serie
                this.series.push(nuevaSerie);
            }

            await this.guardarSeries();
            this.actualizarTablas();
            this.cerrarModal('serieModal');
            this.mostrarNotificacion('Serie guardada exitosamente', 'success');
        } catch (error) {
            console.error('Error al guardar serie:', error);
            this.mostrarNotificacion('Error al guardar la serie', 'error');
        }
    }

    obtenerTemporadasDelFormulario() {
        // Obtener las temporadas del contenedor de temporadas
        const temporadasContainer = document.getElementById('temporadasContainer');
        const temporadas = [];
        
        // Si no hay contenedor, retornar array vacío
        if (!temporadasContainer) return temporadas;
        
        // Obtener todas las temporadas del contenedor
        const temporadaElements = temporadasContainer.querySelectorAll('.temporada-card');
        
        temporadaElements.forEach((temporadaEl, index) => {
            const episodios = [];
            const episodioElements = temporadaEl.querySelectorAll('.episodio-item');
            
            episodioElements.forEach(episodioEl => {
                const episodioData = {
                    numero: parseInt(episodioEl.querySelector('.episodio-numero').textContent),
                    titulo: episodioEl.querySelector('.episodio-titulo').textContent,
                    duracion: episodioEl.querySelector('.episodio-duracion').textContent,
                    // Mantener los datos originales del episodio si existen
                    descripcion: episodioEl.dataset.descripcion || '',
                    url: episodioEl.dataset.url || ''
                };
                
                episodios.push(episodioData);
            });
            
            temporadas.push({
                numero: index + 1,
                episodios: episodios
            });
        });
        
        return temporadas;
    }

    renderizarEpisodios(episodios, temporadaNumero) {
        if (!Array.isArray(episodios)) return '';
        
        return episodios.map(episodio => `
            <div class="episodio-item" 
                 data-descripcion="${episodio.descripcion || ''}"
                 data-url="${episodio.url || ''}">
                <div class="episodio-info">
                    <span class="episodio-numero">${episodio.numero}</span>
                    <span class="episodio-titulo">${episodio.titulo}</span>
                    <span class="episodio-duracion">${episodio.duracion}</span>
                </div>
                <div class="episodio-actions">
                    <button type="button" class="action-btn" 
                            onclick="adminPanel.editarEpisodio(${temporadaNumero}, ${episodio.numero})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="action-btn" 
                            onclick="adminPanel.eliminarEpisodio(${temporadaNumero}, ${episodio.numero})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    actualizarTablas() {
        const handleImageError = (img) => {
            img.onerror = null; // Prevenir bucle infinito
            img.src = 'https://via.placeholder.com/300x450/000000/00ffff?text=Imagen+No+Disponible';
            console.error('Error al cargar la imagen:', img.dataset.originalSrc);
        };

        // Ordenar películas por ID descendente (más recientes primero)
        const peliculasOrdenadas = [...this.peliculas].sort((a, b) => b.id - a.id);
        
        // Ordenar series por ID descendente (más recientes primero)
        const seriesOrdenadas = [...this.series].sort((a, b) => b.id - a.id);

        // Actualizar grid de películas
        const peliculasGrid = document.getElementById('peliculas-grid');
        if (peliculasGrid && Array.isArray(this.peliculas)) {
            peliculasGrid.innerHTML = peliculasOrdenadas.map(pelicula => `
                <div class="movie-card">
                    <img src="${pelicula.imagen}" 
                         alt="${pelicula.titulo}" 
                         class="movie-thumbnail"
                         data-original-src="${pelicula.imagen}"
                         onerror="this.onerror=null;this.src='https://via.placeholder.com/300x450/000000/00ffff?text=Imagen+No+Disponible';">
                    <div class="movie-content">
                        <div class="movie-header">
                            <h3 class="movie-title">${pelicula.titulo || ''}</h3>
                            <span class="movie-year">${pelicula.año || ''}</span>
                        </div>
                        <div class="movie-genres">
                            ${Array.isArray(pelicula.genero) ? pelicula.genero.join(', ') : (pelicula.genero || '')}
                        </div>
                        <div class="movie-actions">
                            <div class="switch-container">
                                <label class="switch">
                                    <input type="checkbox" 
                                        ${pelicula.disponible ? 'checked' : ''} 
                                        onchange="adminPanel.togglePeliculaEstado(${pelicula.id}, this.checked)">
                                    <span class="slider"></span>
                                </label>
                                <span class="switch-label">${pelicula.disponible ? 'Activo' : 'Inactivo'}</span>
                            </div>
                            <div>
                                <button class="action-btn" onclick="adminPanel.editarPelicula(${pelicula.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Actualizar grid de series
        const seriesGrid = document.getElementById('series-grid');
        if (seriesGrid && Array.isArray(this.series)) {
            seriesGrid.innerHTML = seriesOrdenadas.map(serie => `
                <div class="movie-card">
                    <img src="${serie.imagen}" 
                         alt="${serie.titulo}" 
                         class="movie-thumbnail"
                         onerror="this.onerror=null;this.src='https://via.placeholder.com/300x450/000000/00ffff?text=Imagen+No+Disponible';">
                    <div class="movie-content">
                        <div class="movie-header">
                            <h3 class="movie-title">${serie.titulo || ''}</h3>
                            <span class="movie-year">${serie.año || ''}</span>
                        </div>
                        <div class="movie-genres">
                            ${Array.isArray(serie.genero) ? serie.genero.join(', ') : (serie.genero || '')}
                        </div>
                        <div class="movie-info">
                            <span class="temporadas-badge">
                                <i class="fas fa-layer-group"></i> ${serie.temporadas ? (Array.isArray(serie.temporadas) ? serie.temporadas.length : serie.temporadas) : '0'} Temporadas
                            </span>
                        </div>
                        <div class="movie-actions">
                            <div class="switch-container">
                                <label class="switch">
                                    <input type="checkbox" 
                                        ${serie.disponible ? 'checked' : ''} 
                                        onchange="adminPanel.toggleSerieEstado(${serie.id}, this.checked)">
                                    <span class="slider"></span>
                                </label>
                                <span class="switch-label">${serie.disponible ? 'Activo' : 'Inactivo'}</span>
                            </div>
                            <div>
                                <button class="action-btn" onclick="adminPanel.editarSerie(${serie.id})" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Actualizar estadísticas
        this.actualizarEstadisticas();
    }

    actualizarEstadisticas() {
        const stats = document.querySelectorAll('.stat-number');
        if (stats.length >= 2) {
            stats[0].textContent = Array.isArray(this.peliculas) ? this.peliculas.length : 0;
            stats[1].textContent = Array.isArray(this.series) ? this.series.length : 0;
        }
    }

    async editarPelicula(id) {
        const pelicula = this.peliculas.find(p => p.id === id);
        if (pelicula) {
            this.mostrarModalPelicula(pelicula);
        }
    }

    async eliminarPelicula(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta película?')) return;

        try {
            this.peliculas = this.peliculas.filter(p => p.id !== id);
            await this.guardarPeliculas();
            this.actualizarTablas();
            this.mostrarNotificacion('Película eliminada exitosamente', 'success');
        } catch (error) {
            console.error('Error al eliminar película:', error);
            this.mostrarNotificacion('Error al eliminar la película', 'error');
        }
    }

    mostrarNotificacion(mensaje, tipo) {
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${mensaje}</span>
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    cambiarSeccion(seccion) {
        // Ocultar todas las secciones
        document.querySelectorAll('.admin-section').forEach(s => {
            s.style.display = 'none';
        });
        
        // Mostrar la sección seleccionada
        const seccionElement = document.getElementById(seccion);
        if (seccionElement) {
            seccionElement.style.display = 'block';
            this.seccionActual = seccion;
            
            // Actualizar navegación
            document.querySelectorAll('.admin-nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('href') === `#${seccion}`) {
                    item.classList.add('active');
                }
            });
        }
    }

    async editarSerie(id) {
        const serie = this.series.find(s => s.id === id);
        if (serie) {
            this.mostrarModalSerie(serie);
        }
    }

    async eliminarSerie(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta serie?')) return;

        try {
            this.series = this.series.filter(s => s.id !== id);
            await this.guardarSeries();
            this.actualizarTablas();
            this.mostrarNotificacion('Serie eliminada exitosamente', 'success');
        } catch (error) {
            console.error('Error al eliminar serie:', error);
            this.mostrarNotificacion('Error al eliminar la serie', 'error');
        }
    }

    async guardarSeries() {
        try {
            // Intentar obtener el contenido actual y el SHA
            const seriesData = await this.github.getContents('DataBase/series.json');
            
            // Preparar el contenido actualizado
            const content = JSON.stringify({ series: this.series }, null, 2);
            
            // Intentar actualizar el archivo con reintentos automáticos
            await this.github.retryOperation(async () => {
                try {
                    // Obtener el SHA más reciente antes de cada intento
                    const currentData = await this.github.getContents('DataBase/series.json');
                    await this.github.updateFile('DataBase/series.json', content, currentData.sha);
                } catch (error) {
                    if (error.message && error.message.includes('409')) {
                        // Si hay conflicto, recargar los datos y reintentar
                        await this.cargarDatos();
                        throw error; // Relanzar el error para que retryOperation lo maneje
                    }
                    throw error;
                }
            });
        } catch (error) {
            console.error('Error al guardar series:', error);
            throw new Error(`Error al guardar series: ${error.message}`);
        }
    }

    mostrarModalSerie(serie = null) {
        const modal = document.getElementById('serieModal');
        const form = document.getElementById('serieForm');
        const titulo = document.getElementById('modalTitleSerie');
        const imagenPreview = document.getElementById('serieImagenPreview');

        // Función para actualizar la vista previa
        const actualizarVistaPrevia = (url) => {
            imagenPreview.src = url || 'https://via.placeholder.com/300x450/000000/00ffff?text=Vista+Previa';
        };

        // Event listener para la URL de la imagen
        form.serieImagen.addEventListener('input', (e) => {
            actualizarVistaPrevia(e.target.value);
        });

        // Desmarcar todos los géneros
        form.querySelectorAll('input[name="serieGenero"]').forEach(checkbox => {
            checkbox.checked = false;
        });

        if (serie) {
            titulo.textContent = 'Editar Serie';
            form.serieTitulo.value = serie.titulo || '';
            form.serieImagen.value = serie.imagen || '';
            form.serieTrailer.value = serie.trailer || '';
            form.serieAnio.value = serie.año || '';
            form.serieDescripcion.value = serie.descripcion || '';
            form.serieDisponible.checked = serie.disponible !== false;
            form.serieNuevo.checked = serie.nuevo === true;
            form.querySelector('#serieId').value = serie.id;
            
            // Marcar los géneros correspondientes
            if (Array.isArray(serie.genero)) {
                serie.genero.forEach(genero => {
                    const checkbox = form.querySelector(`input[name="serieGenero"][value="${genero}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            
            actualizarVistaPrevia(serie.imagen);
            this.cargarTemporadas(serie.temporadas || []);
        } else {
            titulo.textContent = 'Agregar Serie';
            form.reset();
            form.querySelector('#serieId').value = '';
            actualizarVistaPrevia();
            this.cargarTemporadas([]);
        }

        modal.style.display = 'flex';
    }

    cargarTemporadas(temporadas) {
        const container = document.getElementById('temporadasContainer');
        if (!container) return;

        container.innerHTML = temporadas.map((temporada, index) => `
            <div class="temporada-card" data-temporada="${index + 1}">
                <div class="temporada-header">
                    <h4 class="temporada-title">
                        <i class="fas fa-layer-group"></i> Temporada ${temporada.numero}
                    </h4>
                    <div class="temporada-actions">
                        <button type="button" class="btn btn-secondary btn-sm" 
                                onclick="adminPanel.agregarEpisodio(${temporada.numero})">
                            <i class="fas fa-plus"></i> Episodio
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" 
                                onclick="adminPanel.eliminarTemporada(${temporada.numero})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="episodios-list">
                    ${this.renderizarEpisodios(temporada.episodios || [], temporada.numero)}
                </div>
            </div>
        `).join('');
    }

    agregarTemporada() {
        const serieId = document.getElementById('serieId').value;
        if (!serieId) {
            this.mostrarNotificacion('Error: No se pudo identificar la serie', 'error');
            return;
        }

        const serie = this.series.find(s => s.id === parseInt(serieId));
        if (!serie) {
            this.mostrarNotificacion('Error: Serie no encontrada', 'error');
            return;
        }

        if (!Array.isArray(serie.temporadas)) {
            serie.temporadas = [];
        }

        const nuevaTemporada = {
            numero: serie.temporadas.length + 1,
            episodios: []
        };

        serie.temporadas.push(nuevaTemporada);
        this.cargarTemporadas(serie.temporadas);
        this.mostrarNotificacion('Temporada agregada exitosamente', 'success');
    }

    async guardarEpisodio(event) {
        event.preventDefault();
        
        try {
            const form = event.target;
            const temporadaNumero = parseInt(document.getElementById('temporadaId').value);
            const episodioNumero = document.getElementById('episodioId').value;
            const serieId = document.getElementById('serieId').value;
            
            if (!serieId) {
                throw new Error('No se pudo identificar la serie');
            }
            
            const serie = this.series.find(s => s.id === parseInt(serieId));
            if (!serie) {
                throw new Error('Serie no encontrada');
            }
            
            if (!Array.isArray(serie.temporadas)) {
                serie.temporadas = [];
            }
            
            // Asegurarse de que la temporada existe
            while (serie.temporadas.length < temporadaNumero) {
                serie.temporadas.push({
                    numero: serie.temporadas.length + 1,
                    episodios: []
                });
            }
            
            const temporada = serie.temporadas[temporadaNumero - 1];
            if (!Array.isArray(temporada.episodios)) {
                temporada.episodios = [];
            }
            
            const nuevoEpisodio = {
                numero: parseInt(form.episodioNumero.value),
                titulo: form.episodioTitulo.value.trim(),
                descripcion: form.episodioDescripcion.value.trim(),
                duracion: form.episodioDuracion.value.trim(),
                url: form.episodioUrl.value.trim()
            };
            
            if (episodioNumero) {
                // Editar episodio existente
                const index = temporada.episodios.findIndex(e => e.numero === parseInt(episodioNumero));
                if (index !== -1) {
                    temporada.episodios[index] = nuevoEpisodio;
                } else {
                    temporada.episodios.push(nuevoEpisodio);
                }
            } else {
                // Agregar nuevo episodio
                temporada.episodios.push(nuevoEpisodio);
            }
            
            // Ordenar episodios por número
            temporada.episodios.sort((a, b) => a.numero - b.numero);
            
            // Guardar cambios
            await this.guardarSeries();
            this.cargarTemporadas(serie.temporadas);
            this.cerrarModal('episodioModal');
            this.mostrarNotificacion('Episodio guardado exitosamente', 'success');
        } catch (error) {
            console.error('Error al guardar episodio:', error);
            this.mostrarNotificacion(`Error al guardar el episodio: ${error.message}`, 'error');
        }
    }

    editarEpisodio(temporadaNumero, episodioNumero) {
        const serieId = document.getElementById('serieId').value;
        const serie = this.series.find(s => s.id === parseInt(serieId));
        
        if (!serie || !serie.temporadas) return;
        
        const temporada = serie.temporadas[temporadaNumero - 1];
        const episodio = temporada.episodios.find(e => e.numero === episodioNumero);
        
        if (!episodio) return;

        const modal = document.getElementById('episodioModal');
        const form = document.getElementById('episodioForm');
        const temporadaInfo = document.getElementById('episodioTemporadaInfo');
        
        // Actualizar información de temporada
        temporadaInfo.textContent = `Temporada ${temporadaNumero} - Episodio ${episodioNumero}`;
        
        // Llenar el formulario
        form.episodioTitulo.value = episodio.titulo;
        form.episodioDescripcion.value = episodio.descripcion;
        form.episodioDuracion.value = episodio.duracion;
        form.episodioNumero.value = episodio.numero;
        form.episodioUrl.value = episodio.url;
        
        document.getElementById('temporadaId').value = temporadaNumero;
        document.getElementById('episodioId').value = episodioNumero;
        
        modal.style.display = 'flex';
    }

    eliminarTemporada(temporadaNumero) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta temporada y todos sus episodios?')) return;
        
        const serieId = document.getElementById('serieId').value;
        const serie = this.series.find(s => s.id === parseInt(serieId));
        
        if (!serie || !serie.temporadas) return;
        
        serie.temporadas = serie.temporadas.filter((t, index) => index !== temporadaNumero - 1);
        // Renumerar temporadas
        serie.temporadas.forEach((t, index) => t.numero = index + 1);
        
        this.cargarTemporadas(serie.temporadas);
    }

    eliminarEpisodio(temporadaNumero, episodioNumero) {
        if (!confirm('¿Estás seguro de que deseas eliminar este episodio?')) return;
        
        const serieId = document.getElementById('serieId').value;
        const serie = this.series.find(s => s.id === parseInt(serieId));
        
        if (!serie || !serie.temporadas) return;
        
        const temporada = serie.temporadas[temporadaNumero - 1];
        if (!temporada) return;
        
        temporada.episodios = temporada.episodios.filter(e => e.numero !== episodioNumero);
        
        this.cargarTemporadas(serie.temporadas);
    }

    async togglePeliculaEstado(id, estado) {
        try {
            const pelicula = this.peliculas.find(p => p.id === id);
            if (pelicula) {
                pelicula.disponible = estado;
                await this.guardarPeliculas();
                this.actualizarTablas();
                this.mostrarNotificacion(`Película ${estado ? 'activada' : 'desactivada'} exitosamente`, 'success');
            }
        } catch (error) {
            console.error('Error al cambiar estado de película:', error);
            this.mostrarNotificacion('Error al cambiar el estado de la película', 'error');
        }
    }

    async toggleSerieEstado(id, estado) {
        try {
            const serie = this.series.find(s => s.id === id);
            if (serie) {
                serie.disponible = estado;
                await this.guardarSeries();
                this.actualizarTablas();
                this.mostrarNotificacion(`Serie ${estado ? 'activada' : 'desactivada'} exitosamente`, 'success');
            }
        } catch (error) {
            console.error('Error al cambiar estado de serie:', error);
            this.mostrarNotificacion('Error al cambiar el estado de la serie', 'error');
        }
    }

    agregarEpisodio(temporadaNumero) {
        const modal = document.getElementById('episodioModal');
        const form = document.getElementById('episodioForm');
        const temporadaInfo = document.getElementById('episodioTemporadaInfo');
        
        if (!modal || !form || !temporadaInfo) {
            console.error('No se encontraron los elementos necesarios del modal');
            return;
        }

        // Actualizar información de temporada
        temporadaInfo.textContent = `Temporada ${temporadaNumero} - Nuevo Episodio`;
        
        document.getElementById('temporadaId').value = temporadaNumero;
        document.getElementById('episodioId').value = '';
        
        // Obtener el último número de episodio y sumar 1
        const serieId = document.getElementById('serieId').value;
        const serie = this.series.find(s => s.id === parseInt(serieId));
        let siguienteNumero = 1;
        
        if (serie && serie.temporadas && serie.temporadas[temporadaNumero - 1]) {
            const episodios = serie.temporadas[temporadaNumero - 1].episodios;
            if (Array.isArray(episodios) && episodios.length > 0) {
                siguienteNumero = Math.max(...episodios.map(e => e.numero)) + 1;
            }
        }
        
        // Establecer valores por defecto
        form.reset();
        form.episodioNumero.value = siguienteNumero;
        form.episodioDuracion.value = '45:00';
        form.episodioTitulo.value = `Episodio ${siguienteNumero}`;
        form.episodioDescripcion.value = '';
        form.episodioUrl.value = '';
        
        modal.style.display = 'flex';
    }
}

// Inicializar el panel de administrador
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
    adminPanel.init().catch(error => {
        console.error('Error al inicializar el panel:', error);
        mostrarError('Error al inicializar el panel. Por favor, contacta al administrador.');
    });
});

function mostrarError(mensaje) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${mensaje}</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// Función para convertir URL de YouTube al formato embed
function convertYouTubeUrl(url) {
    if (!url) return '';
    
    // Patrones de URLs de YouTube
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/
    ];

    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }
    }

    return url; // Retornar la URL original si no es de YouTube
} 
