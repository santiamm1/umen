// main.js - Lógica principal premium para la página de inicio (Estilo Toribio Achával)

import { getProperties, getCategories, getProvinces, getBlogPosts } from './propertyService.js?v=4';
import { cardFeaturesHTML, cardCodeHTML, cardTypeStripHTML } from './cardFeatures.js?v=4';

// Elementos DOM — se asignan luego de que el header partial se inyecte
let header;
let propertyTypeSelect;
let searchBtn;
let quickSearchInput;
const propertyListContainer = document.getElementById('property-list');
const resultsTitle         = document.getElementById('results-title');
const resultsCount         = document.getElementById('results-count');
const sortOrderSelect      = document.getElementById('sort-order');
const activeFiltersContainer = document.getElementById('active-filters');

// Estado
let properties = [];
let categories = [];
let provinces = [];
let currentFilters = {
    operation: 'venta',
    category: null,
    province: null,
    neighborhood: null,
    zone: null,
    keyword: ''
};

// Inicializar
(async () => {
    // Esperar hasta 3s a que Firebase inicialice
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    // Esperar a que el header partial se inyecte en el DOM
    attempts = 0;
    while (!document.getElementById('header') && attempts < 50) {
        await new Promise(r => setTimeout(r, 50));
        attempts++;
    }

    // Asignar refs que dependen del header partial
    header            = document.getElementById('header');
    propertyTypeSelect = document.getElementById('property-type');
    searchBtn         = document.getElementById('search-btn');
    quickSearchInput  = document.getElementById('quicksearch');

    setupHeaderScroll();
    setupScrollReveal();

    // Categorías/provincias (para los filtros) y las 3 secciones de propiedades/blog
    // son independientes entre sí: se piden todas en paralelo en vez de una tras otra.
    const isFirebaseConfigured = checkFirebaseConfig();
    const dataPromise = isFirebaseConfigured ? loadData() : Promise.resolve(useDemoData());
    const searchPromise = executeSearch();
    const rentalsPromise = renderFeaturedRentals();
    const novedadesPromise = renderNovedades();
    const categoriesTilePromise = isFirebaseConfigured ? renderMasPropiedadesCategories() : Promise.resolve();

    await dataPromise;
    populatePropertyTypes();
    setupCustomSelect();
    setupSearchBox();
    setupHighlightLinks();

    sortOrderSelect.addEventListener('change', () => sortAndRenderProperties());

    await Promise.all([searchPromise, rentalsPromise, novedadesPromise, categoriesTilePromise]);
})();

// Tile "Más Propiedades": solo muestra las categorías que efectivamente
// tienen propiedades cargadas (ej. si "Casas" existe como categoría pero
// no tiene ninguna propiedad, no aparece).
async function renderMasPropiedadesCategories() {
    const container = document.getElementById('cat-mas-subcats');
    if (!container) return;

    try {
        const [cats, allProperties] = await Promise.all([
            getCategories(),
            getProperties({ limit: 5000 })
        ]);

        const counts = {};
        allProperties.forEach(p => { if (p.type) counts[p.type] = (counts[p.type] || 0) + 1; });

        const withStock = cats.filter(c => c.name !== 'Hotel' && counts[c.name] > 0);

        container.innerHTML = withStock
            .map(c => `<a class="destacado-pill" href="propiedades.html?category=${encodeURIComponent(c.name)}">${c.name}</a>`)
            .join('');
    } catch (error) {
        console.error('Error al cargar categorías con stock:', error);
    }
}

// Verificar si Firebase está inicializado
function checkFirebaseConfig() {
    return !!window.db;
}

// Cargar datos reales
async function loadData() {
    try {
        [categories, provinces] = await Promise.all([getCategories(), getProvinces()]);
    } catch (error) {
        console.error('Error al cargar datos de Firebase:', error);
        useDemoData();
    }
}

// Datos demo en caso de no haber Firebase o dar error
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

