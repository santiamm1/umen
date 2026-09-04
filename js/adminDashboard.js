// adminDashboard.js — Panel de administración UMEN
import { onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import {
    getProperties, createProperty, updateProperty, deleteProperty,
    ensureDefaultTaxonomy,
    getCategories, createCategory, updateCategory, deleteCategory,
    getCities, createCity, updateCity, deleteCity,
    getAllNeighborhoods, createNeighborhood, updateNeighborhood, deleteNeighborhood,
    getOperations, createOperation, updateOperation, deleteOperation,
    getStatuses, createStatus, updateStatus, deleteStatus,
    getCurrencies, createCurrency, updateCurrency, deleteCurrency,
    getCountries, createCountry, updateCountry, deleteCountry,
    getProvinces, createProvince, updateProvince, deleteProvince,
    getLocalities, createLocality, updateLocality, deleteLocality,
    getAdminProfile, saveAdminProfile,
    getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost
} from './propertyService.js?v=3';
import { initImageGallery, setGalleryUrls, getGalleryUrls, uploadFile } from './cloudinaryUpload.js?v=2';
import { APP_VERSION } from './version.js';

const sidebarVersionEl = document.getElementById('adm-sidebar-version');
if (sidebarVersionEl) sidebarVersionEl.textContent = APP_VERSION;

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

// Reemplaza al confirm() nativo del navegador por un modal con el estilo del panel.
function confirmDialog(message, { title = '¿Confirmar acción?', acceptLabel = 'Aceptar' } = {}) {
    return new Promise(resolve => {
        const overlay  = document.getElementById('confirm-modal');
        const titleEl  = document.getElementById('confirm-modal-title');
        const msgEl    = document.getElementById('confirm-modal-message');
        const cancelBtn = document.getElementById('confirm-modal-cancel');
        const acceptBtn = document.getElementById('confirm-modal-accept');
        if (!overlay) { resolve(confirm(message)); return; }

        titleEl.textContent = title;
        msgEl.textContent = message;
        acceptBtn.textContent = acceptLabel;
        overlay.style.display = 'flex';

        const cleanup = (result) => {
            overlay.style.display = 'none';
            cancelBtn.removeEventListener('click', onCancel);
            acceptBtn.removeEventListener('click', onAccept);
            overlay.removeEventListener('click', onOverlay);
            document.removeEventListener('keydown', onKeydown);
            resolve(result);
        };
        const onCancel  = () => cleanup(false);
        const onAccept  = () => cleanup(true);
        const onOverlay = (e) => { if (e.target === overlay) cleanup(false); };
        const onKeydown = (e) => { if (e.key === 'Escape') cleanup(false); };

        cancelBtn.addEventListener('click', onCancel);
        acceptBtn.addEventListener('click', onAccept);
        overlay.addEventListener('click', onOverlay);
        document.addEventListener('keydown', onKeydown);
    });
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const logoutBtn          = document.getElementById('sidebar-logout-btn');
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
let operations    = [];
let statuses      = [];
let currencies    = [];
let countries     = [];
let provinces     = [];
let localities    = [];
let currentPage   = 1;
const ITEMS_PER_PAGE = 10;
let statusChart = null;
let operationChart = null;
let typeChart = null;

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
    },
    operation: {
        getList: () => operations, setList: v => { operations = v; },
        fetch: getOperations, create: createOperation, update: updateOperation, delete: deleteOperation,
        listEl: 'operation-list', inputEl: 'new-operation-input', addBtnEl: 'add-operation-btn'
    },
    status: {
        getList: () => statuses, setList: v => { statuses = v; },
        fetch: getStatuses, create: createStatus, update: updateStatus, delete: deleteStatus,
        listEl: 'status-list', inputEl: 'new-status-input', addBtnEl: 'add-status-btn'
    },
    currency: {
        getList: () => currencies, setList: v => { currencies = v; },
        fetch: getCurrencies, create: createCurrency, update: updateCurrency, delete: deleteCurrency,
        listEl: 'currency-list', inputEl: 'new-currency-input', addBtnEl: 'add-currency-btn'
    },
    country: {
        getList: () => countries, setList: v => { countries = v; },
        fetch: getCountries, create: createCountry, update: updateCountry, delete: deleteCountry,
        listEl: 'country-list', inputEl: 'new-country-input', addBtnEl: 'add-country-btn'
    },
    province: {
        getList: () => provinces, setList: v => { provinces = v; },
        fetch: getProvinces, create: createProvince, update: updateProvince, delete: deleteProvince,
        listEl: 'province-list', inputEl: 'new-province-input', addBtnEl: 'add-province-btn'
    },
    locality: {
        getList: () => localities, setList: v => { localities = v; },
        fetch: getLocalities, create: createLocality, update: updateLocality, delete: deleteLocality,
        listEl: 'locality-list', inputEl: 'new-locality-input', addBtnEl: 'add-locality-btn'
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
    const raw = val(id).trim();
    if (raw === '') return null;
    const n = Number(raw);
    return isNaN(n) ? null : n;
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
});

function setupEventListeners() {
    logoutBtn?.addEventListener('click', handleLogout);
    newPropertyBtn?.addEventListener('click', openNewPropertyModal);
    propertyForm?.addEventListener('submit', handleFormSubmit);
    // Los campos requeridos pueden vivir en un tab oculto (display:none) — el navegador
    // no puede enfocarlos para mostrar el mensaje de validación nativo, y el submit
    // queda "colgado" sin feedback. Cambiamos al tab del campo inválido y avisamos con un toast.
    let invalidToastShown = false;
    propertyForm?.addEventListener('invalid', e => {
        const panel = e.target.closest('.adm-tab-panel');
        if (panel && !panel.classList.contains('active')) switchTab(panel.id);
        if (!invalidToastShown) {
            invalidToastShown = true;
            const fieldName = e.target.labels?.[0]?.textContent?.replace('*', '').trim() || e.target.name || e.target.id;
            showToast(`No se pudo guardar: el campo "${fieldName}" tiene datos inválidos.`, 'error');
            setTimeout(() => { invalidToastShown = false; }, 0);
        }
    }, true);
    document.getElementById('save-draft-btn')?.addEventListener('click', handleSaveDraft);
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', closeModal));

    document.getElementById('dashboard-date-filter')?.addEventListener('change', updateStats);

    document.addEventListener('adm:enter-profile', loadProfileForm);
    document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);
    document.getElementById('profile-photo-btn')?.addEventListener('click', () => {
        document.getElementById('profile-photo-input')?.click();
    });
    document.getElementById('profile-photo-input')?.addEventListener('change', handleProfilePhotoChange);
    document.getElementById('profile-photo-remove-btn')?.addEventListener('click', handleRemoveProfilePhoto);
    
    const rerenderProperties = () => {
        currentPage = 1;
        if (kanbanView) renderKanban(); else renderAdminTable();
    };
    document.getElementById('admin-search')?.addEventListener('input', rerenderProperties);
    document.getElementById('filter-operation')?.addEventListener('change', rerenderProperties);
    document.getElementById('filter-type')?.addEventListener('change', rerenderProperties);
    document.getElementById('filter-status')?.addEventListener('change', rerenderProperties);

    // KPIs del dashboard: llevan a Propiedades con el filtro correspondiente ya aplicado
    document.getElementById('kpi-total')?.addEventListener('click', () => goToPropertiesFiltered({}));
    document.getElementById('kpi-publicadas')?.addEventListener('click', () => goToPropertiesFiltered({ status: 'publicado' }));
    document.getElementById('kpi-venta')?.addEventListener('click', () => goToPropertiesFiltered({ operation: 'venta' }));
    document.getElementById('kpi-alquiler')?.addEventListener('click', () => goToPropertiesFiltered({ operation: 'alquiler' }));

    document.getElementById('view-table-btn')?.addEventListener('click', () => setPropertiesView('table'));
    document.getElementById('view-kanban-btn')?.addEventListener('click', () => setPropertiesView('kanban'));

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

    // Subtabs de Ubicación
    document.querySelectorAll('.adm-subtab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            document.querySelectorAll('.adm-subtab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.loc-panel').forEach(p => p.style.display = 'none');
            
            e.target.classList.add('active');
            document.getElementById(targetId).style.display = 'block';
        });
    });
}

