// adminDashboard.js — Panel de administración UMEN
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import {
    getProperties, createProperty, updateProperty, deleteProperty,
    ensureDefaultTaxonomy,
    getCategories, createCategory, updateCategory, deleteCategory,
    getCities, createCity, updateCity, deleteCity,
    getAllNeighborhoods, createNeighborhood, updateNeighborhood, deleteNeighborhood
} from './propertyService.js';
import { initImageGallery, setGalleryUrls, getGalleryUrls } from './cloudinaryUpload.js';

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) { alert(message); return; }
    const toast = document.createElement('div');
    toast.className = `adm-toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon} adm-toast-icon"></i><div class="adm-toast-content">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toast-slide-out 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const logoutBtn          = document.getElementById('logout-btn');
const propertiesTbody    = document.getElementById('properties-tbody');
const totalPropertiesEl  = document.getElementById('total-properties');
const totalVentaEl       = document.getElementById('total-venta');
const totalAlquilerEl    = document.getElementById('total-alquiler');
const propertyModal      = document.getElementById('property-modal');
const propertyForm       = document.getElementById('property-form');
const newPropertyBtn     = document.getElementById('new-property-btn');
const modalTitle         = document.getElementById('modal-title');
const typeSelect         = document.getElementById('type');
const citySelect         = document.getElementById('zone');
const neighborhoodSelect = document.getElementById('neighborhood');
const filterTypeSelect   = document.getElementById('filter-type');

// ── Estado ────────────────────────────────────────────────────────────────────
let properties    = [];
let editingId     = null;
let categories    = [];
let cities        = [];
let neighborhoods = [];
let currentPage   = 1;
const ITEMS_PER_PAGE = 10;

// ── Taxonomías ────────────────────────────────────────────────────────────────
const TAXO_CONFIG = {
    category: {
        getList: () => categories, setList: v => { categories = v; },
        fetch: getCategories, create: createCategory, update: updateCategory, delete: deleteCategory,
        listEl: 'category-list', inputEl: 'new-category-input', addBtnEl: 'add-category-btn'
    },
    city: {
        getList: () => cities, setList: v => { cities = v; },
        fetch: getCities, create: createCity, update: updateCity, delete: deleteCity,
        listEl: 'city-list', inputEl: 'new-city-input', addBtnEl: 'add-city-btn'
    },
    neighborhood: {
        getList: () => neighborhoods, setList: v => { neighborhoods = v; },
        fetch: getAllNeighborhoods, create: createNeighborhood, update: updateNeighborhood, delete: deleteNeighborhood,
        listEl: 'neighborhood-list', inputEl: 'new-neighborhood-input', addBtnEl: 'add-neighborhood-btn'
    }
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TAB_ORDER = [
    'tab-principal','tab-destacados','tab-superficies',
    'tab-ambientes','tab-servicios','tab-edificio',
    'tab-comercial','tab-medios'
];

function currentTabIndex() {
    const active = document.querySelector('#form-tabs-bar .adm-tab-btn.active');
    return active ? TAB_ORDER.indexOf(active.dataset.tab) : 0;
}

function switchTab(tabId) {
    document.querySelectorAll('.adm-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.adm-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.adm-tab-btn[data-tab="${tabId}"]`)?.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');
    updateNavBtns();
}

function updateNavBtns() {
    const idx   = currentTabIndex();
    const prev  = document.getElementById('tab-prev-btn');
    const next  = document.getElementById('tab-next-btn');
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === TAB_ORDER.length - 1;
}

function setupTabs() {
    document.querySelectorAll('.adm-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.getElementById('tab-prev-btn')?.addEventListener('click', () => {
        const idx = currentTabIndex();
        if (idx > 0) switchTab(TAB_ORDER[idx - 1]);
    });
    document.getElementById('tab-next-btn')?.addEventListener('click', () => {
        const idx = currentTabIndex();
        if (idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]);
    });
    updateNavBtns();
}