// Popular select de categorías en el Hero
function populatePropertyTypes() {
    // Mantiene el select nativo sincronizado (usado por el resto del código)
    // El valor usa el nombre de la categoría: es lo que Firestore guarda en el campo 'type' de cada propiedad
    propertyTypeSelect.innerHTML = `
        <option value="">Todo tipo de propiedades</option>
        ${categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('')}
    `;

    // Popula el dropdown visual custom
    const dropdown = document.querySelector('#custom-property-type .custom-select-dropdown');
    if (!dropdown) return;
    const options = [
        { value: '', label: 'Todo tipo de propiedades' },
        ...categories.map(cat => ({ value: cat.name, label: cat.name }))
    ];
    dropdown.innerHTML = options.map(o =>
        `<li class="custom-select-option${o.value === '' ? ' selected' : ''}"
             role="option" data-value="${o.value}">${o.label}</li>`
    ).join('');
}

// Manejo del custom select de tipo de propiedad
function setupCustomSelect() {
    const customSelect = document.getElementById('custom-property-type');
    if (!customSelect) return;

    const trigger  = customSelect.querySelector('.custom-select-trigger');
    const dropdown = customSelect.querySelector('.custom-select-dropdown');
    const display  = customSelect.querySelector('.custom-select-value');

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        customSelect.classList.toggle('open');
    });

    dropdown.addEventListener('click', e => {
        const opt = e.target.closest('.custom-select-option');
        if (!opt) return;

        display.textContent = opt.textContent;
        propertyTypeSelect.value = opt.dataset.value;
        propertyTypeSelect.dispatchEvent(new Event('change'));

        dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        customSelect.classList.remove('open');
    });

    document.addEventListener('click', () => customSelect.classList.remove('open'));
}

// Configurar comportamiento del Header al hacer scroll
function setupHeaderScroll() {
    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', handleScroll);
    // Ejecutar una vez al inicio en caso de recargar con scroll
    handleScroll();

    // header es fixed y su alto varía según ancho de viewport (wrap de topbar/nav) —
    // se mide en vivo para que el hero siempre reserve el espacio justo debajo.
    const syncHeaderHeight = () => {
        document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    };
    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);
    window.addEventListener('load', syncHeaderHeight);
}

// Animar entrada de las tarjetas de categorías al hacer scroll
function setupScrollReveal() {
    const items = document.querySelectorAll('#destacado .destacado-grid > *');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    items.forEach((item, i) => {
        item.style.transitionDelay = `${i * 80}ms`;
        observer.observe(item);
    });
}

// Configurar elementos interactivos del buscador del Hero
function setupSearchBox() {
    // Escuchar cambios en las pestañas Venta / Alquiler
    document.querySelectorAll('input[name="operation"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentFilters.operation = e.target.value;
            executeSearch();
        });
    });

    // Escuchar cambio en el select del tipo de propiedad
    propertyTypeSelect.addEventListener('change', (e) => {
        currentFilters.category = e.target.value || null;
        executeSearch();
    });

    // Escuchar clic en el botón de búsqueda con lupa
    searchBtn.addEventListener('click', goToPropiedadesConFiltros);

    // Escuchar tecla Enter en el input
    quickSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') goToPropiedadesConFiltros();
    });
}

// La búsqueda del hero lleva al listado completo de propiedades, no a la sección destacada del home
function goToPropiedadesConFiltros() {
    const params = new URLSearchParams();
    params.set('operation', currentFilters.operation);
    if (propertyTypeSelect.value) params.set('category', propertyTypeSelect.value);
    const keyword = quickSearchInput.value.trim();
    if (keyword) params.set('keyword', keyword);
    window.location.href = `propiedades.html?${params.toString()}`;
}

