// propiedades.js - Página de listado completo de propiedades UMEN

import { getProperties, getCategories } from './propertyService.js';

const ITEMS_PER_PAGE = 12;

let categories = [];
let allResults = [];
let currentPage = 1;

let currentFilters = {
    operation: 'venta',
    category: null,
    priceMin: null,
    priceMax: null,
    rooms: null,
    bedrooms: null,
    surfaceMin: null,
    surfaceMax: null,
    keyword: ''
};

// DOM refs
const header              = document.getElementById('header');
const mobileMenuBtn       = document.getElementById('mobile-menu-btn');
const navMenu             = document.getElementById('nav-menu');
const propertyTypeSelect  = document.getElementById('property-type');
const propertyList        = document.getElementById('property-list');
const searchBtn           = document.getElementById('search-btn');
const quicksearch         = document.getElementById('quicksearch');
const resultsTitle        = document.getElementById('results-title');
const resultsCount        = document.getElementById('results-count');
const sortOrder           = document.getElementById('sort-order');
const activeFiltersEl     = document.getElementById('active-filters');
const clearAllBtn         = document.getElementById('clear-all-filters');
const priceMinInput       = document.getElementById('price-min');
const priceMaxInput       = document.getElementById('price-max');
const surfaceMinInput     = document.getElementById('surface-min');
const surfaceMaxInput     = document.getElementById('surface-max');
const paginationEl        = document.getElementById('pagination');
const filterToggleBtn     = document.getElementById('filter-toggle-btn');
const filtersSidebar      = document.getElementById('filters-sidebar');
const sidebarOverlay      = document.getElementById('sidebar-overlay');
const viewGridBtn         = document.getElementById('view-grid');
const viewListBtn         = document.getElementById('view-list');

document.addEventListener('DOMContentLoaded', async () => {
    // Header siempre sólido en esta página (no hay hero de video)
    header.classList.add('scrolled');
    window.addEventListener('scroll', () => header.classList.add('scrolled'));

    setupMobileMenu();
    setupFilterToggle();

    if (window.db) {
        try {
            categories = await getCategories();
            if (categories.length === 0) useDefaultCategories();
        } catch {
            useDefaultCategories();
        }
    } else {
        useDefaultCategories();
    }

    populatePropertyTypes();
    setupCustomSelect();
    setupSearchBox();
    setupNumberFilterBtns();
    setupRangeFilters();
    setupViewToggle();

    sortOrder.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
    clearAllBtn.addEventListener('click', clearAllFilters);

    await fetchAndRender();
});

// ── Datos por defecto ─────────────────────────────────────────────────────────

function useDefaultCategories() {
    categories = [
        { id: 'deptos',   name: 'Departamentos' },
        { id: 'casas',    name: 'Casas' },
        { id: 'oficinas', name: 'Oficinas' },
        { id: 'lotes',    name: 'Lotes' },
        { id: 'hoteles',  name: 'Hoteles' }
    ];
}

// ── Setup: tipos de propiedad ─────────────────────────────────────────────────

function populatePropertyTypes() {
    propertyTypeSelect.innerHTML = `
        <option value="">Todo tipo de propiedades</option>
        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
    `;

    const dropdown = document.querySelector('#custom-property-type .custom-select-dropdown');
    if (!dropdown) return;
    const options = [
        { value: '', label: 'Todo tipo de propiedades' },
        ...categories.map(c => ({ value: c.id, label: c.name }))
    ];
    dropdown.innerHTML = options.map((o, i) =>
        `<li class="custom-select-option${i === 0 ? ' selected' : ''}" role="option" data-value="${o.value}">${o.label}</li>`
    ).join('');
}

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
        dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        customSelect.classList.remove('open');
        currentFilters.category = opt.dataset.value || null;
        currentPage = 1;
        fetchAndRender();
    });

    document.addEventListener('click', () => customSelect.classList.remove('open'));
}

// ── Setup: menú móvil ─────────────────────────────────────────────────────────