// ── Helpers de formulario ─────────────────────────────────────────────────────
function val(id, fallback = '') {
    return document.getElementById(id)?.value ?? fallback;
}
function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = (v == null) ? '' : v;
}
function numVal(id) {
    const n = Number(val(id));
    return (isNaN(n) || n === 0) ? null : n;
}
function getCheckboxValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(cb => cb.value);
}
function setCheckboxValues(name, values = []) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
        cb.checked = values.includes(cb.value);
    });
}
function getRadioValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value ?? '';
}
function setRadioValue(name, value) {
    const target = document.querySelector(`input[name="${name}"][value="${value ?? ''}"]`);
    if (target) { target.checked = true; return; }
    const blank = document.querySelector(`input[name="${name}"][value=""]`);
    if (blank) blank.checked = true;
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(window.auth, user => {
        if (!user) { window.location.href = 'admin-login.html'; }
        else        { loadAdminData(); }
    });
    setupEventListeners();
    setupTabs();
    // Init Cloudinary gallery (se monta una sola vez)
    initImageGallery('cld-gallery-container');
});

function setupEventListeners() {
    logoutBtn?.addEventListener('click', handleLogout);
    newPropertyBtn?.addEventListener('click', openNewPropertyModal);
    propertyForm?.addEventListener('submit', handleFormSubmit);
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', closeModal));
    document.getElementById('open-taxo-modal-btn')?.addEventListener('click', () => {
        document.querySelector('.adm-sidebar-link[data-section="taxonomia"]')?.click();
    });
    
    document.getElementById('admin-search')?.addEventListener('input', () => {
        currentPage = 1;
        renderAdminTable();
    });

    Object.entries(TAXO_CONFIG).forEach(([taxoType, cfg]) => {
        const input  = document.getElementById(cfg.inputEl);
        const addBtn = document.getElementById(cfg.addBtnEl);
        const submit = () => handleTaxoAdd(taxoType);
        addBtn?.addEventListener('click', submit);
        input?.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });

    document.querySelectorAll('.adm-quick-add').forEach(btn => {
        btn.addEventListener('click', () => handleQuickAdd(btn.dataset.taxo));
    });
}

async function handleLogout() {
    try { await signOut(window.auth); window.location.href = 'index.html'; }
    catch (e) { console.error(e); }
}

// ── Carga de datos ────────────────────────────────────────────────────────────
async function loadAdminData() {
    const timeout = setTimeout(() => {
        if (propertiesTbody.innerHTML.includes('Cargando')) {
            propertiesTbody.innerHTML = '<tr><td colspan="8" class="adm-table-empty">Verificá tu conexión o las reglas de Firebase.</td></tr>';
        }
    }, 6000);
    try {
        await ensureDefaultTaxonomy();
        await loadAllTaxonomies();
        properties = await getProperties();
        clearTimeout(timeout);
        renderAdminTable();
        updateStats();
    } catch (e) {
        clearTimeout(timeout);
        console.error(e);
        propertiesTbody.innerHTML = '<tr><td colspan="8" class="adm-table-empty" style="color:red">Error al conectar con la base de datos.</td></tr>';
    }
}

// ── Taxonomía ─────────────────────────────────────────────────────────────────
async function loadAllTaxonomies() {
    for (const [type, cfg] of Object.entries(TAXO_CONFIG)) {
        cfg.setList(await cfg.fetch());
        renderTaxoList(type);
    }
    populateFormSelects();
    populateFilterTypeSelect();
}

function renderTaxoList(taxoType) {
    const cfg       = TAXO_CONFIG[taxoType];
    const container = document.getElementById(cfg.listEl);
    if (!container) return;
    const list = cfg.getList();
    if (!list.length) {
        container.innerHTML = '<span class="adm-taxo-empty">Sin opciones todavía.</span>';
        return;
    }
    container.innerHTML = list.map(item => `
        <span class="adm-taxo-chip" data-id="${item.id}">
            <span class="adm-taxo-chip-label">${item.name}</span>
            <button type="button" class="adm-taxo-edit" title="Renombrar"><i class="fas fa-pen"></i></button>
            <button type="button" class="adm-taxo-del" title="Eliminar"><i class="fas fa-times"></i></button>
        </span>
    `).join('');
    container.querySelectorAll('.adm-taxo-chip').forEach(chip => {
        const id = chip.dataset.id;
        chip.querySelector('.adm-taxo-edit').addEventListener('click', () => handleTaxoEdit(taxoType, id, chip));
        chip.querySelector('.adm-taxo-del').addEventListener('click', () => handleTaxoDelete(taxoType, id));
    });
}