// Configurar links rápidos de la grilla destacados
function setupHighlightLinks() {
    // Links rápidos de Residencial (por barrio)
    document.querySelectorAll('.quick-link-filter').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const neighborhood = link.getAttribute('data-neighborhood');
            const zone = link.getAttribute('data-zone');
            const province = link.getAttribute('data-province');
            
            // Limpiar filtros anteriores y configurar los del clic
            resetFilters();
            
            if (neighborhood) {
                currentFilters.neighborhood = neighborhood;
                quickSearchInput.value = neighborhood;
            }
            if (zone) {
                currentFilters.zone = zone;
                quickSearchInput.value = zone;
            }
            if (province) {
                currentFilters.province = province;
            }
            
            executeSearch(true); // Hace scroll y ejecuta
        });
    });

    // Links rápidos de Comercial (por categoría)
    document.querySelectorAll('.quick-link-category').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const catId = link.getAttribute('data-category');
            
            resetFilters();
            currentFilters.category = catId;
            propertyTypeSelect.value = catId;
            
            executeSearch(true);
        });
    });
}

// Limpiar filtros activos
function resetFilters() {
    currentFilters = {
        operation: 'venta',
        category: null,
        province: null,
        neighborhood: null,
        zone: null,
        keyword: ''
    };
    quickSearchInput.value = '';
    propertyTypeSelect.value = '';
    document.getElementById('comprar').checked = true;
}

