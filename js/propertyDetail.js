// propertyDetail.js - Lógica para la página de detalle de propiedad

import { getProperty } from './propertyService.js';

const propertyDetailContainer = document.getElementById('property-detail');

// Obtener ID de la URL
const urlParams = new URLSearchParams(window.location.search);
const propertyId = urlParams.get('id');

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    const isFirebaseConfigured = window.db && window.db._databaseId && window.db._databaseId.projectId !== "TU_PROJECT_ID_AQUI";
    
    if (propertyId && isFirebaseConfigured) {
        await loadPropertyDetail(propertyId);
    } else {
        // Mostrar propiedad demo si no hay ID o no hay Firebase
        showDemoProperty();
    }
});

// Cargar detalle de propiedad
async function loadPropertyDetail(id) {
    try {
        const property = await getProperty(id);
        if (property) {
            renderPropertyDetail(property);
        } else {
            // Si no se encuentra, mostrar demo
            showDemoProperty();
        }
    } catch (error) {
        console.error('Error loading property:', error);
        showDemoProperty();
    }
}

// Mostrar propiedad demo
function showDemoProperty() {
    const demoProperty = {
        title: "Hermoso Departamento en Núñez - DEMO",
        price: 250000,
        type: "Departamentos",
        operation: "venta",
        province: "Buenos Aires",
        zone: "Capital Federal",
        neighborhood: "Núñez",
        surface: 85,
        bedrooms: 2,
        bathrooms: 1,
        garage: 1,
        year: 2020,
        condition: "Excelente",
        features: ["Balcón", "Cocina equipada", "Piscina"],
        description: "Este es un ejemplo de propiedad demo. Una vez configures Firebase y agregues propiedades reales, verás los datos reales aquí.",
        images: [
            "https://via.placeholder.com/800x600?text=Imagen+1",
            "https://via.placeholder.com/800x600?text=Imagen+2"
        ]
    };
    renderPropertyDetail(demoProperty);
}

// Renderizar detalle
function renderPropertyDetail(property) {
    const mainImage = property.images && property.images[0] ? property.images[0] : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80';
    
    const thumbnailsHtml = property.images && property.images.length > 1
        ? property.images.slice(1, 4).map(img => `<img src="${img}" class="thumb-img" onclick="changeMainImage('${img}')">`).join('')
        : '';

    propertyDetailContainer.innerHTML = `
        <div class="detail-container">
            <div class="detail-header">
                <a href="index.html" class="back-link"><i class="fas fa-arrow-left"></i> Volver al listado</a>
                <div class="header-main">
                    <div>
                        <span class="detail-badge">${property.operation}</span>
                        <h1 class="detail-title">${property.title}</h1>
                        <p class="detail-location"><i class="fas fa-map-marker-alt"></i> ${property.neighborhood}, ${property.zone}</p>
                    </div>
                    <div class="detail-price-box">
                        <span class="price-label">Precio de ${property.operation}</span>
                        <span class="price-value">USD ${property.price.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="detail-gallery">
                <div class="main-image-container">
                    <img src="${mainImage}" id="main-detail-image" alt="${property.title}">
                </div>
                <div class="thumbnails">
                    ${thumbnailsHtml}
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-main-content">
                    <section class="detail-section">
                        <h2>Características Principales</h2>
                        <div class="features-grid">
                            <div class="feature-card">
                                <i class="fas fa-ruler-combined"></i>
                                <span>${property.surface}m² cubiertos</span>
                            </div>
                            <div class="feature-card">
                                <i class="fas fa-bed"></i>
                                <span>${property.bedrooms} Dormitorios</span>
                            </div>
                            <div class="feature-card">
                                <i class="fas fa-bath"></i>
                                <span>${property.bathrooms || 1} Baños</span>
                            </div>
                            <div class="feature-card">
                                <i class="fas fa-car"></i>
                                <span>${property.garage ? property.garage : 0} Cocheras</span>
                            </div>
                        </div>
                    </section>

                    <section class="detail-section">
                        <h2>Descripción</h2>
                        <p class="description-text">${property.description}</p>
                    </section>

                    <section class="detail-section">
                        <h2>Comodidades</h2>
                        <div class="amenities-list">
                            ${property.features ? property.features.map(f => `<span class="amenity-tag"><i class="fas fa-check"></i> ${f}</span>`).join('') : 'No especificadas'}
                        </div>
                    </section>
                </div>

                <aside class="detail-sidebar">
                    <div class="contact-card">
                        <h3>¿Te interesa esta propiedad?</h3>
                        <p>Contactate con uno de nuestros asesores para recibir más información.</p>
                        <button class="btn-primary full-width">Consultar por WhatsApp</button>
                        <button class="btn-secondary full-width">Llamar ahora</button>
                        <div class="agent-info">
                            <img src="https://via.placeholder.com/60/FF7F00/FFFFFF?text=UM" alt="Agent">
                            <div>
                                <strong>UMEN Inmobiliaria</strong>
                                <span>Asesor Comercial</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    `;
}

// Global function to change main image (if needed)
window.changeMainImage = (url) => {
    document.getElementById('main-detail-image').src = url;
};