async function handleLogout() {
    try { await signOut(window.auth); window.location.href = '/'; }
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
        // Sembrar valores por defecto solo 1 vez por navegador para que cargue ultra rápido
        if (!localStorage.getItem('umen_taxo_seeded_v3')) {
            await ensureDefaultTaxonomy();
            localStorage.setItem('umen_taxo_seeded_v3', 'true');
        } else {
            // Se ejecuta de fondo sin frenar la UI
            ensureDefaultTaxonomy().catch(console.error);
        }

        // Cargamos todas las propiedades y las listas de taxonomía EN PARALELO
        const propertiesPromise = getProperties({ limit: 5000 });
        await loadAllTaxonomies();
        
        properties = await propertiesPromise;
        clearTimeout(timeout);
        // Recalculan los conteos "(N)" de cada opción ahora que properties ya cargó
        populateFilterTypeSelect();
        populateFilterOperationSelect();
        populateFilterStatusSelect();

        renderAdminTable();
        setPropertiesView(kanbanView ? 'kanban' : 'table');
        updateStats();
        renderPropertiesMap();
        fetchWeather();
        updateGreeting();
        const currentUser = window.auth?.currentUser;
        if (currentUser) getAdminProfile(currentUser.uid).then(p => { adminProfileCache = p; updateGreeting(); });
    } catch (e) {
        clearTimeout(timeout);
        console.error(e);
        propertiesTbody.innerHTML = '<tr><td colspan="8" class="adm-table-empty" style="color:red">Error al conectar con la base de datos.</td></tr>';
    }
}

// Refresco liviano tras crear/editar/duplicar/eliminar una propiedad: solo trae
// las propiedades de nuevo. loadAdminData() además re-pide taxonomías (9 lecturas
// a Firestore), clima y perfil — innecesario y es lo que hacía sentir lento el guardado.
async function refreshProperties() {
    properties = await getProperties({ limit: 5000 });
    populateFilterTypeSelect();
    populateFilterOperationSelect();
    populateFilterStatusSelect();
    renderAdminTable();
    setPropertiesView(kanbanView ? 'kanban' : 'table');
    updateStats();
    renderPropertiesMap();
}

// ── Clima y Bienvenida ──────────────────────────────────────────────────────
async function fetchWeather() {
    try {
        // Coordenadas de Buenos Aires
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-34.6037&longitude=-58.3816&current_weather=true');
        const data = await res.json();
        if (data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const tempEl = document.getElementById('weather-temp');
            if (tempEl) tempEl.textContent = `${temp}°C`;
        }
    } catch (e) {
        console.error("Error al obtener el clima:", e);
    }
}

let adminProfileCache = null; // { name, phone, photoURL } — cacheado tras el primer fetch

function updateGreeting() {
    const user = window.auth?.currentUser;
    const name = adminProfileCache?.name || user?.displayName || user?.email?.split('@')[0] || 'Administrador';
    // ?? (no ||): una foto eliminada queda en '', que es un valor válido y no debe
    // caer de nuevo en la foto de Google/Auth — solo cae si nunca se definió (null/undefined).
    const photoURL = adminProfileCache?.photoURL ?? user?.photoURL ?? '';

    const greetingEl = document.getElementById('adm-greeting-name');
    if (greetingEl) greetingEl.textContent = `Hola, ${name}`;

    const sidebarNameEl = document.getElementById('adm-sidebar-name');
    if (sidebarNameEl) sidebarNameEl.textContent = name;

    applyAvatar('adm-sidebar-avatar', 'adm-sidebar-avatar-fallback', name, photoURL);
    applyAvatar('profile-avatar', 'profile-avatar-fallback', name, photoURL);

    const removeBtn = document.getElementById('profile-photo-remove-btn');
    if (removeBtn) removeBtn.style.display = photoURL ? 'inline-flex' : 'none';
}

// Muestra la foto de perfil si existe, o un círculo con la inicial del nombre.
function applyAvatar(imgId, fallbackId, name, photoURL) {
    const imgEl = document.getElementById(imgId);
    const fallbackEl = document.getElementById(fallbackId);
    if (!imgEl || !fallbackEl) return;
    if (photoURL) {
        imgEl.src = photoURL;
        imgEl.style.display = 'block';
        fallbackEl.style.display = 'none';
    } else {
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'flex';
        fallbackEl.textContent = (name || 'A').trim().charAt(0).toUpperCase();
    }
}

// ── Mi Perfil (nombre, teléfono y foto; email/contraseña son de Firebase Auth) ─
async function loadProfileForm() {
    const user = window.auth?.currentUser;
    if (!user) return;
    const nameEl  = document.getElementById('profile-name');
    const phoneEl = document.getElementById('profile-phone');
    const emailEl = document.getElementById('profile-email');
    if (emailEl) emailEl.value = user.email || '';

    adminProfileCache = await getAdminProfile(user.uid);
    if (nameEl)  nameEl.value  = adminProfileCache.name  || user.displayName || '';
    if (phoneEl) phoneEl.value = adminProfileCache.phone || '';
    updateGreeting();
}

async function handleProfileSubmit(e) {
    e.preventDefault();
    const user = window.auth?.currentUser;
    if (!user) return;
    const name  = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    try {
        await saveAdminProfile(user.uid, { name, phone });
        if (name && name !== user.displayName) await updateProfile(user, { displayName: name });
        adminProfileCache = { ...adminProfileCache, name, phone };
        updateGreeting();
        showToast('Perfil actualizado.');
    } catch (err) {
        showToast('Error al guardar el perfil: ' + err.message, 'error');
    }
}

