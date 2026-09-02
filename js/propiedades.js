// propiedades.js - Página de listado completo de propiedades UMEN

import { getProperties, getCategories, getCities, getAllNeighborhoods, getCountries } from './propertyService.js?v=3';

const ITEMS_PER_PAGE = 12;

let categories = [];
let cities = [];
let neighborhoodsList = [];
let countries = [];
let allResults = [];
let currentPage = 1;

let currentFilters = {
    operation: 'venta',
    category: null,
    countries: [],
    city: null,
    neighborhood: null,
    priceMin: null,
    priceMax: null,
    surfaceMin: null,
    surfaceMax: null,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    garages: null,
    estado: null,
    age: null,
    keyword: ''
};

// DOM refs estáticos (existen desde el HTML inicial)
const propertyList    = document.getElementById('property-list');
const resultsTitle    = document.getElementById('results-title');
const resultsCount    = document.getElementById('results-count');
const sortOrder       = document.getElementById('sort-order');
const activeFiltersEl = document.getElementById('active-filters');
const clearAllBtn     = document.getElementById('clear-all-filters');
const priceMinInput   = document.getElementById('price-min');
const priceMaxInput   = document.getElementById('price-max');
const surfaceMinInput = document.getElementById('surface-min');
const surfaceMaxInput = document.getElementById('surface-max');
const paginationEl    = document.getElementById('pagination');
const filterToggleBtn = document.getElementById('filter-toggle-btn');
const filtersSidebar  = document.getElementById('filters-sidebar');
const sidebarOverlay  = document.getElementById('sidebar-overlay');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const viewGridBtn     = document.getElementById('view-grid');
const viewListBtn     = document.getElementById('view-list');

// DOM refs del header (inyectado async — se asignan dentro del IIFE)
let header, propertyTypeSelect, searchBtn, quicksearch;

(async () => {
    // Esperar hasta 2.5s a que el header partial sea inyectado
    let attempts = 0;
    while (!document.getElementById('header') && attempts < 50) {
        await new Promise(r => setTimeout(r, 50));
        attempts++;
    }

    // Capturar refs del header ahora que existe
    header             = document.getElementById('header');
    propertyTypeSelect = document.getElementById('property-type');
    searchBtn          = document.getElementById('search-btn');
    quicksearch        = document.getElementById('quicksearch');

    // Esperar hasta 3s a que Firebase inicialice
    attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    if (header) {
        const handleHeaderScroll = () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        };
        window.addEventListener('scroll', handleHeaderScroll);
        handleHeaderScroll();
    }

    setupFilterToggle();

    // Lanzar la carga de propiedades en paralelo con la de categorías/ciudades/barrios
    // (antes iban en serie: 4 round-trips a Firestore uno tras otro para 11 propiedades)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('operation')) currentFilters.operation = urlParams.get('operation');
    if (urlParams.get('category')) currentFilters.category = urlParams.get('category');

    propertyList.innerHTML = Array(6).fill(null).map(skeletonCard).join('');
    updateResultsTitle();

    const firebaseReady = window.db && window.db._databaseId?.projectId !== 'TU_PROJECT_ID_AQUI';
    const apiFilters = { operation: currentFilters.operation };
    if (currentFilters.category) apiFilters.category = currentFilters.category;
    const propertiesPromise = firebaseReady
        ? getProperties(apiFilters).catch(() => getDemoProperties())
        : Promise.resolve(getDemoProperties());

    if (window.db) {
        const [catsRes, citiesRes, nbsRes, countriesRes] = await Promise.allSettled([
            getCategories(), getCities(), getAllNeighborhoods(), getCountries()
        ]);
        categories = catsRes.status === 'fulfilled' ? catsRes.value : [];
        if (categories.length === 0) useDefaultCategories();
        cities = citiesRes.status === 'fulfilled' ? citiesRes.value : [];
        if (cities.length === 0) useDefaultCities();
        neighborhoodsList = nbsRes.status === 'fulfilled' ? nbsRes.value : [];
        if (neighborhoodsList.length === 0) useDefaultNeighborhoods();
        countries = countriesRes.status === 'fulfilled' ? countriesRes.value : [];
        if (countries.length === 0) useDefaultCountries();
    } else {
        useDefaultCategories();
        useDefaultCities();
        useDefaultNeighborhoods();
        useDefaultCountries();
    }

    populatePropertyTypes();
    setupCustomSelect();
    setupSearchBox();
    applyFiltersFromUrl();
    setupNumberFilterBtns();
    setupRangeFilters();
    renderTypePills();
    renderCountryCheckboxes();
    renderCityCheckboxes();
    renderNeighborhoodCheckboxes();
    syncSidebarSelectsFromFilters();
    setupPillFilters();
    setupCountryFilter();
    setupCityFilter();
    setupNeighborhoodFilter();
    setupAgeFilter();
    setupViewToggle();

    sortOrder.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
    clearAllBtn.addEventListener('click', clearAllFilters);

    allResults = await propertiesPromise;
    applyFiltersAndRender();
})();

