// main.js - Lógica principal para la página de inicio

import { getProperties, getCategories, getProvinces } from './propertyService.js';

// Elementos DOM
const filtersContainer = document.getElementById('filters');
const propertyListContainer = document.getElementById('property-list');

// Estado
let properties = [];
let categories = [];
let provinces = [];
let currentFilters = {};

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación...');
    const isFirebaseConfigured = checkFirebaseConfig();
    
    if (isFirebaseConfigured) {
        await loadData();
    } else {
        console.warn('Firebase no está configurado. Usando modo demo.');
        useDemoData();
    }
    
    setupFilters();
    await loadProperties();
});

// Verificar si Firebase tiene credenciales reales
function checkFirebaseConfig() {
    // Si window.db no existe, Firebase falló en la inicialización
    if (!window.db) return false;
    
    // Podríamos verificar más a fondo, pero por ahora esto basta
    return true;
}

// Cargar datos demo de inmediato
function useDemoData() {
    categories = [
        { id: 'deptos', name: 'Departamentos' },
        { id: 'casas', name: 'Casas' },
        { id: 'oficinas', name: 'Oficinas' },
        { id: 'lotes', name: 'Lotes' }
    ];
    provinces = [
        { id: 'caba', name: 'Capital Federal' },
        { id: 'gba-norte', name: 'GBA Norte' },
        { id: 'gba-sur', name: 'GBA Sur' }
    ];
}

// Cargar datos iniciales
async function loadData() {
    try {
        categories = await getCategories();
        provinces = await getProvinces();
    } catch (error) {
        console.error('Error loading data:', error);
        // Usar datos demo si Firebase falla
        categories = [
            { id: 'deptos', name: 'Departamentos' },
            { id: 'casas', name: 'Casas' },
            { id: 'oficinas', name: 'Oficinas' }
        ];
        provinces = [
            { id: 'bsas', name: 'Buenos Aires' },
            { id: 'cba', name: 'Córdoba' }
        ];
    }
}

// Configurar filtros
function setupFilters() {
    filtersContainer.innerHTML = `
        <div class="filter-group">
            <h3>Operación</h3>
            <label class="filter-option">
                <input type="radio" name="operation" value="" checked> Todas
            </label>
            <label class="filter-option">
                <input type="radio" name="operation" value="venta"> Venta
            </label>
            <label class="filter-option">
                <input type="radio" name="operation" value="alquiler"> Alquiler
            </label>
        </div>

        <div class="filter-group">
            <h3>Tipo de Propiedad</h3>
            ${categories.map(cat => `
                <label class="filter-option">
                    <input type="checkbox" name="category" value="${cat.id}"> ${cat.name}
                </label>
            `).join('')}
        </div>

        <div class="filter-group">
            <h3>Ubicación</h3>
            <select id="province-select" class="filter-select">
                <option value="">Todas las provincias</option>
                ${provinces.map(prov => `<option value="${prov.id}">${prov.name}</option>`).join('')}
            </select>
        </div>

        <div class="filter-group">
            <h3>Precio</h3>
            <div class="price-inputs">
                <input type="number" id="min-price" placeholder="Mín" class="price-input">
                <input type="number" id="max-price" placeholder="Máx" class="price-input">
            </div>
        </div>
    `;

    // Add listeners to all inputs
    filtersContainer.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', handleFilterChange);
    });

    document.getElementById('clear-filters').addEventListener('click', () => {
        filtersContainer.querySelectorAll('input[type="radio"]').forEach(r => r.checked = r.value === "");
        filtersContainer.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
        filtersContainer.querySelectorAll('select, input[type="number"]').forEach(i => i.value = "");
        handleFilterChange();
    });
}

// Manejar cambio en filtros
async function handleFilterChange() {
    const selectedOperation = filtersContainer.querySelector('input[name="operation"]:checked').value;
    const selectedCategories = Array.from(filtersContainer.querySelectorAll('input[name="category"]:checked')).map(c => c.value);
    const selectedProvince = document.getElementById('province-select').value;
    const minPrice = document.getElementById('min-price').value;
    const maxPrice = document.getElementById('max-price').value;

    currentFilters = {
        operation: selectedOperation,
        category: selectedCategories.length > 0 ? selectedCategories : null,
        province: selectedProvince,
        minPrice: minPrice,
        maxPrice: maxPrice
    };

    await loadProperties();
}

// Cargar propiedades
async function loadProperties() {
    try {
        if (!window.db || (window.db && window.db._databaseId && window.db._databaseId.projectId === "TU_PROJECT_ID_AQUI")) {
             showDemoProperties();
             return;
        }

        properties = await getProperties(currentFilters);
        if (properties.length === 0) {
            // Si no hay propiedades, mostrar demo
            showDemoProperties();
        } else {
            renderProperties();
        }
    } catch (error) {
        console.error('Error loading properties:', error);
        showDemoProperties();
    }
}

// Mostrar propiedades demo
function showDemoProperties() {
    properties = [
        {
            id: 'demo1',
            title: 'Hermoso Departamento en Núñez',
            price: 250000,
            type: 'Departamentos',
            operation: 'venta',
            neighborhood: 'Núñez',
            zone: 'Capital Federal',
            surface: 85,
            bedrooms: 2,
            images: ['https://via.placeholder.com/400x300?text=Depto+Nunez']
        },
        {
            id: 'demo2',
            title: 'Casa en Villa Urquiza',
            price: 350000,
            type: 'Casas',
            operation: 'venta',
            neighborhood: 'Villa Urquiza',
            zone: 'Capital Federal',
            surface: 120,
            bedrooms: 3,
            images: ['https://via.placeholder.com/400x300?text=Casa+Urquiza']
        },
        {
            id: 'demo3',
            title: 'Oficina en Microcentro',
            price: 180000,
            type: 'Oficinas',
            operation: 'alquiler',
            neighborhood: 'Microcentro',
            zone: 'Capital Federal',
            surface: 60,
            bedrooms: 0,
            images: ['https://via.placeholder.com/400x300?text=Oficina+Centro']
        }
    ];
    renderProperties();
}

// Renderizar propiedades
function renderProperties() {
    const resultsCount = document.getElementById('results-count');
    const resultsTitle = document.getElementById('results-title');
    
    resultsCount.textContent = `${properties.length} resultados`;
    
    if (properties.length === 0) {
        propertyListContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No se encontraron propiedades que coincidan con tu búsqueda.</p>
            </div>
        `;
        return;
    }

    propertyListContainer.innerHTML = properties.map(property => `
        <div class="property-card" onclick="viewProperty('${property.id}')">
            <div class="card-image">
                <img src="${property.images && property.images[0] ? property.images[0] : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80'}" alt="${property.title}">
                <div class="card-badge">${property.operation}</div>
            </div>
            <div class="card-content">
                <div class="card-price">USD ${property.price.toLocaleString()}</div>
                <h3 class="card-title">${property.title}</h3>
                <div class="card-location">
                    <i class="fas fa-map-marker-alt"></i> ${property.neighborhood}, ${property.zone}
                </div>
                <div class="card-features">
                    <div class="feature-item">
                        <i class="fas fa-ruler-combined"></i> ${property.surface}m²
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-bed"></i> ${property.bedrooms} Amb.
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-bath"></i> ${property.bathrooms || 1} Baños
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Ver propiedad (redirigir a detalle)
window.viewProperty = function(id) {
    window.location.href = `property-detail.html?id=${id}`;
}