async function handleProfilePhotoChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    const user = window.auth?.currentUser;
    if (!file || !user) return;
    try {
        showToast('Subiendo foto…');
        const result = await uploadFile(file);
        await saveAdminProfile(user.uid, { photoURL: result.secure_url });
        await updateProfile(user, { photoURL: result.secure_url }).catch(() => {}); // no crítico si falla
        adminProfileCache = { ...adminProfileCache, photoURL: result.secure_url };
        updateGreeting();
        showToast('Foto de perfil actualizada.');
    } catch (err) {
        showToast('Error al subir la foto: ' + err.message, 'error');
    }
}

async function handleRemoveProfilePhoto() {
    const user = window.auth?.currentUser;
    if (!user) return;
    try {
        await saveAdminProfile(user.uid, { photoURL: '' });
        await updateProfile(user, { photoURL: null }).catch(() => {}); // no crítico si falla
        adminProfileCache = { ...adminProfileCache, photoURL: '' };
        updateGreeting();
        showToast('Foto de perfil eliminada.');
    } catch (err) {
        showToast('Error al eliminar la foto: ' + err.message, 'error');
    }
}

// ── Taxonomía ─────────────────────────────────────────────────────────────────
async function loadAllTaxonomies() {
    // Disparar las 9 peticiones en paralelo
    const promises = Object.entries(TAXO_CONFIG).map(async ([type, cfg]) => {
        const list = await cfg.fetch();
        cfg.setList(list);
        renderTaxoList(type);
    });
    await Promise.all(promises);

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
            <span class="adm-taxo-chip-label" title="${item.name}">${item.name}</span>
            <div class="adm-taxo-actions">
                <button type="button" class="adm-taxo-edit" title="Renombrar"><i class="fas fa-pen"></i></button>
                <button type="button" class="adm-taxo-del" title="Eliminar"><i class="fas fa-times"></i></button>
            </div>
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
    if (!item) return;
    if (!await confirmDialog(`¿Eliminar "${item.name}"?`, { acceptLabel: 'Eliminar' })) return;
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
    const label = { 
        category: 'tipo de propiedad', 
        city: 'ciudad', 
        neighborhood: 'barrio', 
        operation: 'operación', 
        status: 'estado', 
        currency: 'moneda',
        country: 'país',
        province: 'provincia',
        locality: 'localidad'
    }[taxoType];
    const name  = prompt(`Nuevo ${label}:`);
    if (!name?.trim()) return;
    try {
        await cfg.create({ name: name.trim() });
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
        populateFormSelects();
        if (taxoType === 'category') populateFilterTypeSelect();
        const sel = { 
            category: typeSelect, 
            city: citySelect, 
            neighborhood: neighborhoodSelect,
            operation: document.getElementById('operation'),
            status: document.getElementById('status'),
            currency: document.getElementById('currency'),
            country: document.getElementById('pais'),
            province: document.getElementById('provincia'),
            locality: document.getElementById('localidad')
        }[taxoType];
        if (sel) sel.value = name.trim();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

function populateFormSelects() {
    fillSelect(typeSelect, categories);
    fillSelect(citySelect, cities, 'Seleccionar ciudad');
    fillSelect(neighborhoodSelect, neighborhoods, 'Seleccionar barrio');
    fillSelect(document.getElementById('operation'), operations);
    fillSelect(document.getElementById('status'), statuses);
    fillSelect(document.getElementById('currency'), currencies);
    fillSelect(document.getElementById('pais'), countries, 'Seleccionar país');
    fillSelect(document.getElementById('provincia'), provinces, 'Seleccionar provincia');
    fillSelect(document.getElementById('localidad'), localities, 'Seleccionar localidad');
}
function fillSelect(select, items, placeholder) {
    if (!select) return;
    select.innerHTML = '';
    if (placeholder) select.innerHTML += `<option value="">${placeholder}</option>`;
    
    const seen = new Set();
    items.forEach(i => {
        const val = i.name || '';
        const key = val.toLowerCase().trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        
        const option = document.createElement('option');
        option.value = val;
        option.textContent = capitalize(val);
        select.appendChild(option);
    });
}
function ensureOptionExists(select, value) {
    if (!value) return;
    if (!Array.from(select.options).some(o => o.value === value)) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = capitalize(value);
        select.appendChild(opt);
    }
    select.value = value;
}
function populateFilterTypeSelect() {
    if (!filterTypeSelect) return;
    const cur = filterTypeSelect.value;
    const counts = {};
    properties.forEach(p => { if (p.type) counts[p.type] = (counts[p.type] || 0) + 1; });
    filterTypeSelect.innerHTML = '<option value="">Tipo</option>'
        + categories.map(c => `<option value="${c.name}">${c.name} (${counts[c.name] || 0})</option>`).join('');
    filterTypeSelect.value = cur;
}
function populateFilterOperationSelect() {
    const select = document.getElementById('filter-operation');
    if (!select) return;
    const cur = select.value;
    const counts = {};
    properties.forEach(p => {
        const v = (p.operation || '').toLowerCase();
        if (v) counts[v] = (counts[v] || 0) + 1;
    });
    const options = [['venta', 'Venta'], ['alquiler', 'Alquiler']];
    select.innerHTML = '<option value="">Operación</option>'
        + options.map(([v, label]) => `<option value="${v}">${label} (${counts[v] || 0})</option>`).join('');
    select.value = cur;
}
function populateFilterStatusSelect() {
    const select = document.getElementById('filter-status');
    if (!select) return;
    const cur = select.value;
    const counts = {};
    properties.forEach(p => {
        const v = (p.status || '').toLowerCase();
        if (v) counts[v] = (counts[v] || 0) + 1;
    });
    const options = [['publicado', 'Publicado'], ['pendiente', 'Pendiente'], ['borrador', 'Borrador'], ['pausa', 'Pausa'], ['vendido', 'Vendido']];
    select.innerHTML = '<option value="">Estado</option>'
        + options.map(([v, label]) => `<option value="${v}">${label} (${counts[v] || 0})</option>`).join('');
    select.value = cur;
}

// Navega a la sección Propiedades aplicando el filtro del KPI clickeado en el dashboard.
function goToPropertiesFiltered({ operation = '', status = '' }) {
    const opSelect = document.getElementById('filter-operation');
    const typeSelect = document.getElementById('filter-type');
    const statusSelect = document.getElementById('filter-status');
    const searchInput = document.getElementById('admin-search');
    if (opSelect) opSelect.value = operation;
    if (typeSelect) typeSelect.value = '';
    if (statusSelect) statusSelect.value = status;
    if (searchInput) searchInput.value = '';
    currentPage = 1;
    if (kanbanView) renderKanban(); else renderAdminTable();

    const link = document.querySelector('.adm-sidebar-link[data-section="propiedades"]');
    window.goToSection?.('propiedades', link);
}

// Filtra por el término de búsqueda global (título, barrio, zona o código) — usado por tabla y kanban.
function getSearchFilteredProperties() {
    const searchTerm = (document.getElementById('admin-search')?.value || '').toLowerCase();
    const operationFilter = document.getElementById('filter-operation')?.value || '';
    const typeFilter = document.getElementById('filter-type')?.value || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';

    let list = properties;

    if (operationFilter) {
        list = list.filter(p => (p.operation || '').toLowerCase() === operationFilter);
    }
    if (typeFilter) {
        list = list.filter(p => p.type === typeFilter);
    }
    if (statusFilter) {
        list = list.filter(p => (p.status || '').toLowerCase() === statusFilter);
    }
    if (searchTerm) {
        list = list.filter(p =>
            (p.title || '').toLowerCase().includes(searchTerm) ||
            (p.neighborhood || '').toLowerCase().includes(searchTerm) ||
            (p.zone || '').toLowerCase().includes(searchTerm) ||
            (p.code || '').toLowerCase().includes(searchTerm)
        );
    }
    return list;
}

// ── Tabla de propiedades ──────────────────────────────────────────────────────
function renderAdminTable() {
    const container = document.getElementById('pagination-container');
    const listToRender = getSearchFilteredProperties();

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
            <td><span class="adm-data-mono">${p.code || p.id.slice(0,6)}</span></td>
            <td><span class="adm-table-title">${p.title}</span><span class="adm-table-subtitle">${p.type || ''}</span></td>
            <td><span class="adm-status-dot ${(p.operation || '').toLowerCase().replace(/ /g, '_')}">${capitalize(p.operation)}</span></td>
            <td><span class="adm-status-dot ${(p.status || 'pendiente').toLowerCase().replace(/ /g, '_')}">${capitalize(p.status || 'Pendiente')}</span></td>
            <td><span class="adm-data-mono">${p.consultarPrecio ? 'Consultar' : ((p.currency||'') + ' ' + (p.price||0).toLocaleString())}</span></td>
            <td>${[p.neighborhood, p.zone].filter(Boolean).join(', ')}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editProperty('${p.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-duplicate" onclick="handleDuplicateProperty('${p.id}')" title="Duplicar"><i class="fas fa-copy"></i></button>
                    <button class="btn-print" onclick="printPropertySheet('${p.id}')" title="Imprimir ficha / PDF"><i class="fas fa-print"></i></button>
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
                buttonsHtml += `<button class="adm-pagination-btn ${i === currentPage ? 'active' : ''}" onclick="window.goToPage(${i})">${i}</button>`;
            }
            container.innerHTML = buttonsHtml;
        }
    }
}