// Ejecutar búsqueda y renderizar propiedades
async function executeSearch(shouldScroll = false) {
    propertyListContainer.innerHTML = `<div class="loader"><i class="fas fa-spinner fa-spin"></i> Buscando propiedades...</div>`;
    
    // Actualizar título de la sección de resultados según la operación seleccionada
    const opText = currentFilters.operation === 'venta' ? 'en Venta' : 'en Alquiler';
    resultsTitle.textContent = `Propiedades ${opText}`;

    try {
        // Ejecutar llamada a Firebase Firestore
        // Pasamos filtros exactos de Firebase: category, operation, province
        const apiFilters = {
            operation: currentFilters.operation,
            limit: 12 // el home solo muestra 6 destacadas; margen extra por si se filtra por keyword
        };
        
        if (currentFilters.category) {
            apiFilters.category = currentFilters.category;
        }

        if (currentFilters.province) {
            apiFilters.province = currentFilters.province;
        }

        // Obtener propiedades: primero las favoritas (estrella en el admin) con una
        // consulta propia — así aparecen siempre, sin depender de que caigan dentro
        // del lote acotado que trae la consulta general — y se completa con las
        // más recientes si hay menos de 6 marcadas.
        let results = [];
        if (checkFirebaseConfig() && window.db._databaseId && window.db._databaseId.projectId !== "TU_PROJECT_ID_AQUI") {
            const [featured, recent] = await Promise.all([
                getProperties({ ...apiFilters, featured: true, limit: 6 }),
                getProperties(apiFilters)
            ]);
            const featuredIds = new Set(featured.map(p => p.id));
            results = [...featured, ...recent.filter(p => !featuredIds.has(p.id))];
        } else {
            results = getDemoProperties();
        }

        // 1. Filtrar en memoria por palabra clave si existe (búsqueda inteligente e intuitiva)
        if (currentFilters.keyword) {
            const kw = currentFilters.keyword.toLowerCase();
            results = results.filter(p =>
                p.title.toLowerCase().includes(kw) ||
                (p.neighborhood && p.neighborhood.toLowerCase().includes(kw)) ||
                (p.zone && p.zone.toLowerCase().includes(kw)) ||
                (p.description && p.description.toLowerCase().includes(kw)) ||
                (p.type && p.type.toLowerCase().includes(kw)) ||
                (kw.includes('buenos aires') && p.zone && isZonaBuenosAires(p.zone))
            );
        }

        // 2. Filtrar en memoria por barrio si viene de los links rápidos
        if (currentFilters.neighborhood) {
            const nh = currentFilters.neighborhood.toLowerCase();
            results = results.filter(p => 
                p.neighborhood && p.neighborhood.toLowerCase().includes(nh)
            );
        }

        // 3. Filtrar en memoria por zona
        if (currentFilters.zone) {
            const z = currentFilters.zone.toLowerCase();
            results = results.filter(p => p.zone && p.zone.toLowerCase().includes(z));
        }

        // Los hoteles tienen su propia sección; no duplicar acá salvo que se
        // haya elegido explícitamente esa categoría en el buscador.
        if (currentFilters.category !== 'Hotel') {
            results = results.filter(p => p.type !== 'Hotel');
        }

        // Home: las favoritas ya vienen primero (ver fetch más arriba).
        properties = results.slice(0, 6);

        // Renderizar y ordenar
        sortAndRenderProperties();
        renderActiveFilters();

        // Si es necesario, scroll suave a los resultados
        if (shouldScroll) {
            const resultsSection = document.getElementById('property-results');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

    } catch (error) {
        console.error('Error al realizar búsqueda:', error);
        properties = getDemoProperties();
        sortAndRenderProperties();
        renderActiveFilters();
    }
}

// Renderizar tags de filtros activos
function renderActiveFilters() {
    let tagsHtml = [];

    // Tag de operación
    tagsHtml.push(`
        <span class="filter-tag" onclick="removeFilter('operation')">
            Operación: ${currentFilters.operation === 'venta' ? 'Venta' : 'Alquiler'} <i class="fas fa-times"></i>
        </span>
    `);

    // Tag de tipo
    if (currentFilters.category) {
        const catObj = categories.find(c => c.id === currentFilters.category);
        const catName = catObj ? catObj.name : currentFilters.category;
        tagsHtml.push(`
            <span class="filter-tag" onclick="removeFilter('category')">
                Tipo: ${catName} <i class="fas fa-times"></i>
            </span>
        `);
    }

    // Tag de palabra clave
    if (currentFilters.keyword) {
        tagsHtml.push(`
            <span class="filter-tag" onclick="removeFilter('keyword')">
                Búsqueda: "${currentFilters.keyword}" <i class="fas fa-times"></i>
            </span>
        `);
    }

    // Tag de barrio
    if (currentFilters.neighborhood) {
        tagsHtml.push(`
            <span class="filter-tag" onclick="removeFilter('neighborhood')">
                Barrio: ${currentFilters.neighborhood} <i class="fas fa-times"></i>
            </span>
        `);
    }

    // Tag de zona
    if (currentFilters.zone) {
        tagsHtml.push(`
            <span class="filter-tag" onclick="removeFilter('zone')">
                Zona: ${currentFilters.zone} <i class="fas fa-times"></i>
            </span>
        `);
    }

    if (activeFiltersContainer) activeFiltersContainer.innerHTML = tagsHtml.join('');
}

// Remover un filtro individual
window.removeFilter = function(filterKey) {
    if (filterKey === 'operation') {
        // No se puede remover operación completa, volvemos a venta por defecto
        currentFilters.operation = 'venta';
        document.getElementById('comprar').checked = true;
    } else if (filterKey === 'category') {
        currentFilters.category = null;
        propertyTypeSelect.value = '';
    } else if (filterKey === 'keyword') {
        currentFilters.keyword = '';
        quickSearchInput.value = '';
    } else {
        currentFilters[filterKey] = null;
        quickSearchInput.value = '';
    }
    executeSearch(true);
};

// Ordenar propiedades en memoria y renderizarlas
function sortAndRenderProperties() {
    const sortVal = sortOrderSelect.value;

    if (sortVal === 'price-asc') {
        properties.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'price-desc') {
        properties.sort((a, b) => b.price - a.price);
    } else {
        // newest - ordenar por ID o createdAt descendente
        properties.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB - dateA;
        });
    }

    renderProperties();
}