// ── Datos por defecto ─────────────────────────────────────────────────────────

function useDefaultCategories() {
    categories = ['Departamento', 'PH', 'Oficina', 'Edificio en Block', 'Hotel', 'Negocio Especial', 'Terreno']
        .map(name => ({ id: name, name }));
}

function useDefaultCities() {
    cities = ['Capital Federal', 'Bariloche', 'Dina Huapi', 'La Plata']
        .map(name => ({ id: name, name }));
}

function useDefaultNeighborhoods() {
    neighborhoodsList = ['Almagro', 'Belgrano', 'Caballito', 'Centro', 'Microcentro', 'Nuñez', 'San Cristóbal', 'Villa Crespo']
        .map(name => ({ id: name, name }));
}

function useDefaultCountries() {
    countries = ['Argentina'].map(name => ({ id: name, name }));
}

// ── Render: pills de tipo / checkboxes de ciudad y barrio ────────────────────

function renderTypePills() {
    const select = document.getElementById('filter-type');
    if (!select) return;
    select.innerHTML = `<option value="">Todos los tipos</option>` +
        categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function renderCountryCheckboxes() {
    const container = document.getElementById('filter-country');
    if (!container) return;
    container.innerHTML = countries.map(c =>
        `<label class="filter-check-label"><input type="checkbox" value="${c.name}"> ${c.name}</label>`
    ).join('');
}

function renderCityCheckboxes() {
    const select = document.getElementById('filter-city');
    if (!select) return;
    select.innerHTML = `<option value="">Todas las ciudades</option>` +
        cities.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function renderNeighborhoodCheckboxes() {
    const select = document.getElementById('filter-neighborhood');
    if (!select) return;
    select.innerHTML = `<option value="">Todos los barrios</option>` +
        neighborhoodsList.map(n => `<option value="${n.name}">${n.name}</option>`).join('');
}

// ── Setup: tipos de propiedad ─────────────────────────────────────────────────

function populatePropertyTypes() {
    // El valor usa el nombre de la categoría: es lo que Firestore guarda en el campo 'type' de cada propiedad
    propertyTypeSelect.innerHTML = `
        <option value="">Todo tipo de propiedades</option>
        ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
    `;

    const dropdown = document.querySelector('#custom-property-type .custom-select-dropdown');
    if (!dropdown) return;
    const options = [
        { value: '', label: 'Todo tipo de propiedades' },
        ...categories.map(c => ({ value: c.name, label: c.name }))
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

// ── Setup: toggle sidebar en mobile ──────────────────────────────────────────

function setupFilterToggle() {
    if (!filterToggleBtn || !filtersSidebar) return;

    const closeSidebar = () => {
        filtersSidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        filterToggleBtn.innerHTML = '<i class="fas fa-sliders-h"></i> Filtros';
    };

    filterToggleBtn.addEventListener('click', () => {
        const isOpen = filtersSidebar.classList.toggle('open');
        filterToggleBtn.innerHTML = isOpen
            ? '<i class="fas fa-times"></i> Cerrar'
            : '<i class="fas fa-sliders-h"></i> Filtros';
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active', isOpen);
    });

    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
}

// Lee operation/category/keyword de la URL (llegan del buscador del home) y sincroniza filtros + UI
function applyFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const operation = params.get('operation');
    const category = params.get('category');
    const keyword = params.get('keyword');
    const neighborhood = params.get('neighborhood');
    const city = params.get('city');
    const bedrooms = params.get('bedrooms');

    if (operation) {
        currentFilters.operation = operation;
        document.querySelectorAll(`input[name="operation"][value="${operation}"]`).forEach(radio => {
            radio.checked = true;
        });
    }

    if (category) {
        currentFilters.category = category;
        propertyTypeSelect.value = category;
        const opt = document.querySelector(`#custom-property-type .custom-select-option[data-value="${category}"]`);
        if (opt) {
            document.querySelector('#custom-property-type .custom-select-value').textContent = opt.textContent;
            document.querySelectorAll('#custom-property-type .custom-select-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        }
    }

    if (neighborhood) currentFilters.neighborhood = neighborhood;
    if (city) currentFilters.city = city;

    if (bedrooms) {
        currentFilters.bedrooms = bedrooms;
        const btn = document.querySelector(`#filter-bedrooms .filter-number-btn[data-value="${bedrooms}"]`);
        if (btn) btn.classList.add('active');
    }

    if (keyword) {
        currentFilters.keyword = keyword.toLowerCase();
        quicksearch.value = keyword;
    }
}

// Sincroniza los <select> del sidebar con los filtros ya cargados desde la URL
// (se llama después de poblar sus opciones, si no el .value no pega en nada)
function syncSidebarSelectsFromFilters() {
    const map = { 'filter-type': currentFilters.category, 'filter-city': currentFilters.city, 'filter-neighborhood': currentFilters.neighborhood };
    Object.entries(map).forEach(([id, value]) => {
        if (!value) return;
        const sel = document.getElementById(id);
        if (sel) sel.value = value;
    });
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

// ── Setup: botones de número (ambientes / dormitorios / baños / cocheras) ─────

function setupNumberFilterBtns() {
    setupBtnGroup('filter-rooms',     'rooms');
    setupBtnGroup('filter-bedrooms',  'bedrooms');
    setupBtnGroup('filter-bathrooms', 'bathrooms');
    setupBtnGroup('filter-garages',   'garages');
}

// ── Setup: selects de tipo / estado ────────────────────────────────────────────

function setupPillFilters() {
    setupSelectFilter('filter-type', 'category');
    setupSelectFilter('filter-estado', 'estado');
}

function setupSelectFilter(selectId, filterKey) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.addEventListener('change', () => {
        currentFilters[filterKey] = select.value || null;
        currentPage = 1;
        applyFiltersAndRender();
    });
}

// ── Setup: ciudad (checkboxes múltiples) ──────────────────────────────────────

function setupCountryFilter() {
    document.querySelectorAll('#filter-country input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            currentFilters.countries = Array.from(
                document.querySelectorAll('#filter-country input[type="checkbox"]:checked')
            ).map(c => c.value);
            currentPage = 1;
            applyFiltersAndRender();
        });
    });
}

function setupCityFilter() {
    const select = document.getElementById('filter-city');
    if (!select) return;
    select.addEventListener('change', () => {
        currentFilters.city = select.value || null;
        currentPage = 1;
        applyFiltersAndRender();
    });
}

// ── Setup: barrio (select) ─────────────────────────────────────────────────────

function setupNeighborhoodFilter() {
    const select = document.getElementById('filter-neighborhood');
    if (!select) return;
    select.addEventListener('change', () => {
        currentFilters.neighborhood = select.value || null;
        currentPage = 1;
        applyFiltersAndRender();
    });
}

// ── Setup: antigüedad (select) ────────────────────────────────────────────────

function setupAgeFilter() {
    const sel = document.getElementById('filter-age');
    if (!sel) return;
    sel.addEventListener('change', () => {
        currentFilters.age = sel.value || null;
        currentPage = 1;
        applyFiltersAndRender();
    });
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

function skeletonCard() {
    return `
        <div class="property-card skeleton-card">
            <div class="skeleton-img shimmer"></div>
            <div class="card-content">
                <div class="skeleton-line shimmer" style="width:45%;height:18px;margin-bottom:12px"></div>
                <div class="skeleton-line shimmer" style="width:80%;height:14px;margin-bottom:8px"></div>
                <div class="skeleton-line shimmer" style="width:55%;height:12px;margin-bottom:20px"></div>
                <div style="display:flex;gap:16px">
                    <div class="skeleton-line shimmer" style="width:60px;height:12px"></div>
                    <div class="skeleton-line shimmer" style="width:60px;height:12px"></div>
                    <div class="skeleton-line shimmer" style="width:60px;height:12px"></div>
                </div>
            </div>
        </div>`;
}

async function fetchAndRender() {
    propertyList.innerHTML = Array(6).fill(null).map(skeletonCard).join('');
    updateResultsTitle();

    let results = [];
    try {
        const firebaseReady = window.db && window.db._databaseId?.projectId !== 'TU_PROJECT_ID_AQUI';

        if (firebaseReady) {
            const apiFilters = { operation: currentFilters.operation };
            if (currentFilters.category) apiFilters.category = currentFilters.category;
            results = await getProperties(apiFilters);
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
            (p.code && p.code.toLowerCase().includes(kw)) ||
            (p.neighborhood && p.neighborhood.toLowerCase().includes(kw)) ||
            (p.zone && p.zone.toLowerCase().includes(kw)) ||
            (p.description && p.description.toLowerCase().includes(kw)) ||
            (p.type && p.type.toLowerCase().includes(kw)) ||
            (kw.includes('buenos aires') && p.zone && isZonaBuenosAires(p.zone))
        );
    }

    // Tipo de propiedad
    if (currentFilters.category) {
        filtered = filtered.filter(p => p.type === currentFilters.category);
    }

    // País (multi)
    if (currentFilters.countries.length > 0) {
        filtered = filtered.filter(p => p.pais && currentFilters.countries.includes(p.pais));
    }

    // Ciudad
    if (currentFilters.city) {
        filtered = filtered.filter(p => p.zone === currentFilters.city);
    }

    // Barrio
    if (currentFilters.neighborhood) {
        filtered = filtered.filter(p => p.neighborhood === currentFilters.neighborhood);
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

    if (currentFilters.bathrooms) {
        const b = currentFilters.bathrooms;
        filtered = b === '4+'
            ? filtered.filter(p => (p.bathrooms || 0) >= 4)
            : filtered.filter(p => (p.bathrooms || 0) === parseInt(b));
    }

    if (currentFilters.garages) {
        const g = currentFilters.garages;
        filtered = g === '3+'
            ? filtered.filter(p => (p.garages || 0) >= 3)
            : filtered.filter(p => (p.garages || 0) === parseInt(g));
    }

    if (currentFilters.estado) {
        filtered = filtered.filter(p => p.condition === currentFilters.estado);
    }

    if (currentFilters.age) {
        const [min, max] = currentFilters.age === '30+'
            ? [30, Infinity]
            : currentFilters.age.split('-').map(Number);
        filtered = filtered.filter(p => {
            const age = p.age ?? null;
            if (age === null) return true;
            return age >= min && age <= (max ?? Infinity);
        });
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
    renderHotelsBanner();
}

// El catálogo completo de hoteles vive en Hoteles en Venta; cada propiedad de esta
// categoría redirige a su ficha allá (ver p.externalUrl en renderPage).
function renderHotelsBanner() {
    const banner = document.getElementById('hotels-banner');
    if (!banner) return;
    banner.style.display = currentFilters.category === 'Hotel' ? '' : 'none';
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
        // Los hoteles viven en Hoteles en Venta: la card redirige a la ficha original allá.
        const isExternalHotel = p.type === 'Hotel' && p.externalUrl;
        const linkAttrs = isExternalHotel
            ? `href="${p.externalUrl}" target="_blank" rel="noopener noreferrer"`
            : `href="property-detail.html?v=3&id=${p.id}"`;
        return `
            <a class="property-card" ${linkAttrs}>
                <div class="card-image">
                    <img src="${img}" alt="${p.title}" loading="lazy">
                    <div class="card-badge">${badgeLabel}</div>
                </div>
                <div class="card-content">
                    <div class="card-price">${p.currency === 'ARS' ? '$' : (p.currency || 'USD')} ${p.price.toLocaleString()}${p.operation === 'alquiler' ? ' <span class="card-price-period">/mes</span>' : ''}</div>
                    ${p.tag ? `<span class="card-tag-label">${p.tag}</span>` : ''}
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

    if (totalPages <= 1) { paginationEl.innerHTML = ''; paginationEl.style.display = 'none'; return; }
    paginationEl.style.display = '';

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

    if (currentFilters.category) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('category')">${currentFilters.category} <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.countries.length > 0) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('countries')">${currentFilters.countries.join(', ')} <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.city) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('city')">${currentFilters.city} <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.neighborhood) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('neighborhood')">Barrio: ${currentFilters.neighborhood} <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.bathrooms) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('bathrooms')">${currentFilters.bathrooms} Baños <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.garages) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('garages')">${currentFilters.garages} Cochera(s) <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.estado) {
        const labels = { estrenar:'A estrenar', usado:'Usado', pozo:'En pozo', reciclado:'Reciclado' };
        tags.push(`<span class="filter-tag" onclick="removeFilter('estado')">${labels[currentFilters.estado]} <i class="fas fa-times"></i></span>`);
    }

    if (currentFilters.age) {
        tags.push(`<span class="filter-tag" onclick="removeFilter('age')">Antigüedad: ${currentFilters.age} años <i class="fas fa-times"></i></span>`);
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
        if (quicksearch) quicksearch.value = '';
    } else if (key === 'category') {
        currentFilters.category = null;
        const sel = document.getElementById('filter-type');
        if (sel) sel.value = '';
    } else if (key === 'countries') {
        currentFilters.countries = [];
        document.querySelectorAll('#filter-country input[type="checkbox"]').forEach(cb => cb.checked = false);
    } else if (key === 'city') {
        currentFilters.city = null;
        const sel = document.getElementById('filter-city');
        if (sel) sel.value = '';
    } else if (key === 'neighborhood') {
        currentFilters.neighborhood = null;
        const sel = document.getElementById('filter-neighborhood');
        if (sel) sel.value = '';
    } else if (key === 'bathrooms') {
        currentFilters.bathrooms = null;
        document.querySelectorAll('#filter-bathrooms .filter-number-btn').forEach(b => b.classList.remove('active'));
    } else if (key === 'garages') {
        currentFilters.garages = null;
        document.querySelectorAll('#filter-garages .filter-number-btn').forEach(b => b.classList.remove('active'));
    } else if (key === 'estado') {
        currentFilters.estado = null;
        const sel = document.getElementById('filter-estado');
        if (sel) sel.value = '';
    } else if (key === 'age') {
        currentFilters.age = null;
        const el = document.getElementById('filter-age');
        if (el) el.value = '';
    }
    currentPage = 1;
    applyFiltersAndRender();
};

function clearAllFilters() {
    currentFilters = {
        operation: currentFilters.operation,
        category: null,
        countries: [],
        city: null,
        neighborhood: null,
        priceMin: null,
        priceMax: null,
        surfaceMin: null,
        surfaceMax: null,
        rooms: null,
        bedrooms: null,
        bathrooms: null,
        garages: null,
        estado: null,
        age: null,
        keyword: ''
    };

    [priceMinInput, priceMaxInput, surfaceMinInput, surfaceMaxInput].forEach(i => i.value = '');
    if (quicksearch) quicksearch.value = '';
    if (propertyTypeSelect) propertyTypeSelect.value = '';

    const display  = document.querySelector('.custom-select-value');
    const dropdown = document.querySelector('#custom-property-type .custom-select-dropdown');
    if (display)  display.textContent = 'Todo tipo de propiedades';
    if (dropdown) dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.dataset.value === ''));

    document.querySelectorAll('.filter-number-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#filter-country input[type="checkbox"]').forEach(cb => cb.checked = false);

    ['filter-age', 'filter-type', 'filter-city', 'filter-neighborhood', 'filter-estado'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.value = '';
    });

    currentPage = 1;
    applyFiltersAndRender();
}

// ── Propiedades demo ──────────────────────────────────────────────────────────

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