window.goToPage = function(page) {
    currentPage = page;
    renderAdminTable();
};

// ── Vista Kanban (tableros por estado) ──────────────────────────────────────
let kanbanView = localStorage.getItem('umen_properties_view') === 'kanban';

function setPropertiesView(view) {
    kanbanView = view === 'kanban';
    localStorage.setItem('umen_properties_view', kanbanView ? 'kanban' : 'table');
    document.getElementById('view-table-btn')?.classList.toggle('active', !kanbanView);
    document.getElementById('view-kanban-btn')?.classList.toggle('active', kanbanView);
    document.getElementById('properties-table-view').style.display = kanbanView ? 'none' : '';
    document.getElementById('properties-kanban-view').style.display = kanbanView ? 'grid' : 'none';
    if (kanbanView) renderKanban();
}

function renderKanban() {
    const board = document.getElementById('properties-kanban-view');
    if (!board) return;

    // Columnas = estados configurados en "Gestión de Datos → Estado"; fallback si aún no hay ninguno.
    const columns = statuses.length ? statuses.map(s => s.name) : ['Pendiente', 'Publicado', 'Pausa', 'Borrador', 'Vendido'];
    const listToRender = getSearchFilteredProperties();

    board.innerHTML = columns.map(statusName => {
        const key = statusName.toLowerCase().replace(/ /g, '_');
        const cards = listToRender.filter(p => (p.status || 'pendiente').toLowerCase() === statusName.toLowerCase());
        return `
            <div class="adm-kanban-col" data-status="${statusName}">
                <div class="adm-kanban-col-header">
                    <span class="adm-status-dot ${key}">${capitalize(statusName)}</span>
                    <span class="adm-kanban-count">${cards.length}</span>
                </div>
                <div class="adm-kanban-col-body">
                    ${cards.map(p => `
                        <div class="adm-kanban-card" draggable="true" data-id="${p.id}" onclick="editProperty('${p.id}')">
                            <span class="adm-kanban-card-title">${p.title || 'Sin título'}</span>
                            <span class="adm-kanban-card-meta">${[p.neighborhood, p.zone].filter(Boolean).join(', ') || '—'}</span>
                            <span class="adm-kanban-card-price">${p.consultarPrecio ? 'Consultar' : `${p.currency || ''} ${(p.price || 0).toLocaleString()}`}</span>
                        </div>
                    `).join('') || '<div class="adm-kanban-empty">Sin propiedades</div>'}
                </div>
            </div>
        `;
    }).join('');

    // Drag & drop nativo — arrastrar una tarjeta a otra columna cambia su estado.
    board.querySelectorAll('.adm-kanban-card').forEach(card => {
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    board.querySelectorAll('.adm-kanban-col').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', async e => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const id = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;
            const p = properties.find(x => x.id === id);
            if (!p || (p.status || '').toLowerCase() === newStatus.toLowerCase()) return;
            try {
                await updateProperty(id, { status: newStatus });
                p.status = newStatus;
                showToast(`Estado actualizado a "${newStatus}".`, 'success');
                renderKanban();
            } catch (err) { showToast('Error al mover la propiedad: ' + err.message, 'error'); }
        });
    });
}

function capitalize(v) {
    v = (v || '').toString();
    return v.charAt(0).toUpperCase() + v.slice(1);
}

function formatDate(v) {
    if (!v) return '—';
    const d = v.toDate ? v.toDate() : new Date(v);
    return isNaN(d) ? '—' : d.toLocaleDateString('es-AR');
}