function setupMobileMenu() {
    mobileMenuBtn.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        const icon = mobileMenuBtn.querySelector('i');
        if (navMenu.classList.contains('active')) {
            icon.className = 'fas fa-times';
            Object.assign(navMenu.style, {
                display: 'flex', flexDirection: 'column',
                position: 'absolute', top: '100%',
                left: '0', width: '100%',
                backgroundColor: '#111', padding: '20px',
                zIndex: '999'
            });
        } else {
            icon.className = 'fas fa-bars';
            navMenu.style.cssText = '';
        }
    });
}

// ── Setup: toggle sidebar en mobile ──────────────────────────────────────────

function setupFilterToggle() {
    if (!filterToggleBtn || !filtersSidebar) return;

    filterToggleBtn.addEventListener('click', () => {
        const isOpen = filtersSidebar.classList.toggle('open');
        filterToggleBtn.innerHTML = isOpen
            ? '<i class="fas fa-times"></i> Cerrar'
            : '<i class="fas fa-sliders-h"></i> Filtros';
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active', isOpen);
    });

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            filtersSidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
            filterToggleBtn.innerHTML = '<i class="fas fa-sliders-h"></i> Filtros';
        });
    }
}

// ── Setup: barra de búsqueda ──────────────────────────────────────────────────

function setupSearchBox() {
    document.querySelectorAll('input[name="operation"]').forEach(radio => {
        radio.addEventListener('change', e => {
            currentFilters.operation = e.target.value;
            currentPage = 1;
            fetchAndRender();
        });
    });

    searchBtn.addEventListener('click', () => {
        currentFilters.keyword = quicksearch.value.trim().toLowerCase();
        currentPage = 1;
        applyFiltersAndRender();
    });

    quicksearch.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            currentFilters.keyword = quicksearch.value.trim().toLowerCase();
            currentPage = 1;
            applyFiltersAndRender();
        }
    });
}

// ── Setup: botones de número (ambientes / dormitorios) ────────────────────────

function setupNumberFilterBtns() {
    setupBtnGroup('filter-rooms',    'rooms');
    setupBtnGroup('filter-bedrooms', 'bedrooms');
}

function setupBtnGroup(containerId, filterKey) {
    document.querySelectorAll(`#${containerId} .filter-number-btn`).forEach(btn => {
        btn.addEventListener('click', () => {
            const wasActive = btn.classList.contains('active');
            document.querySelectorAll(`#${containerId} .filter-number-btn`).forEach(b => b.classList.remove('active'));
            if (!wasActive) {
                btn.classList.add('active');
                currentFilters[filterKey] = btn.dataset.value;
            } else {
                currentFilters[filterKey] = null;
            }
            currentPage = 1;
            applyFiltersAndRender();
        });
    });
}

// ── Setup: inputs de rango (precio / superficie) ──────────────────────────────

function setupRangeFilters() {
    const apply = () => {
        currentFilters.priceMin   = priceMinInput.value   ? parseInt(priceMinInput.value)   : null;
        currentFilters.priceMax   = priceMaxInput.value   ? parseInt(priceMaxInput.value)   : null;
        currentFilters.surfaceMin = surfaceMinInput.value ? parseInt(surfaceMinInput.value) : null;
        currentFilters.surfaceMax = surfaceMaxInput.value ? parseInt(surfaceMaxInput.value) : null;
        currentPage = 1;
        applyFiltersAndRender();
    };
    [priceMinInput, priceMaxInput, surfaceMinInput, surfaceMaxInput].forEach(input => {
        input.addEventListener('change', apply);
    });
}

// ── Setup: toggle grilla / lista ──────────────────────────────────────────────

function setupViewToggle() {
    if (!viewGridBtn || !viewListBtn) return;

    viewGridBtn.addEventListener('click', () => {
        viewGridBtn.classList.add('active');
        viewListBtn.classList.remove('active');
        propertyList.classList.remove('list-view');
    });

    viewListBtn.addEventListener('click', () => {
        viewListBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        propertyList.classList.add('list-view');
    });
}

