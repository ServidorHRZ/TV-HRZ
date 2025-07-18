// ===== CONFIGURACIÓN FIREBASE =====
const firebaseConfig = {
    apiKey: "AIzaSyBQ99rjxbIGm48Rb5upnYnE-E_xHvY0UUE",
    authDomain: "tv-hrz.firebaseapp.com",
    projectId: "tv-hrz",
    storageBucket: "tv-hrz.firebasestorage.app",
    messagingSenderId: "604680147180",
    appId: "1:604680147180:web:24fe7cf9c337ced45d55c9",
    measurementId: "G-XWWTT6VRFT"
};

// ===== CONFIGURACIÓN IMGBB =====
const IMGBB_API_KEY = 'fb090f1e8752c6cbd2b205df0f0e2605';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

// ===== VARIABLES GLOBALES =====
let db;
let currentUser = null;
let isInitialized = false;
let editingId = null;
let editingType = null;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        
        // Configurar interfaz
        await initializeDashboard();
        
        // Configurar eventos
        setupEventListeners();
        
        // Cargar datos iniciales
        await loadInitialData();
        
        isInitialized = true;
        showToast('success', 'Dashboard cargado', 'Sistema iniciado correctamente');
        
    } catch (error) {
        console.error('Error inicializando dashboard:', error);
        showToast('error', 'Error de inicialización', 'No se pudo cargar el dashboard');
    }
});

// ===== INICIALIZACIÓN DEL DASHBOARD =====
async function initializeDashboard() {
    // Verificar autenticación
    checkAuthentication();
    
    // Configurar navegación
    setupNavigation();
    
    // Configurar menú de usuario
    setupUserMenu();
    
    // Configurar subida de archivos
    setupFileUpload();
    
    // Configurar formularios
    setupForms();
    
    // Configurar tema
    setupTheme();
}

// ===== VERIFICACIÓN DE AUTENTICACIÓN =====
function checkAuthentication() {
    const adminUser = localStorage.getItem('admin_user');
    
    if (!adminUser) {
        window.location.href = '../Secciones/Perfil.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(adminUser);
        document.getElementById('userName').textContent = currentUser.usuario;
    } catch (error) {
        console.error('Error al parsear usuario:', error);
        window.location.href = '../Secciones/Perfil.html';
    }
}

// ===== CONFIGURACIÓN DE NAVEGACIÓN =====
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Actualizar navegación activa
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Mostrar sección correspondiente
            const sectionId = item.getAttribute('data-section');
            contentSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });
            
            // Cargar datos específicos de la sección
            loadSectionData(sectionId);
        });
    });
}

// ===== CONFIGURACIÓN DEL MENÚ DE USUARIO =====
function setupUserMenu() {
    const userButton = document.getElementById('userButton');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    
    userButton.addEventListener('click', () => {
        userButton.parentElement.classList.toggle('active');
    });
    
    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!userButton.contains(e.target) && !userDropdown.contains(e.target)) {
            userButton.parentElement.classList.remove('active');
        }
    });
    
    // Configurar logout
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
}

// ===== CONFIGURACIÓN DEL TEMA =====
function setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('dashboard_theme') || 'dark';
    
    // Aplicar tema guardado
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        
        themeToggle.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('dashboard_theme', isLight ? 'light' : 'dark');
    });
}

// ===== CONFIGURACIÓN DE SUBIDA DE ARCHIVOS =====
function setupFileUpload() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
        const uploadArea = input.closest('.file-upload-area');
        const previewDiv = uploadArea.querySelector('.image-preview');
        
        // Configurar drag & drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelection(files[0], input, previewDiv);
            }
        });
        
        // Configurar clic para seleccionar archivo
        uploadArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('preview-action')) return;
            input.click();
        });
        
        // Configurar cambio de archivo
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0], input, previewDiv);
            }
        });
    });
}

// ===== MANEJO DE SELECCIÓN DE ARCHIVOS =====
function handleFileSelection(file, input, previewDiv) {
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
        showToast('error', 'Archivo inválido', 'Solo se permiten imágenes');
        return;
    }
    
    // Validar tamaño (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showToast('error', 'Archivo muy grande', 'El archivo debe ser menor a 10MB');
        return;
    }
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        showImagePreview(e.target.result, previewDiv);
    };
    reader.readAsDataURL(file);
    
    // Guardar archivo para subir después
    input.fileToUpload = file;
}