// ── Mapa de propiedades (Leaflet + OpenStreetMap, gratis) ──────────────────────
let propertiesMap = null;
let propertiesMarkers = null;
let umenMarkerIcon = null;
function getUmenMarkerIcon() {
    if (umenMarkerIcon) return umenMarkerIcon;
    umenMarkerIcon = L.divIcon({
        className: 'umen-map-marker',
        html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#F68C18" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="15" cy="15" r="6" fill="#ffffff"/>
        </svg>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -38]
    });
    return umenMarkerIcon;
}
function renderPropertiesMap() {
    const mapEl = document.getElementById('properties-map');
    if (!mapEl || typeof L === 'undefined') return;

    if (!propertiesMap) {
        propertiesMap = L.map(mapEl).setView([-34.6037, -58.3816], 12); // Buenos Aires
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
            maxZoom: 19
        }).addTo(propertiesMap);
        propertiesMarkers = L.layerGroup().addTo(propertiesMap);
    }

    propertiesMarkers.clearLayers();
    const geoProps = properties.filter(p => p.geoLat && p.geoLng);

    const coverageEl = document.getElementById('map-coverage');
    if (coverageEl) {
        const missing = properties.length - geoProps.length;
        coverageEl.textContent = `${geoProps.length} de ${properties.length} con ubicación`;
        coverageEl.style.color = missing > 0 ? '#dc2626' : '#64748b';
    }
    geoProps.forEach(p => {
        const price = p.price ? `${p.currency || 'USD'} ${Number(p.price).toLocaleString('es-AR')}` : 'Consultar precio';
        L.marker([p.geoLat, p.geoLng], { icon: getUmenMarkerIcon() })
            .bindPopup(`
                <strong>${p.title || 'Propiedad'}</strong><br>
                ${p.code ? `Cód: ${p.code}<br>` : ''}
                ${capitalize(p.status || '')}<br>${price}<br>
                <a href="#" onclick="editProperty('${p.id}'); return false;">Ver ficha →</a>
            `)
            .addTo(propertiesMarkers);
    });

    if (geoProps.length) {
        propertiesMap.fitBounds(geoProps.map(p => [p.geoLat, p.geoLng]), { padding: [30, 30], maxZoom: 15 });
    }
    // Leaflet necesita este recalculo si el contenedor estaba oculto al inicializar
    setTimeout(() => propertiesMap.invalidateSize(), 100);
}

function updateStats() {
    // Forzar la tipografía global de Chart.js
    Chart.defaults.font.family = "'Google Sans', sans-serif";
    Chart.defaults.color = "#64748b";

    let filteredProps = properties;
    const filterEl = document.getElementById('dashboard-date-filter');
    if (filterEl) {
        const filterVal = filterEl.value;
        if (filterVal !== 'all') {
            const now = new Date();
            filteredProps = properties.filter(p => {
                const pDate = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : new Date(0));
                if (filterVal === 'month') {
                    return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
                } else if (filterVal === 'week') {
                    const diffTime = Math.abs(now - pDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    return diffDays <= 7;
                } else if (filterVal === 'year') {
                    return pDate.getFullYear() === now.getFullYear();
                }
                return true;
            });
        }
    }

    if (totalPropertiesEl) totalPropertiesEl.textContent = filteredProps.length;
    
    const alquilerCount = filteredProps.filter(p => p.operation?.toLowerCase().includes('alquiler')).length;
    const ventaCount = filteredProps.filter(p => p.operation?.toLowerCase() === 'venta').length;
    
    if (totalAlquilerEl) totalAlquilerEl.textContent = alquilerCount;
    if (totalVentaEl)    totalVentaEl.textContent = ventaCount;
    
    const pubCount = filteredProps.filter(p => p.status?.toLowerCase() === 'publicado').length;
    const vendCount = filteredProps.filter(p => p.status?.toLowerCase() === 'vendido').length;
    const pendCount = filteredProps.filter(p => p.status?.toLowerCase() === 'pendiente').length;
    const pausaCount = filteredProps.filter(p => p.status?.toLowerCase() === 'pausa').length;
    const borrCount = filteredProps.filter(p => p.status?.toLowerCase() === 'borrador').length;

    const pub  = document.getElementById('total-publicadas');
    const vend = document.getElementById('total-vendidas');
    if (pub)  pub.textContent  = pubCount;
    if (vend) vend.textContent = vendCount;

    // Actualizar gráficos si Chart está disponible
    if (typeof Chart !== 'undefined') {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        const statusCtx = document.getElementById('statusChart')?.getContext('2d');
        const operationCtx = document.getElementById('operationChart')?.getContext('2d');
        const typeCtx = document.getElementById('typeChart')?.getContext('2d');

        // Configuración común de tooltips y datalabels para porcentajes
        const datalabelsConfig = {
            color: '#fff',
            font: { weight: 'bold', size: 14 },
            formatter: (value, ctx) => {
                try {
                    let sum = 0;
                    let dataArr = ctx.chart.data.datasets[0].data;
                    dataArr.forEach(data => { sum += Number(data) || 0; });
                    if (sum === 0 || value === 0) return '';
                    let percentage = (Number(value) * 100 / sum).toFixed(0) + "%";
                    return percentage;
                } catch (e) {
                    return '';
                }
            }
        };

        const tooltipOptions = {
            callbacks: {
                label: function(context) {
                    const dataset = context.dataset;
                    const total = dataset.data.reduce((acc, val) => acc + val, 0);
                    const currentValue = dataset.data[context.dataIndex];
                    const percentage = total === 0 ? 0 : Math.round((currentValue / total) * 100);
                    return ` ${context.label}: ${currentValue} (${percentage}%)`;
                }
            }
        };

        if (statusCtx) {
            if (statusChart) {
                statusChart.data.datasets[0].data = [pubCount, pendCount, pausaCount, borrCount, vendCount];
                statusChart.update();
            } else {
                statusChart = new Chart(statusCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Publicadas', 'Pendientes', 'Pausa', 'Borrador', 'Vendido'],
                        datasets: [{
                            data: [pubCount, pendCount, pausaCount, borrCount, vendCount],
                            backgroundColor: ['#F68C18', '#64748b', '#dc2626', '#eab308', '#171717'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { font: { family: "'Google Sans', sans-serif" } } },
                            tooltip: tooltipOptions,
                            datalabels: datalabelsConfig
                        },
                        cutout: '70%'
                    }
                });
            }
        }

        if (operationCtx) {
            if (operationChart) {
                operationChart.data.datasets[0].data = [ventaCount, alquilerCount];
                operationChart.update();
            } else {
                operationChart = new Chart(operationCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Venta', 'Alquiler'],
                        datasets: [{
                            data: [ventaCount, alquilerCount],
                            backgroundColor: ['#171717', '#F68C18'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { font: { family: "'Google Sans', sans-serif" } } },
                            tooltip: tooltipOptions,
                            datalabels: datalabelsConfig
                        },
                        cutout: '70%'
                    }
                });
            }
        }

        if (typeCtx) {
            // Contar por tipo
            const typesCount = {};
            filteredProps.forEach(p => {
                const t = p.type || 'Otro';
                typesCount[t] = (typesCount[t] || 0) + 1;
            });
            const sortedTypes = Object.entries(typesCount).sort((a, b) => b[1] - a[1]);
            const labels = sortedTypes.map(([t]) => t);
            const data = sortedTypes.map(([, c]) => c);

            if (typeChart) {
                typeChart.data.labels = labels;
                typeChart.data.datasets[0].data = data;
                typeChart.update();
            } else {
                typeChart = new Chart(typeCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Cantidad',
                            data: data,
                            backgroundColor: labels.map((_, i) => ['#F68C18', '#171717', '#F59E0B', '#404040', '#fb923c', '#737373', '#fcd34d', '#a3a3a3'][i % 8]),
                            borderWidth: 0,
                            borderRadius: 6,
                            barPercentage: 0.6,
                            categoryPercentage: 0.8
                        }]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: tooltipOptions,
                            datalabels: {
                                color: '#171717',
                                anchor: 'end',
                                align: 'right',
                                font: { weight: 'bold', size: 13 },
                                formatter: (value) => value || ''
                            }
                        },
                        layout: {
                            padding: { right: 24 }
                        },
                        scales: {
                            x: {
                                beginAtZero: true,
                                grace: '10%',
                                ticks: { precision: 0 },
                                grid: { display: false }
                            },
                            y: {
                                grid: { display: false }
                            }
                        }
                    }
                });
            }
        }
    }
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
        status:          val('status'),
        price:           Number(val('price')) || 0,
        currency:        val('currency'),
        consultarPrecio: document.getElementById('consultar-precio')?.checked || false,
        type:            val('type'),
        operation:       val('operation').toLowerCase(),
        neighborhood:    val('neighborhood'),
        localidad:       val('localidad'),
        zone:            val('zone'),
        provincia:       val('provincia'),
        pais:            val('pais'),
        branch:          val('branch'),
        externalUrl:     val('external-url'),
        tag:             val('tag'),
        description:     val('description'),
        observaciones:   val('observaciones'),

        // Destacados
        surface:         numVal('surface'),
        supCubiertaDest: numVal('sup-cubierta-dest'),
        supVendibleDest: numVal('sup-vendible-dest'),
        bedrooms:        numVal('bedrooms'),
        dormitorios:     numVal('dormitorios'),
        bathrooms:       numVal('bathrooms'),
        toilette:        numVal('toilette'),
        antiguedad:      numVal('antiguedad'),
        garage:          numVal('garage'),
        orientacion:     val('orientacion'),
        pisos:           numVal('pisos'),
        estadoConservacion: val('estado-conservacion'),
        disposicionDest: val('disposicion-dest'),
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
        cantDormitorios:    numVal('cant-dormitorios'),
        detalleDormitorios: val('detalle-dormitorios'),
        cantBanos:          numVal('cant-banos'),
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
        expensas:         numVal('expensas'),
        noExpensas:       getRadioValue('no-expensas'),
        aysa:             getRadioValue('aysa'),
        aguaCorriente:    getRadioValue('agua-corriente'),
        electricidad:     getRadioValue('electricidad'),
        gasNatural:       getRadioValue('gas-natural'),
        calefaccion:      val('calefaccion'),
        aireAcondicionado:val('aire-acondicionado'),
        aguaCaliente:     val('agua-caliente'),
        tipoPiso:         val('tipo-piso'),
        ventilacion:      val('ventilacion'),
        todoDestino:      getRadioValue('todo-destino'),
        extras:           getCheckboxValues('extras'),

        // Edificio
        pisosEdificio:    numVal('pisos-edificio'),
        deptosPorPiso:    numVal('deptos-por-piso'),
        ascensor:         val('ascensor'),
        tipoEdilicio:     val('tipo-edilicio'),
        amenities:        getCheckboxValues('amenities'),

        // Comercial
        banosGenerales:   getRadioValue('banos-generales'),
        cantHabitaciones: numVal('cant-habitaciones'),
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
    setVal('external-url', p.externalUrl || '');
    if (document.getElementById('consultar-precio'))
        document.getElementById('consultar-precio').checked = !!p.consultarPrecio;
    populateFormSelects();
    ensureOptionExists(typeSelect, p.type);
    ensureOptionExists(citySelect, p.zone);
    ensureOptionExists(neighborhoodSelect, p.neighborhood);
    ensureOptionExists(document.getElementById('localidad'), p.localidad);
    ensureOptionExists(document.getElementById('provincia'), p.provincia);
    ensureOptionExists(document.getElementById('pais'), p.pais);
    ensureOptionExists(document.getElementById('operation'), p.operation);
    ensureOptionExists(document.getElementById('status'), p.status);
    ensureOptionExists(document.getElementById('currency'), p.currency);
    
    setVal('type', p.type); setVal('operation', p.operation);
    setVal('status', p.status); setVal('currency', p.currency || 'USD');
    setVal('neighborhood', p.neighborhood); setVal('zone', p.zone);
    setVal('localidad', p.localidad);
    setVal('provincia', p.provincia); setVal('pais', p.pais || 'Argentina');
    setVal('branch', p.branch);
    setVal('tag', p.tag);
    setVal('description', p.description); setVal('observaciones', p.observaciones);

    // Destacados
    setVal('surface', p.surface); setVal('sup-cubierta-dest', p.supCubiertaDest);
    setVal('sup-vendible-dest', p.supVendibleDest);
    setVal('bedrooms', p.bedrooms); setVal('dormitorios', p.dormitorios);
    setVal('bathrooms', p.bathrooms); setVal('toilette', p.toilette);
    setVal('antiguedad', p.antiguedad); setVal('garage', p.garage);
    setVal('orientacion', p.orientacion);
    setVal('pisos', p.pisos);
    setVal('estado-conservacion', p.estadoConservacion);
    setVal('disposicion-dest', p.disposicionDest);
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
    setRadioValue('agua-corriente', p.aguaCorriente); setRadioValue('electricidad', p.electricidad);
    setRadioValue('gas-natural', p.gasNatural);
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
// El módulo de galería de Cloudinary usa IDs internos fijos: solo puede haber un contenedor montado
// a la vez (propiedad o Blog), por eso se monta bajo demanda y se limpia el otro.
const GALLERY_CONTAINER_IDS = ['cld-gallery-container', 'blogpost-image-gallery'];