// ── Fetch datos y renderizar ──────────────────────────────────────────────────

async function fetchAndRender() {
    propertyList.innerHTML = `<div class="loader"><i class="fas fa-spinner fa-spin"></i> Cargando propiedades de UMEN...</div>`;
    updateResultsTitle();

    let results = [];
    try {
        const firebaseReady = window.db && window.db._databaseId?.projectId !== 'TU_PROJECT_ID_AQUI';

        if (firebaseReady) {
            const apiFilters = { operation: currentFilters.operation };
            if (currentFilters.category) apiFilters.category = currentFilters.category;
            results = await getProperties(apiFilters);
            if (results.length === 0) results = getDemoProperties();
        } else {
            results = getDemoProperties();
        }
    } catch {
        results = getDemoProperties();
    }

    allResults = results;
    applyFiltersAndRender();
}

// ── Aplicar filtros en memoria y renderizar ───────────────────────────────────

function applyFiltersAndRender() {
    updateResultsTitle();
    let filtered = [...allResults];

    if (currentFilters.keyword) {
        const kw = currentFilters.keyword;
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(kw) ||
            (p.neighborhood && p.neighborhood.toLowerCase().includes(kw)) ||
            (p.zone && p.zone.toLowerCase().includes(kw)) ||
            (p.description && p.description.toLowerCase().includes(kw)) ||
            (p.type && p.type.toLowerCase().includes(kw))
        );
    }

    if (currentFilters.priceMin !== null) filtered = filtered.filter(p => p.price >= currentFilters.priceMin);
    if (currentFilters.priceMax !== null) filtered = filtered.filter(p => p.price <= currentFilters.priceMax);
    if (currentFilters.surfaceMin !== null) filtered = filtered.filter(p => (p.surface || 0) >= currentFilters.surfaceMin);
    if (currentFilters.surfaceMax !== null) filtered = filtered.filter(p => (p.surface || 0) <= currentFilters.surfaceMax);

    if (currentFilters.rooms) {
        const r = currentFilters.rooms;
        filtered = r === '4+'
            ? filtered.filter(p => (p.bedrooms || 0) >= 4)
            : filtered.filter(p => (p.bedrooms || 0) === parseInt(r));
    }

    if (currentFilters.bedrooms) {
        const b = currentFilters.bedrooms;
        filtered = b === '4+'
            ? filtered.filter(p => (p.bedrooms || 0) >= 4)
            : filtered.filter(p => (p.bedrooms || 0) === parseInt(b));
    }

    const sortVal = sortOrder.value;
    if (sortVal === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else {
        filtered.sort((a, b) => {
            const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return db - da;
        });
    }

    renderActiveFilterTags();
    renderPage(filtered);
    renderPagination(filtered.length);
}

function updateResultsTitle() {
    const op = currentFilters.operation === 'venta' ? 'en Venta' : 'en Alquiler';
    resultsTitle.textContent = `Propiedades ${op}`;
}

// ── Renderizar página de resultados ──────────────────────────────────────────