// ===== MOSTRAR PREVIEW DE IMAGEN =====
function showImagePreview(src, previewDiv) {
    previewDiv.innerHTML = `
        <img src="${src}" alt="Preview">
        <div class="preview-actions">
            <button type="button" class="preview-action" onclick="removeImagePreview(this)">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    previewDiv.classList.add('active');
    previewDiv.parentElement.querySelector('.upload-placeholder').style.display = 'none';
}

// ===== REMOVER PREVIEW DE IMAGEN =====
function removeImagePreview(button) {
    const previewDiv = button.closest('.image-preview');
    const uploadArea = previewDiv.closest('.file-upload-area');
    const input = uploadArea.querySelector('input[type="file"]');
    
    previewDiv.classList.remove('active');
    previewDiv.innerHTML = '';
    uploadArea.querySelector('.upload-placeholder').style.display = 'block';
    
    input.value = '';
    input.fileToUpload = null;
}

// ===== SUBIDA DE IMAGEN A IMGBB =====
async function uploadImageToImgbb(file) {
    try {
        showLoading(true);
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('key', IMGBB_API_KEY);
        
        const response = await fetch(IMGBB_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            return result.data.url;
        } else {
            throw new Error('Error al subir imagen: ' + result.error.message);
        }
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        throw error;
    } finally {
        showLoading(false);
    }
}

// ===== CONFIGURACIÓN DE FORMULARIOS =====
function setupForms() {
    // Formulario de películas
    const peliculaForm = document.getElementById('peliculaForm');
    peliculaForm.addEventListener('submit', handlePeliculaSubmit);
    
    // Formulario de series
    const serieForm = document.getElementById('serieForm');
    serieForm.addEventListener('submit', handleSerieSubmit);
    
    // Botones de cancelar
    document.getElementById('cancelPeliculaBtn').addEventListener('click', () => {
        resetForm('peliculaForm');
    });
    
    document.getElementById('cancelSerieBtn').addEventListener('click', () => {
        resetForm('serieForm');
    });
    
    // Configurar búsqueda
    document.getElementById('searchPeliculas').addEventListener('input', (e) => {
        searchContent('peliculas', e.target.value);
    });
    
    document.getElementById('searchSeries').addEventListener('input', (e) => {
        searchContent('series', e.target.value);
    });
    
    // Configurar filtros avanzados
    setupAdvancedFilters();
    
    // Configurar contador de géneros seleccionados
    setupGenreCounter();
}

// ===== CONFIGURAR CONTADOR DE GÉNEROS =====
function setupGenreCounter() {
    const genreCheckboxes = document.querySelectorAll('#peliculaForm input[name="genero"]');
    const nuevoCheckbox = document.getElementById('peliculaNuevo');
    
    genreCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateGenreCounter);
    });
    
    // Configurar checkbox de "Recién agregado" para auto-seleccionar "estrenos"
    if (nuevoCheckbox) {
        nuevoCheckbox.addEventListener('change', (e) => {
            const estrenosCheckbox = document.querySelector('#peliculaForm input[name="genero"][value="estrenos"]');
            if (e.target.checked && estrenosCheckbox) {
                estrenosCheckbox.checked = true;
                updateGenreCounter();
                showToast('info', 'Categoría agregada', 'Se agregó automáticamente la categoría "Estrenos"');
            }
        });
    }
    
    updateGenreCounter();
}

// ===== ACTUALIZAR CONTADOR DE GÉNEROS =====
function updateGenreCounter() {
    const checkedGenres = document.querySelectorAll('#peliculaForm input[name="genero"]:checked');
    const genreSelection = document.querySelector('.genre-selection');
    
    if (genreSelection) {
        const count = checkedGenres.length;
        const text = count === 0 ? 'Selecciona las categorías que apliquen' :
                    count === 1 ? '1 categoría seleccionada' :
                    `${count} categorías seleccionadas`;
        
        genreSelection.style.setProperty('--counter-text', `"${text}"`);
        
        // Cambiar el color del borde según el estado
        if (count === 0) {
            genreSelection.style.borderColor = 'var(--border-color)';
        } else {
            genreSelection.style.borderColor = 'var(--primary-color)';
        }
    }
}

// ===== MANEJO DE ENVÍO DE PELÍCULA =====
async function handlePeliculaSubmit(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        
        // Obtener géneros seleccionados de los checkboxes
        const generoCheckboxes = e.target.querySelectorAll('input[name="genero"]:checked');
        let generos = Array.from(generoCheckboxes).map(checkbox => checkbox.value);
        
        // Validar que se seleccione al menos una categoría
        if (generos.length === 0) {
            showToast('warning', 'Categorías requeridas', 'Selecciona al menos una categoría para la película');
            return;
        }
        
        // Si está marcado como nuevo, agregar automáticamente "estrenos"
        const esNuevo = formData.get('nuevo') === 'on';
        if (esNuevo && !generos.includes('estrenos')) {
            generos.unshift('estrenos'); // Agregar al inicio
        }
        
        // Convertir URL de YouTube a embed si es necesario
        let trailerUrl = formData.get('trailer');
        if (trailerUrl) {
            const originalUrl = trailerUrl;
            trailerUrl = convertYouTubeToEmbed(trailerUrl);
            
            // Notificar si se convirtió la URL
            if (originalUrl !== trailerUrl) {
                showToast('info', 'URL convertida', 'Se convirtió automáticamente la URL de YouTube a formato embed');
            }
        }
        
        const peliculaData = {
            titulo: formData.get('titulo'),
            ano: parseInt(formData.get('ano')) || null,
            duracion: parseInt(formData.get('duracion')) || null,
            descripcion: formData.get('descripcion'),
            genero: generos,
            trailer: trailerUrl,
            enlace: formData.get('enlace'),
            nuevo: esNuevo,
            disponible: formData.get('disponible') === 'on'
        };
        
        // Subir imagen si hay una seleccionada
        const imageInput = document.getElementById('peliculaImagen');
        if (imageInput.fileToUpload) {
            peliculaData.imagen = await uploadImageToImgbb(imageInput.fileToUpload);
        }
        
        // Obtener el siguiente ID
        if (!editingId) {
            peliculaData.id = await getNextId('peliculas');
        }
        
        // Guardar en Firebase
        let docRef;
        if (editingId) {
            docRef = db.collection('peliculas').doc(editingId);
            await docRef.update(peliculaData);
            showToast('success', 'Película actualizada', 'La película se actualizó correctamente');
        } else {
            docRef = db.collection('peliculas').doc(peliculaData.id.toString());
            await docRef.set(peliculaData);
            showToast('success', 'Película agregada', 'La película se agregó correctamente');
        }
        
        // Limpiar formulario y recargar lista
        resetForm('peliculaForm');
        await loadPeliculas();
        
    } catch (error) {
        console.error('Error guardando película:', error);
        showToast('error', 'Error', 'No se pudo guardar la película');
    } finally {
        showLoading(false);
    }
}

// ===== MANEJO DE ENVÍO DE SERIE =====
async function handleSerieSubmit(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        const serieData = {
            titulo: formData.get('titulo'),
            ano: parseInt(formData.get('ano')) || null,
            temporadas: parseInt(formData.get('temporadas')) || null,
            descripcion: formData.get('descripcion'),
            genero: Array.from(e.target.genero.selectedOptions).map(option => option.value),
            plataforma: formData.get('plataforma'),
            trailer: formData.get('trailer'),
            enlace: formData.get('enlace'),
            nuevo: formData.get('nuevo') === 'on',
            destacado: formData.get('destacado') === 'on',
            disponible: formData.get('disponible') === 'on'
        };
        
        // Subir imagen si hay una seleccionada
        const imageInput = document.getElementById('serieImagen');
        if (imageInput.fileToUpload) {
            serieData.imagen = await uploadImageToImgbb(imageInput.fileToUpload);
        }
        
        // Obtener el siguiente ID
        if (!editingId) {
            serieData.id = await getNextId('series');
        }
        
        // Guardar en Firebase
        let docRef;
        if (editingId) {
            docRef = db.collection('series').doc(editingId);
            await docRef.update(serieData);
            showToast('success', 'Serie actualizada', 'La serie se actualizó correctamente');
        } else {
            docRef = db.collection('series').doc(serieData.id.toString());
            await docRef.set(serieData);
            showToast('success', 'Serie agregada', 'La serie se agregó correctamente');
        }
        
        // Limpiar formulario y recargar lista
        resetForm('serieForm');
        await loadSeries();
        
    } catch (error) {
        console.error('Error guardando serie:', error);
        showToast('error', 'Error', 'No se pudo guardar la serie');
    } finally {
        showLoading(false);
    }
}

// ===== CONVERTIR YOUTUBE URL A EMBED =====
function convertYouTubeToEmbed(url) {
    if (!url) return url;
    
    // Patrones para diferentes formatos de YouTube
    const patterns = [
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(?:&.*)?/,
        /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)(?:\?.*)?/,
        /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)(?:\?.*)?/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            const videoId = match[1];
            return `https://www.youtube.com/embed/${videoId}`;
        }
    }
    
    // Si no coincide con ningún patrón, devolver la URL original
    return url;
}