function mountGallery(containerId, options) {
    GALLERY_CONTAINER_IDS.filter(id => id !== containerId).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    initImageGallery(containerId, options);
}

function mountPropertyGallery() {
    mountGallery('cld-gallery-container');
}

function openNewPropertyModal() {
    editingId = null;
    modalTitle.textContent = 'Nueva Propiedad';
    propertyForm.reset();
    resetBooleans();
    populateFormSelects();
    mountPropertyGallery();
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
    mountPropertyGallery();
    fillForm(p);
    switchTab('tab-principal');
    propertyModal.style.display = 'flex';
};

window.handleDuplicateProperty = async id => {
    const p = properties.find(x => x.id === id);
    if (!p) return;
    const { id: _id, createdAt, updatedAt, ...rest } = p;
    const data = { ...rest, code: '', title: `${p.title} (duplicado)`, status: 'borrador' };
    try {
        await createProperty(data);
        showToast('Propiedad duplicada como borrador.', 'success');
        refreshProperties();
    } catch (e) { showToast('Error al duplicar: ' + e.message, 'error'); }
};

// Arma la ficha imprimible de la propiedad y dispara el diálogo de impresión
// del navegador (el usuario elige "Guardar como PDF" ahí — sin librerías extra).
window.printPropertySheet = id => {
    const p = properties.find(x => x.id === id);
    if (!p) return;

    const price = p.consultarPrecio ? 'Consultar precio' : `${p.currency || 'USD'} ${(p.price || 0).toLocaleString('es-AR')}`;
    const ubicacion = [p.neighborhood, p.zone].filter(Boolean).join(', ');
    const images = p.images || [];
    const cover = images[0] || '';
    const gallery = images.slice(1);

    const facts = [
        ['Operación', capitalize(p.operation)],
        ['Estado', capitalize(p.status)],
        ['Tipo', p.type],
        ['Ubicación', ubicacion],
        ['Superficie', p.surface != null ? `${p.surface} m²` : ''],
        ['M² cubiertos', p.supCubiertaDest != null ? `${p.supCubiertaDest} m²` : ''],
        ['M² vendibles', p.supVendibleDest != null ? `${p.supVendibleDest} m²` : ''],
        ['Ambientes', p.bedrooms],
        ['Dormitorios', p.dormitorios ?? p.bedrooms],
        ['Baños', p.bathrooms ?? p.cantBanos],
        ['Toilette', p.toilette],
        ['Antigüedad', p.antiguedad != null ? `${p.antiguedad} años` : ''],
        ['Cocheras', p.garage],
        ['Piso', p.pisos],
        ['Orientación', p.orientacion],
        ['Disposición', p.disposicionDest],
        ['Estado de conservación', p.estadoConservacion],
        ['Luminoso', p.luminoso === 'si' ? 'Sí' : p.luminoso === 'no' ? 'No' : ''],
        ['Agua corriente', p.aguaCorriente === 'si' ? 'Sí' : p.aguaCorriente === 'no' ? 'No' : ''],
        ['Electricidad', p.electricidad === 'si' ? 'Sí' : p.electricidad === 'no' ? 'No' : ''],
        ['Gas natural', p.gasNatural === 'si' ? 'Sí' : p.gasNatural === 'no' ? 'No' : ''],
    ].filter(([, v]) => v != null && v !== '');

    document.getElementById('print-sheet').innerHTML = `
        <div class="print-header">
            <img src="https://umen.com.ar/wp-content/uploads/2021/02/UMEN-logo.png" alt="UMEN">
            <div class="print-header-code">Cód. ${p.code || id.slice(0, 6)}</div>
        </div>
        ${cover ? `<img class="print-cover" src="${cover}" alt="">` : ''}
        <h1>${p.title || 'Propiedad'}</h1>
        <div class="print-price">${price}</div>
        <div class="print-facts">
            ${facts.map(([label, value]) => `
                <div class="print-fact"><span>${label}</span><strong>${value}</strong></div>
            `).join('')}
        </div>
        ${p.description ? `<div class="print-section"><h2>Descripción</h2><p>${p.description}</p></div>` : ''}
        ${gallery.length ? `
            <div class="print-section"><h2>Fotos</h2>
                <div class="print-gallery">
                    ${gallery.map(url => `<img src="${url}" alt="">`).join('')}
                </div>
            </div>
        ` : ''}
        <div class="print-footer">${p.branch || 'UMEN Real Estate'} — Ficha generada el ${new Date().toLocaleDateString('es-AR')}</div>
    `;

    // Espera a que todas las imágenes terminen de cargar antes de imprimir,
    // si no algunas quedan en blanco en el PDF (el navegador imprime antes de que lleguen).
    const imgs = Array.from(document.querySelectorAll('#print-sheet img'));
    const pending = imgs.filter(img => !img.complete);
    if (!pending.length) { window.print(); return; }
    let remaining = pending.length;
    const done = () => { remaining--; if (remaining <= 0) window.print(); };
    pending.forEach(img => { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); });
};