function renderPage(filtered) {
    resultsCount.textContent = `${filtered.length} propiedades encontradas`;

    if (filtered.length === 0) {
        propertyList.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search-minus"></i>
                <p>No se encontraron propiedades con los filtros seleccionados.</p>
            </div>
        `;
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }

    // Ajustar currentPage si quedó fuera de rango
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

    propertyList.innerHTML = pageItems.map(p => {
        const img = p.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1073&q=80';
        const location = [p.neighborhood, p.zone].filter(Boolean).join(', ') || 'Sin ubicación';
        const badgeLabel = p.operation === 'venta' ? 'Venta' : 'Alquiler';
        return `
            <a class="property-card" href="property-detail.html?v=3&id=${p.id}">
                <div class="card-image">
                    <img src="${img}" alt="${p.title}" loading="lazy">
                    <div class="card-badge">${badgeLabel}</div>
                </div>
                <div class="card-content">
                    <div class="card-price">USD ${p.price.toLocaleString()}</div>
                    <h3 class="card-title">${p.title}</h3>
                    <div class="card-location">
                        <i class="fas fa-map-marker-alt"></i> ${location}
                    </div>
                    <div class="card-features">
                        <div class="feature-item"><i class="fas fa-ruler-combined"></i> ${p.surface || 0} m²</div>
                        <div class="feature-item"><i class="fas fa-bed"></i> ${p.bedrooms || 0} Amb.</div>
                        <div class="feature-item"><i class="fas fa-bath"></i> ${p.bathrooms || 1} Baños</div>
                    </div>
                </div>
            </a>
        `;
    }).join('');
}

// ── Paginación ────────────────────────────────────────────────────────────────

function renderPagination(total) {
    if (!paginationEl) return;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    if (totalPages <= 1) { paginationEl.innerHTML = ''; return; }

    const pages = buildPageNumbers(currentPage, totalPages);

    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';

    let html = `<button class="page-btn prev-btn" onclick="goToPage(${currentPage - 1})" ${prevDisabled}>
        <i class="fas fa-chevron-left"></i> Anterior
    </button>`;

    pages.forEach(p => {
        if (p === '...') {
            html += `<span class="page-ellipsis">…</span>`;
        } else {
            html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
        }
    });

    html += `<button class="page-btn next-btn" onclick="goToPage(${currentPage + 1})" ${nextDisabled}>
        Siguiente <i class="fas fa-chevron-right"></i>
    </button>`;

    paginationEl.innerHTML = html;
}

function buildPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end   = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

window.goToPage = function(page) {
    currentPage = page;
    applyFiltersAndRender();
    document.getElementById('property-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.viewProperty = function(id) {
    window.location.href = `property-detail.html?id=${id}`;
};

// ── Tags de filtros activos ───────────────────────────────────────────────────

function renderActiveFilterTags() {
    if (!activeFiltersEl) return;
    const tags = [];

    if (currentFilters.priceMin || currentFilters.priceMax) {
        const parts = [];
        if (currentFilters.priceMin) parts.push(`Desde USD ${currentFilters.priceMin.toLocaleString()}`);
        if (currentFilters.priceMax) parts.push(`Hasta USD ${currentFilters.priceMax.toLocaleString()}`);
        tags.push(`<span class="filter-tag" onclick="removeFilter('price')">${parts.join(' · ')} <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.rooms) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('rooms')">${currentFilters.rooms} Amb. <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.bedrooms) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('bedrooms')">${currentFilters.bedrooms} Dorm. <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.surfaceMin || currentFilters.surfaceMax) {
        const parts = [];
        if (currentFilters.surfaceMin) parts.push(`Desde ${currentFilters.surfaceMin} m²`);
        if (currentFilters.surfaceMax) parts.push(`Hasta ${currentFilters.surfaceMax} m²`);
        tags.push(`<span class="filter-tag" onclick="removeFilter('surface')">${parts.join(' · ')} <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.keyword) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('keyword')">"${currentFilters.keyword}" <i class="fas fa-times"></i></span>`);
    }

    activeFiltersEl.innerHTML = tags.join('');
}

window.removeFilter = function(key) {
    if (key === 'price') {
        currentFilters.priceMin = null;
        currentFilters.priceMax = null;
        priceMinInput.value = '';
        priceMaxInput.value = '';
    } else if (key === 'rooms') {
        currentFilters.rooms = null;
        document.querySelectorAll('#filter-rooms .filter-number-btn').forEach(b => b.classList.remove('active'));
    } else if (key === 'bedrooms') {
        currentFilters.bedrooms = null;
        document.querySelectorAll('#filter-bedrooms .filter-number-btn').forEach(b => b.classList.remove('active'));
    } else if (key === 'surface') {
        currentFilters.surfaceMin = null;
        currentFilters.surfaceMax = null;
        surfaceMinInput.value = '';
        surfaceMaxInput.value = '';
    } else if (key === 'keyword') {
        currentFilters.keyword = '';
        quicksearch.value = '';
    }
    currentPage = 1;
    applyFiltersAndRender();
};

