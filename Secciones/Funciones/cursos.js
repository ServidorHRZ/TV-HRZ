let todosLosCursos = [];

async function cargarCursos() {
    try {
        const response = await fetch('../DataBase/cursos.json');
        const data = await response.json();
        const lenguajesAleatorios = [...data.lenguajes].sort(() => Math.random() - 0.5);
        
        // Almacenar todos los cursos en un array
        todosLosCursos = lenguajesAleatorios.reduce((acc, lenguaje) => {
            return acc.concat(lenguaje.cursos.map(curso => ({
                ...curso,
                lenguaje: lenguaje.titulo
            })));
        }, []);

        mostrarCursos(lenguajesAleatorios);
        setupNavegacion();
        setupBuscador();
    } catch (error) {
        console.error('Error cargando los cursos:', error);
    }
}

function mostrarCursos(lenguajes) {
    const contenedor = document.createElement('div');
    contenedor.className = 'main-content';
    document.body.insertBefore(contenedor, document.querySelector('.bottom-nav'));

    lenguajes.forEach(seccion => {
        // Crear una copia del array de cursos y mezclarlos aleatoriamente
        const cursosAleatorios = [...seccion.cursos].sort(() => Math.random() - 0.5);
        
        const seccionHTML = `
            <div class="lenguaje-seccion">
                <h2 class="lenguaje-titulo">
                    <img src="${seccion.logo}" alt="${seccion.titulo}" class="lenguaje-logo">
                    ${seccion.titulo}
                </h2>
                <div class="cursos-contenedor">
                    ${cursosAleatorios.map(curso => `
                        <div class="curso-card" onclick="abrirCurso(${curso.id})">
                            <div class="curso-thumbnail">
                                <img src="${curso.imagen}" alt="${curso.titulo}">
                            </div>
                            <div class="curso-info">
                                <h3>${curso.titulo}</h3>
                                <div class="curso-detalles">
                                    <span class="curso-nivel">${curso.nivel}</span>
                                    <span class="curso-duracion">
                                        <i class="fas fa-clock"></i>
                                        ${curso.duracion}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="nav-arrow prev">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button class="nav-arrow next">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        contenedor.innerHTML += seccionHTML;
    });
}

function setupNavegacion() {
    const secciones = document.querySelectorAll('.lenguaje-seccion');
    
    secciones.forEach(seccion => {
        const contenedor = seccion.querySelector('.cursos-contenedor');
        const prevBtn = seccion.querySelector('.nav-arrow.prev');
        const nextBtn = seccion.querySelector('.nav-arrow.next');
        
        let startX, startY;
        let scrollLeft;
        let isDragging = false;
        let startTime;
        let momentumID;
        let isScrollingHorizontally = false;

        function startDragging(e) {
            isDragging = true;
            startTime = Date.now();
            if (e.type === 'mousedown') {
                startX = e.pageX;
                startY = e.pageY;
            } else {
                startX = e.touches[0].pageX;
                startY = e.touches[0].pageY;
            }
            scrollLeft = contenedor.scrollLeft;
            isScrollingHorizontally = false;

            if (momentumID) {
                cancelAnimationFrame(momentumID);
            }

            contenedor.style.scrollBehavior = 'auto';
            contenedor.style.cursor = 'grabbing';
        }

        function drag(e) {
            if (!isDragging) return;

            let currentX, currentY;
            if (e.type === 'mousemove') {
                currentX = e.pageX;
                currentY = e.pageY;
            } else {
                currentX = e.touches[0].pageX;
                currentY = e.touches[0].pageY;
            }

            // Calcular la diferencia en X e Y
            const diffX = Math.abs(currentX - startX);
            const diffY = Math.abs(currentY - startY);

            // Si aún no se ha determinado la dirección del scroll
            if (!isScrollingHorizontally && (diffX > 5 || diffY > 5)) {
                // Si el movimiento horizontal es mayor que el vertical
                isScrollingHorizontally = diffX > diffY;
                
                // Si es scroll vertical, detener el manejo del evento
                if (!isScrollingHorizontally) {
                    isDragging = false;
                    return;
                }
            }

            // Solo prevenir el comportamiento por defecto si es scroll horizontal
            if (isScrollingHorizontally) {
                e.preventDefault();
                const walk = (currentX - startX) * 1.5;
                contenedor.scrollLeft = scrollLeft - walk;
            }
        }

        function stopDragging() {
            if (!isDragging) return;
            
            isDragging = false;
            const endTime = Date.now();
            const timeElapsed = endTime - startTime;
            
            contenedor.style.cursor = 'grab';
            contenedor.style.scrollBehavior = 'smooth';

            // Aplicar momentum si el movimiento fue rápido
            if (timeElapsed < 100) {
                const velocity = (contenedor.scrollLeft - scrollLeft) / timeElapsed;
                applyMomentum(velocity);
            }
        }

        function applyMomentum(velocity) {
            let currentVelocity = velocity * 15; // Factor de momentum
            
            function momentum() {
                if (Math.abs(currentVelocity) > 0.1) {
                    contenedor.scrollLeft += currentVelocity;
                    currentVelocity *= 0.95; // Fricción
                    momentumID = requestAnimationFrame(momentum);
                }
            }
            
            momentum();
        }

        // Event Listeners para mouse
        contenedor.addEventListener('mousedown', startDragging);
        contenedor.addEventListener('mousemove', drag);
        contenedor.addEventListener('mouseup', stopDragging);
        contenedor.addEventListener('mouseleave', stopDragging);

        // Event Listeners para touch
        contenedor.addEventListener('touchstart', startDragging, { passive: true });
        contenedor.addEventListener('touchmove', drag, { passive: false });
        contenedor.addEventListener('touchend', stopDragging);

        // Navegación con flechas
        prevBtn?.addEventListener('click', () => scroll(contenedor, 'prev'));
        nextBtn?.addEventListener('click', () => scroll(contenedor, 'next'));

        // Actualizar visibilidad de flechas
        contenedor.addEventListener('scroll', () => {
            updateArrowsVisibility(contenedor, prevBtn, nextBtn);
        });
        
        // Verificar visibilidad inicial
        updateArrowsVisibility(contenedor, prevBtn, nextBtn);
    });
}