window.handleDeleteProperty = async id => {
    const ok = await confirmDialog('Esta acción no se puede deshacer.', { title: '¿Eliminar esta propiedad?', acceptLabel: 'Eliminar' });
    if (!ok) return;
    try {
        await deleteProperty(id);
        showToast('Propiedad eliminada.', 'success');
        refreshProperties();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
};

// Guarda lo cargado hasta el momento como borrador, sin exigir los campos obligatorios del form.
async function handleSaveDraft() {
    try {
        const data = readFormData();
        if (!data.title.trim()) { showToast('Ingresá al menos un título para guardar el borrador.', 'error'); return; }
        data.status = 'borrador';
        if (!data.distribucion?.length) delete data.distribucion;
        if (!data.extras?.length) delete data.extras;
        if (!data.amenities?.length) delete data.amenities;
        if (editingId) {
            await updateProperty(editingId, data);
        } else {
            await createProperty(data);
        }
        showToast('Borrador guardado.', 'success');
        closeModal();
        refreshProperties();
    } catch (e) { showToast('Error al guardar el borrador: ' + e.message, 'error'); }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    try {
        const data = readFormData();
        // Remove empty arrays
        if (!data.distribucion?.length) delete data.distribucion;
        if (!data.extras?.length) delete data.extras;
        if (!data.amenities?.length) delete data.amenities;
        if (editingId) {
            await updateProperty(editingId, data);
            showToast('Propiedad actualizada con éxito.', 'success');
        } else {
            await createProperty(data);
            showToast('Propiedad creada con éxito.', 'success');
        }
        closeModal();
        refreshProperties();
    } catch (e) { showToast('Error al guardar: ' + e.message, 'error'); }
}

// Convierte el título en un slug para la URL pública (hoteles/<slug>)
function slugify(text) {
    return text
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ── Blog ─────────────────────────────────────────────────────────────────────
let blogPosts = [];
let editingBlogPostId = null;
let blogPostsLoaded = false;

const blogPostFormWrap = document.getElementById('blogpost-form-wrap');
const blogPostForm     = document.getElementById('blogpost-form');
const blogPostsTbody   = document.getElementById('blogposts-table-body');

async function loadBlogPosts() {
    if (blogPostsLoaded) return;
    blogPostsLoaded = true;
    blogPosts = await getBlogPosts();
    renderBlogPostsTable();
}

// Palabras leídas + puntaje SEO simple: título 30-60 caracteres, meta descripción
// 70-160, resumen cargado, imagen de portada y al menos 300 palabras. Se usa tanto
// en la barra en vivo del formulario como en la columna SEO del listado.
function scoreBlogPost({ title = '', seoTitle = '', excerpt = '', seoDescription = '', body = '', hasImage = false }) {
    const effectiveTitle = seoTitle || title;
    const effectiveDescription = seoDescription || excerpt;
    const bodyText = body.replace(/<[^>]+>/g, ' ').trim();
    const words = bodyText ? bodyText.split(/\s+/).length : 0;
    const readMin = Math.max(1, Math.round(words / 200));

    const checks = [
        effectiveTitle.length >= 30 && effectiveTitle.length <= 60,
        effectiveDescription.length >= 70 && effectiveDescription.length <= 160,
        !!excerpt,
        hasImage,
        words >= 300
    ];
    const passed = checks.filter(Boolean).length;
    const level = passed >= 4 ? 'ok' : passed >= 2 ? 'warn' : 'bad';
    const label = passed >= 4 ? 'Bueno' : passed >= 2 ? 'Regular' : 'Débil';
    return { words, readMin, passed, level, label };
}

function renderBlogPostsTable() {
    if (!blogPostsTbody) return;
    if (blogPosts.length === 0) {
        blogPostsTbody.innerHTML = '<tr><td colspan="5" class="adm-table-empty">Todavía no hay notas cargadas.</td></tr>';
        return;
    }
    blogPostsTbody.innerHTML = blogPosts.map(p => {
        const score = scoreBlogPost({
            title: p.title || '', seoTitle: p.seoTitle || '', excerpt: p.excerpt || '',
            seoDescription: p.seoDescription || '', body: p.body || '', hasImage: !!p.image
        });
        return `
        <tr>
            <td>${p.title || ''}</td>
            <td>
                <span class="adm-blog-stat" title="${score.readMin} min de lectura">
                    <i class="fas fa-align-left"></i> ${score.words}
                </span>
            </td>
            <td>
                <span class="adm-blog-stat ${score.level}" title="${score.words} palabras · ${score.readMin} min de lectura">
                    <i class="fas fa-bullseye"></i> ${score.label} (${score.passed}/5)
                </span>
            </td>
            <td>${p.category || ''}</td>
            <td>
                <button type="button" class="adm-btn adm-btn-icon" onclick="editBlogPost('${p.id}')" title="Editar"><i class="fas fa-pen"></i></button>
                <button type="button" class="adm-btn adm-btn-icon" onclick="deleteBlogPostHandler('${p.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `;
    }).join('');
}

function openBlogPostForm(post = null) {
    editingBlogPostId = post?.id || null;
    blogPostForm.reset();
    document.getElementById('bp-title').value           = post?.title || '';
    document.getElementById('bp-category').value        = post?.category || '';
    document.getElementById('bp-excerpt').value          = post?.excerpt || '';
    document.getElementById('bp-body-editable').innerHTML = post?.body || '';
    document.getElementById('bp-author-name').value      = post?.authorName || '';
    document.getElementById('bp-author-role').value      = post?.authorRole || '';
    document.getElementById('bp-seo-title').value        = post?.seoTitle || '';
    document.getElementById('bp-seo-description').value  = post?.seoDescription || '';
    mountGallery('blogpost-image-gallery', { onChange: updateBlogStats });
    setGalleryUrls(post?.image ? [post.image] : []);
    blogPostFormWrap.style.display = 'block';
    updateBlogStats();
}

// ── Barra de estadísticas (palabras, lectura, SEO) ──────────────────────────────
function updateBlogStats() {
    const bar = document.getElementById('bp-stats-bar');
    if (!bar) return;

    const score = scoreBlogPost({
        title: document.getElementById('bp-title').value.trim(),
        seoTitle: document.getElementById('bp-seo-title').value.trim(),
        excerpt: document.getElementById('bp-excerpt').value.trim(),
        seoDescription: document.getElementById('bp-seo-description').value.trim(),
        body: document.getElementById('bp-body-editable').textContent || '',
        hasImage: getGalleryUrls().length > 0
    });

    bar.innerHTML = `
        <span class="adm-blog-stat"><i class="fas fa-align-left"></i> ${score.words} palabras</span>
        <span class="adm-blog-stat"><i class="fas fa-clock"></i> ${score.readMin} min de lectura</span>
        <span class="adm-blog-stat ${score.level}" title="Título 30-60 caracteres, meta descripción 70-160, resumen, imagen de portada y al menos 300 palabras">
            <i class="fas fa-bullseye"></i> SEO: ${score.label} (${score.passed}/5)
        </span>
    `;
}

['bp-title', 'bp-excerpt', 'bp-seo-title', 'bp-seo-description'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateBlogStats);
});
document.getElementById('bp-body-editable')?.addEventListener('input', updateBlogStats);