// ===== OBTENER SIGUIENTE ID =====
async function getNextId(collection) {
    try {
        const snapshot = await db.collection(collection).get();
        let maxId = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.id && data.id > maxId) {
                maxId = data.id;
            }
        });
        
        return maxId + 1;
    } catch (error) {
        console.error('Error obteniendo siguiente ID:', error);
        return Date.now(); // Fallback
    }
}

// ===== RESETEAR FORMULARIO =====
function resetForm(formId) {
    const form = document.getElementById(formId);
    form.reset();
    
    // Limpiar previews de imágenes
    const previews = form.querySelectorAll('.image-preview');
    previews.forEach(preview => {
        preview.classList.remove('active');
        preview.innerHTML = '';
    });
    
    // Mostrar placeholders
    const placeholders = form.querySelectorAll('.upload-placeholder');
    placeholders.forEach(placeholder => {
        placeholder.style.display = 'block';
    });
    
    // Limpiar archivos seleccionados
    const fileInputs = form.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.fileToUpload = null;
    });
    
    // Limpiar checkboxes de géneros
    const genreCheckboxes = form.querySelectorAll('input[name="genero"]');
    genreCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Actualizar contador de géneros
    if (formId === 'peliculaForm') {
        updateGenreCounter();
    }
    
    // Resetear variables de edición
    editingId = null;
    editingType = null;
    
    // Actualizar botones
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = formId === 'peliculaForm' ? 
        '<i class="fas fa-save"></i> Guardar Película' : 
        '<i class="fas fa-save"></i> Guardar Serie';
}