async function handleTaxoAdd(taxoType) {
    const cfg   = TAXO_CONFIG[taxoType];
    const input = document.getElementById(cfg.inputEl);
    const name  = input.value.trim();
    if (!name) return;
    if (cfg.getList().some(i => i.name.toLowerCase() === name.toLowerCase())) { showToast('Esa opción ya existe.', 'error'); return; }
    try {
        await cfg.create({ name });
        input.value = '';
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
        populateFormSelects();
        if (taxoType === 'category') populateFilterTypeSelect();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

function handleTaxoEdit(taxoType, id, chipEl) {
    const cfg         = TAXO_CONFIG[taxoType];
    const item        = cfg.getList().find(i => i.id === id);
    if (!item) return;
    const labelEl     = chipEl.querySelector('.adm-taxo-chip-label');
    const currentName = item.name;
    labelEl.outerHTML = `<input type="text" class="adm-taxo-rename" value="${currentName}">`;
    const input = chipEl.querySelector('.adm-taxo-rename');
    input.focus(); input.select();
    const save = async () => {
        const newName = input.value.trim();
        if (!newName || newName === currentName) { renderTaxoList(taxoType); return; }
        try {
            await cfg.update(id, { name: newName });
            cfg.setList(await cfg.fetch());
            renderTaxoList(taxoType);
            populateFormSelects();
            if (taxoType === 'category') populateFilterTypeSelect();
        } catch (e) { showToast('Error: ' + e.message, 'error'); renderTaxoList(taxoType); }
    };
    input.addEventListener('blur', save);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
}

async function handleTaxoDelete(taxoType, id) {
    const cfg  = TAXO_CONFIG[taxoType];
    const item = cfg.getList().find(i => i.id === id);
    if (!item || !confirm(`¿Eliminar "${item.name}"?`)) return;
    try {
        await cfg.delete(id);
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
        populateFormSelects();
        if (taxoType === 'category') populateFilterTypeSelect();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

async function handleQuickAdd(taxoType) {
    const cfg   = TAXO_CONFIG[taxoType];
    const label = { category: 'tipo de propiedad', city: 'ciudad', neighborhood: 'barrio' }[taxoType];
    const name  = prompt(`Nuevo ${label}:`);
    if (!name?.trim()) return;
    try {
        await cfg.create({ name: name.trim() });
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
        populateFormSelects();
        if (taxoType === 'category') populateFilterTypeSelect();
        const sel = { category: typeSelect, city: citySelect, neighborhood: neighborhoodSelect }[taxoType];
        if (sel) sel.value = name.trim();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

function populateFormSelects() {
    fillSelect(typeSelect, categories);
    fillSelect(citySelect, cities, 'Seleccionar ciudad');
    fillSelect(neighborhoodSelect, neighborhoods, 'Seleccionar barrio');
}
function fillSelect(select, items, placeholder) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '')
        + items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
    if (current) ensureOptionExists(select, current);
}
function ensureOptionExists(select, value) {
    if (!value) return;
    if (!Array.from(select.options).some(o => o.value === value)) {
        const opt = document.createElement('option');
        opt.value = value; opt.textContent = value;
        select.appendChild(opt);
    }
    select.value = value;
}
function populateFilterTypeSelect() {
    if (!filterTypeSelect) return;
    const cur = filterTypeSelect.value;
    filterTypeSelect.innerHTML = '<option value="">Tipo</option>'
        + categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    filterTypeSelect.value = cur;
}

// ── Tabla de propiedades ──────────────────────────────────────────────────────
function renderAdminTable() {
    const container = document.getElementById('pagination-container');
    const searchTerm = (document.getElementById('admin-search')?.value || '').toLowerCase();
    
    // Filtrar por término de búsqueda (título, barrio, zona o código)
    const listToRender = properties.filter(p => {
        if (!searchTerm) return true;
        const s = searchTerm;
        return (p.title || '').toLowerCase().includes(s) ||
               (p.neighborhood || '').toLowerCase().includes(s) ||
               (p.zone || '').toLowerCase().includes(s) ||
               (p.code || '').toLowerCase().includes(s);
    });

    if (!listToRender.length) {
        propertiesTbody.innerHTML = '<tr><td colspan="8" class="adm-table-empty">No se encontraron propiedades.</td></tr>';
        if (container) container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(listToRender.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProps = listToRender.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    propertiesTbody.innerHTML = paginatedProps.map(p => `
        <tr>
            <td><strong>${p.code || p.id.slice(0,6)}</strong></td>
            <td><strong>${p.title}</strong><span>${p.type || ''}</span></td>
            <td><span class="badge ${p.operation}">${(p.operation||'').toUpperCase()}</span></td>
            <td>${p.status || '—'}</td>
            <td>${p.consultarPrecio ? 'Consultar' : ((p.currency||'') + ' ' + (p.price||0).toLocaleString())}</td>
            <td>${[p.neighborhood, p.zone].filter(Boolean).join(', ')}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editProperty('${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" onclick="handleDeleteProperty('${p.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    if (container) {
        if (totalPages <= 1) {
            container.innerHTML = '';
        } else {
            let buttonsHtml = '';
            for (let i = 1; i <= totalPages; i++) {
                buttonsHtml += `<button class="adm-btn ${i === currentPage ? 'adm-btn-primary' : 'adm-btn-secondary'}" style="padding: 6px 12px; min-width:36px;" onclick="window.goToPage(${i})">${i}</button>`;
            }
            container.innerHTML = buttonsHtml;
        }
    }
}

window.goToPage = function(page) {
    currentPage = page;
    renderAdminTable();
};

function formatDate(v) {
    if (!v) return '—';
    const d = v.toDate ? v.toDate() : new Date(v);
    return isNaN(d) ? '—' : d.toLocaleDateString('es-AR');
}

function updateStats() {
    if (totalPropertiesEl) totalPropertiesEl.textContent = properties.length;
    if (totalAlquilerEl)   totalAlquilerEl.textContent   = properties.filter(p => p.operation?.startsWith('alquiler')).length;
    if (totalVentaEl)      totalVentaEl.textContent      = properties.filter(p => p.operation === 'venta').length;
    const pub  = document.getElementById('total-publicadas');
    const vend = document.getElementById('total-vendidas');
    if (pub)  pub.textContent  = properties.filter(p => p.status === 'publicado').length;
    if (vend) vend.textContent = properties.filter(p => p.status === 'vendido').length;
}

// ── Imágenes — gestionadas por cloudinaryUpload.js ───────────────────────────
// Las funciones addImageRow / setImageUrls / getImageUrls fueron reemplazadas
// por initImageGallery / setGalleryUrls / getGalleryUrls del módulo Cloudinary.

// ── Leer formulario ───────────────────────────────────────────────────────────
function readFormData() {
    return {
        // Principal
        code:            val('prop-code'),
        title:           val('title'),
        status:          propertyForm.querySelector('input[name="status"]:checked')?.value || 'pendiente',
        price:           Number(val('price')) || 0,
        currency:        val('currency'),
        consultarPrecio: document.getElementById('consultar-precio')?.checked || false,
        type:            val('type'),
        operation:       val('operation'),
        neighborhood:    val('neighborhood'),
        zone:            val('zone'),
        provincia:       val('provincia'),
        pais:            val('pais'),
        branch:          val('branch'),
        description:     val('description'),
        observaciones:   val('observaciones'),

        // Destacados
        surface:         numVal('surface'),
        supCubiertaDest: numVal('sup-cubierta-dest'),
        bedrooms:        numVal('bedrooms'),
        dormitorios:     numVal('dormitorios'),
        bathrooms:       numVal('bathrooms'),
        toilette:        numVal('toilette'),
        antiguedad:      numVal('antiguedad'),
        garage:          numVal('garage'),
        orientacion:     val('orientacion'),
        luminoso:        getRadioValue('luminoso'),

        // Superficies
        supCubierta:     numVal('sup-cubierta'),
        supSemicubierta: numVal('sup-semicubierta'),
        supDescubierta:  numVal('sup-descubierta'),
        supPropia:       numVal('sup-propia'),
        supTerreno:      numVal('sup-terreno'),
        supTotalDisp:    numVal('sup-total-disp'),
        frente:          numVal('frente'),
        fondo:           numVal('fondo'),
        plantaBaja:      numVal('planta-baja'),
        primerPiso:      numVal('primer-piso'),

        // Ambientes
        cantDormitorios:    Number(val('cant-dormitorios')) || null,
        detalleDormitorios: val('detalle-dormitorios'),
        cantBanos:          Number(val('cant-banos')) || null,
        detalleBanos:       val('detalle-banos'),
        tipoCocina:         val('tipo-cocina'),
        lavadero:           val('lavadero'),
        cocheraTipo:        val('cochera-tipo'),
        tipoDisposicion:    val('tipo-disposicion'),
        distribucion:       getCheckboxValues('distribucion'),
        tieneCocina:        getRadioValue('tiene-cocina'),
        balcon:             getRadioValue('balcon'),
        patio:              getRadioValue('patio'),
        jardin:             getRadioValue('jardin'),
        quincho:            getRadioValue('quincho'),
        piscina:            getRadioValue('piscina'),

        // Servicios
        expensas:         Number(val('expensas')) || null,
        noExpensas:       getRadioValue('no-expensas'),
        aysa:             getRadioValue('aysa'),
        calefaccion:      val('calefaccion'),
        aireAcondicionado:val('aire-acondicionado'),
        aguaCaliente:     val('agua-caliente'),
        tipoPiso:         val('tipo-piso'),
        ventilacion:      val('ventilacion'),
        todoDestino:      getRadioValue('todo-destino'),
        extras:           getCheckboxValues('extras'),

        // Edificio
        pisosEdificio:    Number(val('pisos-edificio')) || null,
        deptosPorPiso:    Number(val('deptos-por-piso')) || null,
        ascensor:         val('ascensor'),
        tipoEdilicio:     val('tipo-edilicio'),
        amenities:        getCheckboxValues('amenities'),

        // Comercial
        banosGenerales:   getRadioValue('banos-generales'),
        cantHabitaciones: Number(val('cant-habitaciones')) || null,
        estadoOcupacion:  val('estado-ocupacion'),
        estadoConstruccion: val('estado-construccion'),
        entrega:          val('entrega'),
        formaPago:        val('forma-pago'),

        // Medios
        images:           getGalleryUrls(),
        videoUrl:         val('video-url'),
        recorridoUrl:     val('recorrido-url'),
        planoUrl:         val('plano-url'),
        geoLat:           Number(val('geo-lat')) || null,
        geoLng:           Number(val('geo-lng')) || null,
    };
}

// ── Cargar datos en el formulario ─────────────────────────────────────────────
function fillForm(p) {
    // Principal
    setVal('prop-code', p.code || '');
    setVal('title', p.title);
    setVal('price', p.price);
    setVal('currency', p.currency || 'USD');
    if (document.getElementById('consultar-precio'))
        document.getElementById('consultar-precio').checked = !!p.consultarPrecio;
    const sr = propertyForm.querySelector(`input[name="status"][value="${p.status||'pendiente'}"]`);
    if (sr) sr.checked = true;
    populateFormSelects();
    ensureOptionExists(typeSelect, p.type);
    ensureOptionExists(citySelect, p.zone);
    ensureOptionExists(neighborhoodSelect, p.neighborhood);
    setVal('type', p.type); setVal('operation', p.operation);
    setVal('neighborhood', p.neighborhood); setVal('zone', p.zone);
    setVal('provincia', p.provincia); setVal('pais', p.pais || 'Argentina');
    setVal('branch', p.branch);
    setVal('description', p.description); setVal('observaciones', p.observaciones);

    // Destacados
    setVal('surface', p.surface); setVal('sup-cubierta-dest', p.supCubiertaDest);
    setVal('bedrooms', p.bedrooms); setVal('dormitorios', p.dormitorios);
    setVal('bathrooms', p.bathrooms); setVal('toilette', p.toilette);
    setVal('antiguedad', p.antiguedad); setVal('garage', p.garage);
    setVal('orientacion', p.orientacion);
    setRadioValue('luminoso', p.luminoso);

    // Superficies
    setVal('sup-cubierta', p.supCubierta); setVal('sup-semicubierta', p.supSemicubierta);
    setVal('sup-descubierta', p.supDescubierta); setVal('sup-propia', p.supPropia);
    setVal('sup-terreno', p.supTerreno); setVal('sup-total-disp', p.supTotalDisp);
    setVal('frente', p.frente); setVal('fondo', p.fondo);
    setVal('planta-baja', p.plantaBaja); setVal('primer-piso', p.primerPiso);

    // Ambientes
    setVal('cant-dormitorios', p.cantDormitorios); setVal('detalle-dormitorios', p.detalleDormitorios);
    setVal('cant-banos', p.cantBanos); setVal('detalle-banos', p.detalleBanos);
    setVal('tipo-cocina', p.tipoCocina); setVal('lavadero', p.lavadero);
    setVal('cochera-tipo', p.cocheraTipo); setVal('tipo-disposicion', p.tipoDisposicion);
    setCheckboxValues('distribucion', p.distribucion || []);
    setRadioValue('tiene-cocina', p.tieneCocina); setRadioValue('balcon', p.balcon);
    setRadioValue('patio', p.patio); setRadioValue('jardin', p.jardin);
    setRadioValue('quincho', p.quincho); setRadioValue('piscina', p.piscina);

    // Servicios
    setVal('expensas', p.expensas);
    setRadioValue('no-expensas', p.noExpensas); setRadioValue('aysa', p.aysa);
    setVal('calefaccion', p.calefaccion); setVal('aire-acondicionado', p.aireAcondicionado);
    setVal('agua-caliente', p.aguaCaliente); setVal('tipo-piso', p.tipoPiso);
    setVal('ventilacion', p.ventilacion);
    setRadioValue('todo-destino', p.todoDestino);
    setCheckboxValues('extras', p.extras || []);

    // Edificio
    setVal('pisos-edificio', p.pisosEdificio); setVal('deptos-por-piso', p.deptosPorPiso);
    setVal('ascensor', p.ascensor); setVal('tipo-edilicio', p.tipoEdilicio);
    setCheckboxValues('amenities', p.amenities || []);

    // Comercial
    setRadioValue('banos-generales', p.banosGenerales);
    setVal('cant-habitaciones', p.cantHabitaciones); setVal('estado-ocupacion', p.estadoOcupacion);
    setVal('estado-construccion', p.estadoConstruccion); setVal('entrega', p.entrega);
    setVal('forma-pago', p.formaPago);

    // Medios
    setGalleryUrls(p.images || []);
    setVal('video-url', p.videoUrl); setVal('recorrido-url', p.recorridoUrl);
    setVal('plano-url', p.planoUrl);
    setVal('geo-lat', p.geoLat); setVal('geo-lng', p.geoLng);
}

// ── Reset booleans ────────────────────────────────────────────────────────────
function resetBooleans() {
    const names = [
        'luminoso','tiene-cocina','balcon','patio','jardin','quincho','piscina',
        'no-expensas','aysa','todo-destino','banos-generales',
    ];
    names.forEach(name => {
        const blank = document.querySelector(`input[name="${name}"][value=""]`);
        if (blank) blank.checked = true;
    });
}

// ── Modal actions ─────────────────────────────────────────────────────────────
function openNewPropertyModal() {
    editingId = null;
    modalTitle.textContent = 'Nueva Propiedad';
    propertyForm.reset();
    resetBooleans();
    populateFormSelects();
    setGalleryUrls([]); // limpiar galería
    setVal('pais', 'Argentina');
    document.getElementById('display-prop-code').textContent = '—';
    switchTab('tab-principal');
    propertyModal.style.display = 'flex';
}

function closeModal() {
    propertyModal.style.display = 'none';
}

window.editProperty = async id => {
    editingId = id;
    const p = properties.find(x => x.id === id);
    if (!p) return;
    modalTitle.textContent = 'Editar Propiedad';
    document.getElementById('display-prop-code').textContent = id;
    fillForm(p);
    switchTab('tab-principal');
    propertyModal.style.display = 'flex';
};

window.handleDeleteProperty = async id => {
    if (!confirm('¿Eliminar esta propiedad? Esta acción no se puede deshacer.')) return;
    try {
        await deleteProperty(id);
        showToast('Propiedad eliminada.', 'success');
        loadAdminData();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
};

async function handleFormSubmit(e) {
    e.preventDefault();
    const data = readFormData();
    // Remove empty arrays
    if (!data.distribucion?.length) delete data.distribucion;
    if (!data.extras?.length) delete data.extras;
    if (!data.amenities?.length) delete data.amenities;
    try {
        if (editingId) {
            await updateProperty(editingId, data);
            showToast('Propiedad actualizada con éxito.', 'success');
        } else {
            await createProperty(data);
            showToast('Propiedad creada con éxito.', 'success');
        }
        closeModal();
        loadAdminData();
    } catch (e) { showToast('Error al guardar: ' + e.message, 'error'); }
}