// ── Editor de texto enriquecido (barra de herramientas del contenido del blog) ──
const bpBodyEditable = document.getElementById('bp-body-editable');
document.querySelectorAll('.adm-rte-toolbar [data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
        bpBodyEditable.focus();
        document.execCommand(btn.dataset.cmd, false, btn.dataset.value || undefined);
    });
});
document.getElementById('bp-rte-link')?.addEventListener('click', () => {
    const url = prompt('URL del link:');
    if (url) { bpBodyEditable.focus(); document.execCommand('createLink', false, url); }
});
document.getElementById('bp-rte-image')?.addEventListener('click', () => {
    document.getElementById('bp-rte-image-input')?.click();
});
document.getElementById('bp-rte-image-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
        showToast('Subiendo imagen…');
        const result = await uploadFile(file);
        bpBodyEditable.focus();
        document.execCommand('insertImage', false, result.secure_url);
        showToast('Imagen insertada.', 'success');
    } catch (err) {
        showToast('Error al subir la imagen: ' + err.message, 'error');
    }
});

function closeBlogPostForm() {
    blogPostFormWrap.style.display = 'none';
    editingBlogPostId = null;
}

async function handleBlogPostSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('bp-title').value.trim();
    const data = {
        title,
        slug:            slugify(title),
        category:        document.getElementById('bp-category').value.trim(),
        excerpt:         document.getElementById('bp-excerpt').value.trim(),
        body:            document.getElementById('bp-body-editable').innerHTML.trim(),
        authorName:      document.getElementById('bp-author-name').value.trim(),
        authorRole:      document.getElementById('bp-author-role').value.trim(),
        seoTitle:        document.getElementById('bp-seo-title').value.trim(),
        seoDescription:  document.getElementById('bp-seo-description').value.trim(),
        image:           getGalleryUrls()[0] || ''
    };
    try {
        if (editingBlogPostId) {
            await updateBlogPost(editingBlogPostId, data);
            showToast('Nota actualizada con éxito.', 'success');
        } else {
            await createBlogPost(data);
            showToast('Nota creada con éxito.', 'success');
        }
        closeBlogPostForm();
        blogPostsLoaded = false;
        await loadBlogPosts();
    } catch (e) { showToast('Error al guardar la nota: ' + e.message, 'error'); }
}

window.editBlogPost = id => {
    const post = blogPosts.find(p => p.id === id);
    if (post) openBlogPostForm(post);
};

window.deleteBlogPostHandler = async id => {
    const post = blogPosts.find(p => p.id === id);
    if (!post) return;
    if (!await confirmDialog(`¿Eliminar "${post.title}"?`, { acceptLabel: 'Eliminar' })) return;
    try {
        await deleteBlogPost(id);
        blogPostsLoaded = false;
        await loadBlogPosts();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
};

document.addEventListener('adm:enter-blog', loadBlogPosts);
document.getElementById('new-blogpost-btn')?.addEventListener('click', () => openBlogPostForm());
document.getElementById('cancel-blogpost-btn')?.addEventListener('click', closeBlogPostForm);
document.getElementById('back-blogpost-btn')?.addEventListener('click', closeBlogPostForm);
blogPostForm?.addEventListener('submit', handleBlogPostSubmit);