function scroll(contenedor, direction) {
    const scrollAmount = contenedor.clientWidth * 0.8;
    contenedor.scrollBy({
        left: direction === 'prev' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
    });
}

function updateArrowsVisibility(contenedor, prevBtn, nextBtn) {
    const isAtStart = contenedor.scrollLeft <= 0;
    const isAtEnd = contenedor.scrollLeft >= contenedor.scrollWidth - contenedor.clientWidth;

    prevBtn.style.display = isAtStart ? 'none' : 'block';
    nextBtn.style.display = isAtEnd ? 'none' : 'block';
}

function abrirCurso(cursoId) {
    window.location.href = `cursoView.html?id=${cursoId}`;
}

function setupBuscador() {
    const searchInput = document.getElementById('search-input');
    const resultadosContainer = document.getElementById('resultadosBusqueda');
    const headerSearch = document.getElementById('headerSearch');

    searchInput.addEventListener('input', (e) => {
        const busqueda = e.target.value.toLowerCase().trim();
        
        if (busqueda.length < 1) {
            resultadosContainer.style.display = 'none';
            return;
        }

        const resultados = todosLosCursos.filter(curso => 
            curso.titulo.toLowerCase().includes(busqueda) ||
            curso.instructor?.toLowerCase().includes(busqueda) ||
            curso.lenguaje?.toLowerCase().includes(busqueda)
        ).slice(0, 10); // Limitar a 10 resultados

        mostrarResultados(resultados, resultadosContainer);
    });

    // Cerrar resultados al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!headerSearch.contains(e.target)) {
            resultadosContainer.style.display = 'none';
        }
    });
}

function mostrarResultados(resultados, contenedor) {
    if (resultados.length === 0) {
        contenedor.innerHTML = '<div class="resultado-item">No se encontraron resultados</div>';
    } else {
        contenedor.innerHTML = resultados.map(curso => `
            <div class="resultado-item" onclick="abrirCurso(${curso.id})">
                <img src="${curso.imagen}" alt="${curso.titulo}" class="resultado-imagen">
                <div class="resultado-info">
                    <div class="resultado-titulo">${curso.titulo}</div>
                    <div class="resultado-instructor">
                        ${curso.instructor || 'Instructor no disponible'} • 
                        <span style="color: var(--primary-color)">${curso.lenguaje || 'Lenguaje no especificado'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    contenedor.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', cargarCursos);

// Agregar el código para el manejo del buscador en el header
const searchToggle = document.getElementById('searchToggle');
const searchClose = document.getElementById('searchClose');
const headerSearch = document.getElementById('headerSearch');
const searchInput = document.getElementById('search-input');

searchToggle.addEventListener('click', () => {
    headerSearch.classList.add('active');
    searchInput.focus();
});

searchClose.addEventListener('click', () => {
    headerSearch.classList.remove('active');
    searchInput.value = '';
    document.getElementById('resultadosBusqueda').style.display = 'none'; // Ocultar resultados
});