// Renderizar las propiedades en la grilla
function renderProperties() {
    resultsCount.textContent = `${properties.length} propiedades encontradas`;

    if (properties.length === 0) {
        propertyListContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search-minus"></i>
                <p>No se encontraron propiedades que coincidan con los criterios seleccionados.</p>
            </div>
        `;
        return;
    }

    propertyListContainer.innerHTML = properties.map(property => {
        const coverImg = property.images && property.images[0]
            ? property.images[0]
            : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80';
        // Los hoteles viven en Hoteles en Venta: la card redirige a la ficha original allá.
        const isExternalHotel = property.type === 'Hotel' && property.externalUrl;
        const linkAttrs = isExternalHotel
            ? `href="${property.externalUrl}" target="_blank" rel="noopener noreferrer"`
            : `href="property-detail.html?v=3&id=${property.id}"`;

        return `
            <a class="property-card" ${linkAttrs}>
                <div class="card-image">
                    <img src="${coverImg}" alt="${property.title}">
                    <div class="card-badge${property.operation === 'alquiler' ? ' card-badge-alquiler' : ''}">${property.operation}</div>
                </div>
                <div class="card-content">
                    ${cardTypeStripHTML(property)}
                    <div class="card-price">USD ${property.price.toLocaleString()}</div>
                    ${property.tag ? `<span class="card-tag-label">${property.tag}</span>` : ''}
                    <h3 class="card-title">${property.title}</h3>
                    ${cardCodeHTML(property)}
                    <div class="card-location">
                        <i class="fas fa-map-marker-alt"></i> ${property.neighborhood ? property.neighborhood : 'Sin barrio'}, ${property.zone ? property.zone : 'Capital Federal'}
                    </div>
                    <div class="card-features">${cardFeaturesHTML(property)}</div>
                </div>
            </a>
        `;
    }).join('');
}

// Redirigir al detalle de la propiedad
window.viewProperty = function(id) {
    window.location.href = `property-detail.html?id=${id}`;
};

// Renderizar los 6 hoteles favoritos (estrella en el admin); si hay menos
// de 6 marcados, se completa con los más recientes.
async function renderFeaturedRentals() {
    const container = document.getElementById('rental-list');
    if (!container) return;

    let hotels = [];
    try {
        const [featured, recent] = await Promise.all([
            getProperties({ category: 'Hotel', featured: true, limit: 6 }),
            getProperties({ category: 'Hotel', limit: 100 })
        ]);
        const featuredIds = new Set(featured.map(h => h.id));
        hotels = [...featured, ...recent.filter(h => !featuredIds.has(h.id))].slice(0, 6);
    } catch {
        hotels = [];
    }

    if (hotels.length === 0) {
        container.innerHTML = `<div class="no-results"><i class="fas fa-search-minus"></i><p>Todavía no hay hoteles cargados.</p></div>`;
        return;
    }

    const FALLBACK_IMG = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    container.innerHTML = hotels.map(property => {
        const coverImg = property.images && property.images[0]
            ? property.images[0]
            : FALLBACK_IMG;
        // Los hoteles viven en Hoteles en Venta: la card redirige a la ficha original allá.
        const linkAttrs = property.externalUrl
            ? `href="${property.externalUrl}" target="_blank" rel="noopener noreferrer"`
            : `href="property-detail.html?v=3&id=${property.id}"`;
        return `
            <a class="property-card" ${linkAttrs}>
                <div class="card-image">
                    <img src="${coverImg}" alt="${property.title}">
                    <div class="card-badge${property.operation === 'alquiler' ? ' card-badge-alquiler' : ''}">${property.operation}</div>
                </div>
                <div class="card-content">
                    ${cardTypeStripHTML(property)}
                    <div class="card-price">USD ${property.price.toLocaleString()}</div>
                    ${property.tag ? `<span class="card-tag-label">${property.tag}</span>` : ''}
                    <h3 class="card-title">${property.title}</h3>
                    ${cardCodeHTML(property)}
                    <div class="card-location">
                        <i class="fas fa-map-marker-alt"></i> ${property.neighborhood || 'Sin barrio'}, ${property.zone || 'Capital Federal'}
                    </div>
                    <div class="card-features">${cardFeaturesHTML(property)}
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

// Renderizar las últimas 3 notas del blog en el home
async function renderNovedades() {
    const container = document.getElementById('novedades-list');
    if (!container) return;

    let posts = [];
    try {
        posts = await getBlogPosts(6); // el home solo muestra las últimas 3
    } catch {
        posts = [];
    }

    const latest = posts.slice(0, 3);
    if (latest.length === 0) {
        container.innerHTML = `<div class="no-results"><i class="fas fa-search-minus"></i><p>Todavía no hay notas publicadas.</p></div>`;
        return;
    }

    const FALLBACK_IMG = 'https://images.unsplash.com/photo-1560184897-ae75f418493e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=65';
    container.innerHTML = latest.map(post => `
        <a href="${post.slug ? 'blog-post.html?slug=' + post.slug : 'blog-post.html?id=' + post.id}" class="item">
            <div class="media">
                <img src="${post.image || FALLBACK_IMG}" alt="${post.title}">
                <span class="cat">${post.category || 'Novedades'}</span>
            </div>
            <div class="item-content">
                <h4>${post.title}</h4>
                <p class="item-excerpt">${post.excerpt || ''}</p>
                <span class="item-more">Leer más <i class="fas fa-arrow-right"></i></span>
            </div>
        </a>
    `).join('');
}

// Generar propiedades demo estéticas si Firebase está vacío o desconfigurado
// Las zonas 'Capital Federal' y 'GBA *' son todas parte del área metropolitana de Buenos Aires
function isZonaBuenosAires(zone) {
    const z = zone.toLowerCase();
    return z.startsWith('capital federal') || z.startsWith('gba');
}

function getDemoProperties() {
    return [
        {
            id: 'demo-recoleta',
            title: 'Exclusivo Semipiso sobre Av. Alvear',
            price: 780000,
            type: 'deptos',
            operation: 'venta',
            neighborhood: 'Recoleta',
            zone: 'Capital Federal',
            surface: 240,
            bedrooms: 4,
            bathrooms: 3,
            images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-palermo',
            title: 'Penthouse Moderno con Vista al Parque',
            price: 590000,
            type: 'deptos',
            operation: 'venta',
            neighborhood: 'Palermo',
            zone: 'Capital Federal',
            surface: 165,
            bedrooms: 3,
            bathrooms: 2,
            images: ['https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-pilar',
            title: 'Imponente Casa en Barrio Cerrado Estancias',
            price: 450000,
            type: 'casas',
            operation: 'venta',
            neighborhood: 'Pilar',
            zone: 'GBA Norte',
            surface: 380,
            bedrooms: 5,
            bathrooms: 4,
            images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-belgrano',
            title: 'Oficina Comercial en Belgrano C',
            price: 2800,
            type: 'oficinas',
            operation: 'alquiler',
            neighborhood: 'Belgrano',
            zone: 'Capital Federal',
            surface: 110,
            bedrooms: 3,
            bathrooms: 2,
            images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-nordelta',
            title: 'Departamento con Terraza en El Palmar',
            price: 1800,
            type: 'deptos',
            operation: 'alquiler',
            neighborhood: 'Tigre',
            zone: 'GBA Norte',
            surface: 85,
            bedrooms: 2,
            bathrooms: 2,
            images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-sanisidro',
            title: 'Casa Quinta Colonial con Piscina y Parque',
            price: 650000,
            type: 'casas',
            operation: 'venta',
            neighborhood: 'San Isidro',
            zone: 'GBA Norte',
            surface: 420,
            bedrooms: 5,
            bathrooms: 3,
            images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        }
    ];
}