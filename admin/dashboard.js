class Dashboard {
    constructor() {
        this.init();
    }

    init() {
        this.cargarEstadisticas();
    }

    async cargarEstadisticas() {
        try {
            // Cargar películas
            const peliculasResponse = await fetch('../DataBase/peliculas.json');
            const peliculasData = await peliculasResponse.json();
            document.querySelector('.stat-card:nth-child(1) .stat-number').textContent = 
                peliculasData.peliculas?.length || 0;

            // Cargar series
            const seriesResponse = await fetch('../DataBase/series.json');
            const seriesData = await seriesResponse.json();
            document.querySelector('.stat-card:nth-child(2) .stat-number').textContent = 
                seriesData.series?.length || 0;

        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    }
}

// Inicializar dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
}); 