function clearAllFilters() {
    currentFilters = {
        operation: currentFilters.operation,
        category: null,
        priceMin: null,
        priceMax: null,
        rooms: null,
        bedrooms: null,
        surfaceMin: null,
        surfaceMax: null,
        keyword: ''
    };

    [priceMinInput, priceMaxInput, surfaceMinInput, surfaceMaxInput].forEach(i => i.value = '');
    quicksearch.value = '';
    propertyTypeSelect.value = '';

    const display  = document.querySelector('.custom-select-value');
    const dropdown = document.querySelector('#custom-property-type .custom-select-dropdown');
    if (display)  display.textContent = 'Todo tipo de propiedades';
    if (dropdown) {
        dropdown.querySelectorAll('.custom-select-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === '');
        });
    }

    document.querySelectorAll('.filter-number-btn').forEach(b => b.classList.remove('active'));
    currentPage = 1;
    applyFiltersAndRender();
}

// ── Propiedades demo ──────────────────────────────────────────────────────────

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
            title: 'Oficina Premium en Belgrano C',
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
        },
        {
            id: 'demo-nunez-1',
            title: 'Departamento 3 Amb. con Amenities en Núñez',
            price: 195000,
            type: 'deptos',
            operation: 'venta',
            neighborhood: 'Núñez',
            zone: 'Capital Federal',
            surface: 95,
            bedrooms: 3,
            bathrooms: 2,
            images: ['https://images.unsplash.com/photo-1560185127-6a4678c6d09b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-nunez-2',
            title: 'Monoambiente a estrenar frente al parque',
            price: 85000,
            type: 'deptos',
            operation: 'venta',
            neighborhood: 'Núñez',
            zone: 'Capital Federal',
            surface: 40,
            bedrooms: 1,
            bathrooms: 1,
            images: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-caballito',
            title: 'Piso Entero con Balcón Corrido en Caballito',
            price: 230000,
            type: 'deptos',
            operation: 'venta',
            neighborhood: 'Caballito',
            zone: 'Capital Federal',
            surface: 130,
            bedrooms: 4,
            bathrooms: 2,
            images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-belgrano-venta',
            title: 'Amplio 2 Ambientes a metros del Tren',
            price: 145000,
            type: 'deptos',
            operation: 'venta',
            neighborhood: 'Belgrano',
            zone: 'Capital Federal',
            surface: 68,
            bedrooms: 2,
            bathrooms: 1,
            images: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-tigre-casa',
            title: 'Casa en Countries con Laguna y Golf',
            price: 320000,
            type: 'casas',
            operation: 'venta',
            neighborhood: 'Tigre',
            zone: 'GBA Norte',
            surface: 260,
            bedrooms: 4,
            bathrooms: 3,
            images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-palermo-alq',
            title: 'Loft Diseño en Villa Crespo',
            price: 1200,
            type: 'deptos',
            operation: 'alquiler',
            neighborhood: 'Villa Crespo',
            zone: 'Capital Federal',
            surface: 60,
            bedrooms: 2,
            bathrooms: 1,
            images: ['https://images.unsplash.com/photo-1556020685-ae41abfc9365?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-lote-pilar',
            title: 'Lote en Barrio Cerrado Bº Las Praderas',
            price: 75000,
            type: 'lotes',
            operation: 'venta',
            neighborhood: 'Pilar',
            zone: 'GBA Norte',
            surface: 600,
            bedrooms: 0,
            bathrooms: 0,
            images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        },
        {
            id: 'demo-hotel',
            title: 'Hotel Boutique 30 habitaciones en Mar del Plata',
            price: 2800000,
            type: 'hoteles',
            operation: 'venta',
            neighborhood: 'Mar del Plata',
            zone: 'Costa Atlántica',
            surface: 1800,
            bedrooms: 30,
            bathrooms: 32,
            images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
        }
    ];
}