// ===== CARGAR DATOS INICIALES =====
async function loadInitialData() {
    try {
        await Promise.all([
            loadStatistics(),
            loadPeliculas(),
            loadSeries(),
            loadRecentActivity()
        ]);
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
    }
}

// ===== CARGAR ESTADÍSTICAS =====
async function loadStatistics() {
    try {
        const [peliculasSnapshot, seriesSnapshot] = await Promise.all([
            db.collection('peliculas').get(),
            db.collection('series').get()
        ]);
        
        document.getElementById('totalPeliculas').textContent = peliculasSnapshot.size;
        document.getElementById('totalSeries').textContent = seriesSnapshot.size;
        
        // Simular datos de canales y cursos
        document.getElementById('totalCanales').textContent = '12';
        document.getElementById('totalCursos').textContent = '8';
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// ===== CARGAR PELÍCULAS =====
async function loadPeliculas() {
    try {
        const snapshot = await db.collection('peliculas').orderBy('titulo').get();
        const peliculas = [];
        
        snapshot.forEach(doc => {
            peliculas.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayPeliculas(peliculas);
        
    } catch (error) {
        console.error('Error cargando películas:', error);
        showToast('error', 'Error', 'No se pudieron cargar las películas');
    }
}

// ===== CARGAR SERIES =====
async function loadSeries() {
    try {
        const snapshot = await db.collection('series').orderBy('titulo').get();
        const series = [];
        
        snapshot.forEach(doc => {
            series.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displaySeries(series);
        
    } catch (error) {
        console.error('Error cargando series:', error);
        showToast('error', 'Error', 'No se pudieron cargar las series');
    }
}

// ===== MOSTRAR PELÍCULAS =====
function displayPeliculas(peliculas) {
    const container = document.getElementById('peliculasList');
    
    if (peliculas.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay películas disponibles</p>';
        return;
    }
    
    container.innerHTML = peliculas.map(pelicula => `
        <div class="content-item">
            <img src="${pelicula.imagen || '/api/placeholder/60/80'}" alt="${pelicula.titulo}">
            <div class="content-info">
                <div class="content-title">${pelicula.titulo}</div>
                <div class="content-meta">
                    ${pelicula.ano || 'N/A'} • ${pelicula.duracion ? pelicula.duracion + ' min' : 'N/A'}
                </div>
                <div class="content-badges">
                    ${pelicula.nuevo ? '<span class="badge nuevo">Recién Agregado</span>' : ''}
                    <span class="badge ${pelicula.disponible ? 'disponible' : 'no-disponible'}">
                        ${pelicula.disponible ? 'Disponible' : 'No disponible'}
                    </span>
                </div>
            </div>
            <div class="content-actions">
                <button class="action-btn edit" onclick="editPelicula('${pelicula.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" onclick="deletePelicula('${pelicula.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ===== MOSTRAR SERIES =====
function displaySeries(series) {
    const container = document.getElementById('seriesList');
    
    if (series.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay series disponibles</p>';
        return;
    }
    
    container.innerHTML = series.map(serie => `
        <div class="content-item">
            <img src="${serie.imagen || '/api/placeholder/60/80'}" alt="${serie.titulo}">
            <div class="content-info">
                <div class="content-title">${serie.titulo}</div>
                <div class="content-meta">
                    ${serie.ano || 'N/A'} • ${serie.temporadas ? serie.temporadas + ' temporadas' : 'N/A'}
                </div>
                <div class="content-badges">
                    ${serie.nuevo ? '<span class="badge nuevo">Recién Agregado</span>' : ''}
                    ${serie.destacado ? '<span class="badge destacado">Destacado</span>' : ''}
                    <span class="badge ${serie.disponible ? 'disponible' : 'no-disponible'}">
                        ${serie.disponible ? 'Disponible' : 'No disponible'}
                    </span>
                </div>
            </div>
            <div class="content-actions">
                <button class="action-btn edit" onclick="editSerie('${serie.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete" onclick="deleteSerie('${serie.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ===== EDITAR PELÍCULA =====
async function editPelicula(id) {
    try {
        const doc = await db.collection('peliculas').doc(id).get();
        if (!doc.exists) {
            showToast('error', 'Error', 'Película no encontrada');
            return;
        }
        
        const data = doc.data();
        editingId = id;
        editingType = 'pelicula';
        
        // Llenar formulario
        document.getElementById('peliculaTitulo').value = data.titulo || '';
        document.getElementById('peliculaAno').value = data.ano || '';
        document.getElementById('peliculaDuracion').value = data.duracion || '';
        document.getElementById('peliculaDescripcion').value = data.descripcion || '';
        document.getElementById('peliculaTrailer').value = data.trailer || '';
        document.getElementById('peliculaEnlace').value = data.enlace || '';
        document.getElementById('peliculaNuevo').checked = data.nuevo || false;
        document.getElementById('peliculaDisponible').checked = data.disponible !== false;
        
        // Seleccionar géneros (checkboxes)
        const generoCheckboxes = document.querySelectorAll('#peliculaForm input[name="genero"]');
        generoCheckboxes.forEach(checkbox => {
            checkbox.checked = data.genero && data.genero.includes(checkbox.value);
        });
        
        // Actualizar contador de géneros
        updateGenreCounter();
        
        // Mostrar imagen actual si existe
        if (data.imagen) {
            const previewDiv = document.getElementById('peliculaImagenPreview');
            showImagePreview(data.imagen, previewDiv);
        }
        
        // Cambiar texto del botón
        const submitBtn = document.querySelector('#peliculaForm button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Película';
        
        // Cambiar a la sección de películas
        document.querySelector('.nav-item[data-section="peliculas"]').click();
        
        showToast('info', 'Modo edición', 'Editando película: ' + data.titulo);
        
    } catch (error) {
        console.error('Error cargando película para editar:', error);
        showToast('error', 'Error', 'No se pudo cargar la película');
    }
}

// ===== EDITAR SERIE =====
async function editSerie(id) {
    try {
        const doc = await db.collection('series').doc(id).get();
        if (!doc.exists) {
            showToast('error', 'Error', 'Serie no encontrada');
            return;
        }
        
        const data = doc.data();
        editingId = id;
        editingType = 'serie';
        
        // Llenar formulario
        document.getElementById('serieTitulo').value = data.titulo || '';
        document.getElementById('serieAno').value = data.ano || '';
        document.getElementById('serieTemporadas').value = data.temporadas || '';
        document.getElementById('serieDescripcion').value = data.descripcion || '';
        document.getElementById('seriePlataforma').value = data.plataforma || '';
        document.getElementById('serieTrailer').value = data.trailer || '';
        document.getElementById('serieEnlace').value = data.enlace || '';
        document.getElementById('serieNuevo').checked = data.nuevo || false;
        document.getElementById('serieDestacado').checked = data.destacado || false;
        document.getElementById('serieDisponible').checked = data.disponible !== false;
        
        // Seleccionar géneros
        const generoSelect = document.getElementById('serieGenero');
        Array.from(generoSelect.options).forEach(option => {
            option.selected = data.genero && data.genero.includes(option.value);
        });
        
        // Mostrar imagen actual si existe
        if (data.imagen) {
            const previewDiv = document.getElementById('serieImagenPreview');
            showImagePreview(data.imagen, previewDiv);
        }
        
        // Cambiar texto del botón
        const submitBtn = document.querySelector('#serieForm button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Serie';
        
        // Cambiar a la sección de series
        document.querySelector('.nav-item[data-section="series"]').click();
        
        showToast('info', 'Modo edición', 'Editando serie: ' + data.titulo);
        
    } catch (error) {
        console.error('Error cargando serie para editar:', error);
        showToast('error', 'Error', 'No se pudo cargar la serie');
    }
}

// ===== ELIMINAR PELÍCULA =====
async function deletePelicula(id) {
    try {
        const doc = await db.collection('peliculas').doc(id).get();
        if (!doc.exists) {
            showToast('error', 'Error', 'Película no encontrada');
            return;
        }
        
        const data = doc.data();
        
        if (await showConfirmModal('Eliminar película', `¿Estás seguro de que deseas eliminar "${data.titulo}"?`)) {
            await db.collection('peliculas').doc(id).delete();
            showToast('success', 'Película eliminada', 'La película se eliminó correctamente');
            await loadPeliculas();
            await loadStatistics();
        }
    } catch (error) {
        console.error('Error eliminando película:', error);
        showToast('error', 'Error', 'No se pudo eliminar la película');
    }
}

// ===== ELIMINAR SERIE =====
async function deleteSerie(id) {
    try {
        const doc = await db.collection('series').doc(id).get();
        if (!doc.exists) {
            showToast('error', 'Error', 'Serie no encontrada');
            return;
        }
        
        const data = doc.data();
        
        if (await showConfirmModal('Eliminar serie', `¿Estás seguro de que deseas eliminar "${data.titulo}"?`)) {
            await db.collection('series').doc(id).delete();
            showToast('success', 'Serie eliminada', 'La serie se eliminó correctamente');
            await loadSeries();
            await loadStatistics();
        }
    } catch (error) {
        console.error('Error eliminando serie:', error);
        showToast('error', 'Error', 'No se pudo eliminar la serie');
    }
}

// ===== BÚSQUEDA DE CONTENIDO =====
async function searchContent(type, query) {
    try {
        const collection = type === 'peliculas' ? 'peliculas' : 'series';
        const snapshot = await db.collection(collection).get();
        const items = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.titulo.toLowerCase().includes(query.toLowerCase())) {
                items.push({
                    id: doc.id,
                    ...data
                });
            }
        });
        
        if (type === 'peliculas') {
            displayPeliculas(items);
        } else {
            displaySeries(items);
        }
        
    } catch (error) {
        console.error('Error buscando contenido:', error);
    }
}

// ===== CARGAR ACTIVIDAD RECIENTE =====
async function loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    
    // Simular actividad reciente
    const activities = [
        {
            icon: 'fas fa-plus',
            text: 'Nueva película agregada',
            time: 'Hace 2 horas'
        },
        {
            icon: 'fas fa-edit',
            text: 'Serie actualizada',
            time: 'Hace 4 horas'
        },
        {
            icon: 'fas fa-trash',
            text: 'Película eliminada',
            time: 'Hace 1 día'
        }
    ];
    
    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">${activity.text}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        </div>
    `).join('');
}

// ===== CARGAR DATOS DE SECCIÓN =====
async function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'dashboard':
            await loadStatistics();
            await loadRecentActivity();
            break;
        case 'peliculas':
            await loadPeliculas();
            break;
        case 'series':
            await loadSeries();
            break;
    }
}

// ===== CONFIGURAR EVENTOS =====
function setupEventListeners() {
    // Configurar modal de confirmación
    setupConfirmModal();
    
    // Configurar botones de agregar
    document.getElementById('addPeliculaBtn').addEventListener('click', () => {
        resetForm('peliculaForm');
        showToast('info', 'Nueva película', 'Agregando nueva película');
    });
    
    document.getElementById('addSerieBtn').addEventListener('click', () => {
        resetForm('serieForm');
        showToast('info', 'Nueva serie', 'Agregando nueva serie');
    });
    
    // Configurar atajos de teclado
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const activeSection = document.querySelector('.content-section.active');
            if (activeSection.id === 'peliculas') {
                document.getElementById('peliculaForm').requestSubmit();
            } else if (activeSection.id === 'series') {
                document.getElementById('serieForm').requestSubmit();
            }
        }
    });
}

// ===== CONFIGURAR MODAL DE CONFIRMACIÓN =====
function setupConfirmModal() {
    const modal = document.getElementById('confirmModal');
    const closeBtn = document.getElementById('confirmModalClose');
    const cancelBtn = document.getElementById('confirmCancel');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// ===== MOSTRAR MODAL DE CONFIRMACIÓN =====
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleElement = modal.querySelector('.modal-title');
        const messageElement = document.getElementById('confirmMessage');
        const confirmBtn = document.getElementById('confirmAction');
        
        titleElement.textContent = title;
        messageElement.textContent = message;
        
        // Configurar botón de confirmación
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            resolve(true);
        });
        
        // Configurar cancelación
        const cancelHandler = () => {
            modal.classList.remove('active');
            resolve(false);
        };
        
        modal.querySelector('#confirmCancel').onclick = cancelHandler;
        modal.querySelector('#confirmModalClose').onclick = cancelHandler;
        
        modal.classList.add('active');
    });
}

// ===== MOSTRAR/OCULTAR LOADING =====
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// ===== SISTEMA DE NOTIFICACIONES TOAST =====
function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${iconMap[type] || iconMap.info}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// ===== CERRAR SESIÓN =====
function logout() {
    localStorage.removeItem('admin_user');
    showToast('info', 'Sesión cerrada', 'Has cerrado sesión correctamente');
    setTimeout(() => {
        window.location.href = '../Secciones/Perfil.html';
    }, 1000);
}

// ===== VALIDACIÓN DE FORMULARIOS =====
function validateForm(formId) {
    const form = document.getElementById(formId);
    const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('error');
            isValid = false;
        } else {
            field.classList.remove('error');
        }
    });
    
    return isValid;
}

// ===== UTILIDADES =====
function formatDate(date) {
    return new Date(date).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// ===== CONFIGURAR FILTROS AVANZADOS =====
function setupAdvancedFilters() {
    const filterGenero = document.getElementById('filterGenero');
    const filterAno = document.getElementById('filterAno');
    const filterEstado = document.getElementById('filterEstado');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const viewBtns = document.querySelectorAll('.view-btn');
    
    // Configurar eventos de filtros
    if (filterGenero) {
        filterGenero.addEventListener('change', applyFilters);
    }
    if (filterAno) {
        filterAno.addEventListener('change', applyFilters);
    }
    if (filterEstado) {
        filterEstado.addEventListener('change', applyFilters);
    }
    
    // Configurar botón de limpiar filtros
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // Configurar botones de vista
    viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const viewType = e.currentTarget.dataset.view;
            switchView(viewType);
        });
    });
}

// ===== APLICAR FILTROS =====
function applyFilters() {
    const searchTerm = document.getElementById('searchPeliculas').value.toLowerCase();
    const selectedGenero = document.getElementById('filterGenero').value;
    const selectedAno = document.getElementById('filterAno').value;
    const selectedEstado = document.getElementById('filterEstado').value;
    
    const peliculasList = document.getElementById('peliculasList');
    const items = peliculasList.querySelectorAll('.content-item');
    let visibleCount = 0;
    
    // Obtener datos de películas desde Firebase para filtrar correctamente
    db.collection('peliculas').get().then(snapshot => {
        const peliculasData = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            peliculasData[data.titulo] = data;
        });
        
        items.forEach(item => {
            const title = item.querySelector('.content-title').textContent.toLowerCase();
            const titleOriginal = item.querySelector('.content-title').textContent;
            const meta = item.querySelector('.content-meta').textContent;
            const badges = item.querySelectorAll('.badge');
            
            // Obtener datos de la película
            const peliculaData = peliculasData[titleOriginal];
            
            // Filtro de búsqueda
            const matchesSearch = title.includes(searchTerm);
            
            // Filtro de género/categoría
            let matchesGenero = true;
            if (selectedGenero && peliculaData) {
                if (Array.isArray(peliculaData.genero)) {
                    matchesGenero = peliculaData.genero.includes(selectedGenero);
                } else if (typeof peliculaData.genero === 'string') {
                    matchesGenero = peliculaData.genero === selectedGenero;
                } else {
                    matchesGenero = false;
                }
            }
            
            // Filtro de año
            let matchesAno = true;
            if (selectedAno) {
                if (selectedAno === 'older') {
                    const year = parseInt(meta.match(/\d{4}/)?.[0] || '0');
                    matchesAno = year < 2018;
                } else {
                    matchesAno = meta.includes(selectedAno);
                }
            }
            
            // Filtro de estado
            let matchesEstado = true;
            if (selectedEstado) {
                const hasDisponible = Array.from(badges).some(badge => 
                    badge.classList.contains('disponible')
                );
                const hasNuevo = Array.from(badges).some(badge => 
                    badge.classList.contains('nuevo')
                );
                
                switch (selectedEstado) {
                    case 'disponible':
                        matchesEstado = hasDisponible;
                        break;
                    case 'no_disponible':
                        matchesEstado = !hasDisponible;
                        break;
                    case 'nuevo':
                        matchesEstado = hasNuevo;
                        break;
                }
            }
            
            // Mostrar/ocultar elemento
            const isVisible = matchesSearch && matchesGenero && matchesAno && matchesEstado;
            item.style.display = isVisible ? 'flex' : 'none';
            
            if (isVisible) {
                visibleCount++;
            }
        });
        
        // Actualizar contador de resultados
        updateResultsCount(visibleCount);
    }).catch(error => {
        console.error('Error aplicando filtros:', error);
        // Fallback: aplicar solo filtros básicos sin datos de Firebase
        items.forEach(item => {
            const title = item.querySelector('.content-title').textContent.toLowerCase();
            const matchesSearch = title.includes(searchTerm);
            item.style.display = matchesSearch ? 'flex' : 'none';
            if (matchesSearch) visibleCount++;
        });
        updateResultsCount(visibleCount);
    });
}

// ===== OBTENER NOMBRE DE GÉNERO PARA MOSTRAR =====
function getGeneroDisplayName(generoValue) {
    const generoMap = {
        'estrenos': 'Estrenos',
        'accion': 'Acción',
        'comedia': 'Comedia',
        'drama': 'Drama',
        'terror': 'Terror',
        'ciencia_ficcion': 'Ciencia Ficción',
        'animacion': 'Animación',
        'familiar': 'Familiar',
        'netflix': 'Netflix',
        'amazon': 'Amazon Prime',
        'hbo': 'HBO Max',
        'disney': 'Disney+',
        'paramount': 'Paramount+',
        'apple': 'Apple TV+',
        'hulu': 'Hulu',
        'marvel': 'Marvel',
        'dc': 'DC',
        'anime': 'Anime',
        'cristiana': 'Cristiana',
        'clasicos': 'Clásicos'
    };
    
    return generoMap[generoValue] || generoValue;
}

// ===== LIMPIAR TODOS LOS FILTROS =====
function clearAllFilters() {
    document.getElementById('searchPeliculas').value = '';
    document.getElementById('filterGenero').value = '';
    document.getElementById('filterAno').value = '';
    document.getElementById('filterEstado').value = '';
    
    // Mostrar todos los elementos
    const peliculasList = document.getElementById('peliculasList');
    const items = peliculasList.querySelectorAll('.content-item');
    
    items.forEach(item => {
        item.style.display = 'flex';
    });
    
    updateResultsCount(items.length);
    showToast('info', 'Filtros limpiados', 'Se han eliminado todos los filtros aplicados');
}

// ===== CAMBIAR VISTA =====
function switchView(viewType) {
    const peliculasList = document.getElementById('peliculasList');
    const viewBtns = document.querySelectorAll('.view-btn');
    
    // Actualizar botones activos
    viewBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewType) {
            btn.classList.add('active');
        }
    });
    
    // Cambiar clases de vista
    peliculasList.classList.remove('grid-view', 'list-view');
    peliculasList.classList.add(`${viewType}-view`);
    
    // Guardar preferencia
    localStorage.setItem('dashboard_view_preference', viewType);
}

// ===== ACTUALIZAR CONTADOR DE RESULTADOS =====
function updateResultsCount(count) {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        const text = count === 0 ? 'No se encontraron películas' :
                    count === 1 ? '1 película encontrada' :
                    `${count} películas encontradas`;
        resultsCount.textContent = text;
    }
}

// ===== BÚSQUEDA MEJORADA CON FILTROS =====
function searchContent(type, searchTerm) {
    if (type === 'peliculas') {
        applyFilters(); // Usar el sistema de filtros mejorado
    } else {
        // Mantener búsqueda original para series
        const container = document.getElementById(`${type}List`);
        const items = container.querySelectorAll('.content-item');
        
        items.forEach(item => {
            const title = item.querySelector('.content-title').textContent.toLowerCase();
            const isVisible = title.includes(searchTerm.toLowerCase());
            item.style.display = isVisible ? 'flex' : 'none';
        });
    }
}

// ===== INICIALIZAR VISTA PREFERIDA =====
function initializeViewPreference() {
    const savedView = localStorage.getItem('dashboard_view_preference') || 'list';
    switchView(savedView);
}

// ===== EXPORT FUNCTIONS FOR GLOBAL ACCESS =====
window.editPelicula = editPelicula;
window.editSerie = editSerie;
window.deletePelicula = deletePelicula;
window.deleteSerie = deleteSerie;
window.removeImagePreview = removeImagePreview;

// ===== MANEJO DE ERRORES GLOBAL =====
window.addEventListener('error', (e) => {
    console.error('Error global:', e.error);
    showToast('error', 'Error', 'Se produjo un error inesperado');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesa rechazada:', e.reason);
    showToast('error', 'Error', 'Error de conexión o procesamiento');
});

// ===== FUNCIONES DE DESARROLLO =====
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.dashboardDebug = {
        currentUser,
        db,
        resetAllData: async () => {
            if (confirm('¿Estás seguro de que deseas resetear todos los datos?')) {
                // Implementar reset de datos
                console.log('Reseteando datos...');
            }
        },
        exportData: async () => {
            // Implementar export de datos
            console.log('Exportando datos...');
        }
    };
}

console.log('🚀 Dashboard HRZ TV inicializado correctamente');