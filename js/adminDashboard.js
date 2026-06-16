// adminDashboard.js - Lógica unificada para el panel de administración
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import {
    getProperties,
    createProperty,
    updateProperty,
    deleteProperty,
    getProperty,
    ensureDefaultTaxonomy,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCities,
    createCity,
    updateCity,
    deleteCity,
    getAllNeighborhoods,
    createNeighborhood,
    updateNeighborhood,
    deleteNeighborhood
} from './propertyService.js';

// Elementos DOM
const logoutBtn = document.getElementById('logout-btn');
const propertiesTbody = document.getElementById('properties-tbody');
const totalPropertiesEl = document.getElementById('total-properties');
const totalVentaEl = document.getElementById('total-venta');
const totalAlquilerEl = document.getElementById('total-alquiler');
const propertyModal = document.getElementById('property-modal');
const propertyForm = document.getElementById('property-form');
const newPropertyBtn = document.getElementById('new-property-btn');
const modalTitle = document.getElementById('modal-title');
const closeButtons = document.querySelectorAll('.close-modal');
const typeSelect = document.getElementById('type');
const citySelect = document.getElementById('zone');
const neighborhoodSelect = document.getElementById('neighborhood');
const filterTypeSelect = document.getElementById('filter-type');

// Estado
let properties = [];
let editingId = null;
let categories = [];
let cities = [];
let neighborhoods = [];

// Config genérica de las 3 taxonomías (tipo / ciudad / barrio)
const TAXO_CONFIG = {
    category: {
        getList: () => categories,
        setList: (list) => { categories = list; },
        fetch: getCategories,
        create: createCategory,
        update: updateCategory,
        delete: deleteCategory,
        listEl: 'category-list',
        inputEl: 'new-category-input',
        addBtnEl: 'add-category-btn'
    },
    city: {
        getList: () => cities,
        setList: (list) => { cities = list; },
        fetch: getCities,
        create: createCity,
        update: updateCity,
        delete: deleteCity,
        listEl: 'city-list',
        inputEl: 'new-city-input',
        addBtnEl: 'add-city-btn'
    },
    neighborhood: {
        getList: () => neighborhoods,
        setList: (list) => { neighborhoods = list; },
        fetch: getAllNeighborhoods,
        create: createNeighborhood,
        update: updateNeighborhood,
        delete: deleteNeighborhood,
        listEl: 'neighborhood-list',
        inputEl: 'new-neighborhood-input',
        addBtnEl: 'add-neighborhood-btn'
    }
};

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(window.auth, (user) => {
        if (!user) {
            window.location.href = 'admin-login.html';
        } else {
            loadAdminData();
        }
    });

    setupEventListeners();
});

function setupEventListeners() {
    logoutBtn.addEventListener('click', handleLogout);
    newPropertyBtn.addEventListener('click', openNewPropertyModal);
    propertyForm.addEventListener('submit', handleFormSubmit);
    closeButtons.forEach(btn => btn.addEventListener('click', closeModal));

    Object.entries(TAXO_CONFIG).forEach(([taxoType, cfg]) => {
        const input = document.getElementById(cfg.inputEl);
        const addBtn = document.getElementById(cfg.addBtnEl);
        const submit = () => handleTaxoAdd(taxoType);
        addBtn?.addEventListener('click', submit);
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submit();
            }
        });
    });

    document.querySelectorAll('.adm-quick-add').forEach(btn => {
        btn.addEventListener('click', () => handleQuickAdd(btn.dataset.taxo));
    });
}

async function handleLogout() {
    try {
        await signOut(window.auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

async function loadAdminData() {
    console.log('Cargando datos del panel...');

    const loaderTimeout = setTimeout(() => {
        if (propertiesTbody.innerHTML.includes('Cargando')) {
            propertiesTbody.innerHTML = '<tr><td colspan="8" class="adm-table-empty">La carga está demorando. Por favor, verifica tu conexión o las reglas de Firebase.</td></tr>';
        }
    }, 6000);

    try {
        await ensureDefaultTaxonomy();
        await loadAllTaxonomies();

        properties = await getProperties();
        clearTimeout(loaderTimeout);
        console.log('Propiedades cargadas:', properties.length);
        renderAdminTable();
        updateStats();
    } catch (error) {
        clearTimeout(loaderTimeout);
        console.error('Error al cargar datos de administración:', error);
        propertiesTbody.innerHTML = '<tr><td colspan="8" class="adm-table-empty" style="color: red;">Error al conectar con la base de datos.</td></tr>';
    }
}

// ── Taxonomía: tipos de propiedad / ciudades / barrios ──────────────────────

async function loadAllTaxonomies() {
    for (const [taxoType, cfg] of Object.entries(TAXO_CONFIG)) {
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
    }
    populateFormSelects();
    populateFilterTypeSelect();
}

function renderTaxoList(taxoType) {
    const cfg = TAXO_CONFIG[taxoType];
    const container = document.getElementById(cfg.listEl);
    if (!container) return;

    const list = cfg.getList();
    if (list.length === 0) {
        container.innerHTML = '<span class="adm-taxo-empty">Sin opciones todavía. Agregá la primera arriba.</span>';
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
    const cfg = TAXO_CONFIG[taxoType];
    const input = document.getElementById(cfg.inputEl);
    const name = input.value.trim();
    if (!name) return;

    if (cfg.getList().some(item => item.name.toLowerCase() === name.toLowerCase())) {
        alert('Esa opción ya existe.');
        return;
    }

    try {
        await cfg.create({ name });
        input.value = '';
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
        populateFormSelects();
        if (taxoType === 'category') populateFilterTypeSelect();
    } catch (error) {
        alert('Error al agregar: ' + error.message);
    }
}

function handleTaxoEdit(taxoType, id, chipEl) {
    const cfg = TAXO_CONFIG[taxoType];
    const item = cfg.getList().find(i => i.id === id);
    if (!item) return;

    const labelEl = chipEl.querySelector('.adm-taxo-chip-label');
    const currentName = item.name;
    labelEl.outerHTML = `<input type="text" class="adm-taxo-rename" value="${currentName}">`;
    const input = chipEl.querySelector('.adm-taxo-rename');
    input.focus();
    input.select();

    const save = async () => {
        const newName = input.value.trim();
        if (!newName || newName === currentName) {
            renderTaxoList(taxoType);
            return;
        }
        try {
            await cfg.update(id, { name: newName });
            cfg.setList(await cfg.fetch());
            renderTaxoList(taxoType);
            populateFormSelects();
            if (taxoType === 'category') populateFilterTypeSelect();
        } catch (error) {
            alert('Error al renombrar: ' + error.message);
            renderTaxoList(taxoType);
        }
    };

    input.addEventListener('blur', save);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
}

async function handleTaxoDelete(taxoType, id) {
    const cfg = TAXO_CONFIG[taxoType];
    const item = cfg.getList().find(i => i.id === id);
    if (!item) return;
    if (!confirm(`¿Eliminar "${item.name}"? Las propiedades que ya la usan no se modifican.`)) return;

    try {
        await cfg.delete(id);
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
        populateFormSelects();
        if (taxoType === 'category') populateFilterTypeSelect();
    } catch (error) {
        alert('Error al eliminar: ' + error.message);
    }
}

// Botón "+" junto a los selects del formulario de propiedad
async function handleQuickAdd(taxoType) {
    const cfg = TAXO_CONFIG[taxoType];
    const label = { category: 'tipo de propiedad', city: 'ciudad', neighborhood: 'barrio' }[taxoType];
    const name = prompt(`Nuevo ${label}:`);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();

    try {
        await cfg.create({ name: trimmed });
        cfg.setList(await cfg.fetch());
        renderTaxoList(taxoType);
        populateFormSelects();
        if (taxoType === 'category') populateFilterTypeSelect();

        const selectEl = { category: typeSelect, city: citySelect, neighborhood: neighborhoodSelect }[taxoType];
        if (selectEl) selectEl.value = trimmed;
    } catch (error) {
        alert('Error al agregar: ' + error.message);
    }
}

// Puebla los <select> del formulario de propiedad (tipo / ciudad / barrio)
function populateFormSelects() {
    fillSelect(typeSelect, categories);
    fillSelect(citySelect, cities, 'Seleccionar ciudad');
    fillSelect(neighborhoodSelect, neighborhoods, 'Seleccionar barrio');
}

function fillSelect(select, items, placeholder) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : '')
        + items.map(item => `<option value="${item.name}">${item.name}</option>`).join('');
    if (current) ensureOptionExists(select, current);
}

// Si la propiedad guardada usa un valor que ya no está en la lista (p.ej. datos de demo viejos),
// lo agregamos como opción temporal para no perder el dato al editar.
function ensureOptionExists(select, value) {
    if (!value) return;
    const exists = Array.from(select.options).some(o => o.value === value);
    if (!exists) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
    }
    select.value = value;
}

function populateFilterTypeSelect() {
    if (!filterTypeSelect) return;
    const current = filterTypeSelect.value;
    filterTypeSelect.innerHTML = '<option value="">Tipo</option>'
        + categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    filterTypeSelect.value = current;
}

function renderAdminTable() {
    if (properties.length === 0) {
        propertiesTbody.innerHTML = '<tr><td colspan="8" class="adm-table-empty">No hay propiedades cargadas.</td></tr>';
        return;
    }

    propertiesTbody.innerHTML = properties.map(prop => `
        <tr>
            <td>${prop.id.slice(0, 6)}</td>
            <td>
                <strong>${prop.title}</strong>
                <span>${prop.type || ''}</span>
            </td>
            <td>
                <span class="badge ${prop.operation}">${(prop.operation || '').toUpperCase()}</span>
            </td>
            <td>${prop.status || '—'}</td>
            <td>${prop.currency} ${(prop.price || 0).toLocaleString()}</td>
            <td>${[prop.neighborhood, prop.zone].filter(Boolean).join(', ')}</td>
            <td>${formatDate(prop.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editProperty('${prop.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="handleDeleteProperty('${prop.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function formatDate(value) {
    if (!value) return '—';
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-AR');
}

function updateStats() {
    totalPropertiesEl.textContent = properties.length;
    if (totalAlquilerEl) totalAlquilerEl.textContent = properties.filter(p => p.operation === 'alquiler').length;
    if (totalVentaEl) totalVentaEl.textContent = properties.filter(p => p.operation === 'venta').length;
    const publicadasEl = document.getElementById('total-publicadas');
    const vendidasEl = document.getElementById('total-vendidas');
    if (publicadasEl) publicadasEl.textContent = properties.filter(p => p.status === 'publicado').length;
    if (vendidasEl) vendidasEl.textContent = properties.filter(p => p.status === 'vendido').length;
}

// Global functions for actions (exposed to window for onclick)
// ── Gestión de múltiples imágenes ────────────────────────────────────────────

function addImageRow(url = '') {
    const list = document.getElementById('image-url-list');
    const row = document.createElement('div');
    row.className = 'image-row';
    row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label class="image-row-label"
                   style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#555;margin:0"></label>
            <button type="button" class="remove-img-btn"
                    style="font-size:0.75rem;font-weight:600;color:#dc2626;background:none;border:none;cursor:pointer;padding:0"
                    onclick="removeImageRow(this)">Quitar</button>
        </div>
        <input type="text" class="image-url-input" value="${url}" placeholder="https://..."
               style="width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:0.9rem;outline:none;box-sizing:border-box">
    `;
    list.appendChild(row);
    renumberImages();
}

window.removeImageRow = function(btn) {
    btn.closest('.image-row').remove();
    renumberImages();
};

function renumberImages() {
    const rows = document.querySelectorAll('#image-url-list .image-row');
    rows.forEach((row, i) => {
        const lbl = row.querySelector('.image-row-label');
        const removeBtn = row.querySelector('.remove-img-btn');
        if (lbl) lbl.textContent = i === 0 ? 'Imagen principal' : `Imagen ${i + 1}`;
        if (removeBtn) removeBtn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    });
}

function setImageUrls(urls) {
    const list = document.getElementById('image-url-list');
    if (!list) return;
    list.innerHTML = '';
    const items = urls.length > 0 ? urls : [''];
    items.forEach(url => addImageRow(url));
}

function getImageUrls() {
    return Array.from(document.querySelectorAll('.image-url-input'))
        .map(i => i.value.trim())
        .filter(u => u.length > 0);
}

document.getElementById('add-image-btn')?.addEventListener('click', () => addImageRow(''));

// ── Funciones globales ────────────────────────────────────────────────────────
window.editProperty = async (id) => {
    editingId = id;
    const property = properties.find(p => p.id === id);
    if (!property) return;

    modalTitle.textContent = 'Editar Propiedad';
    document.getElementById('title').value = property.title;
    document.getElementById('price').value = property.price;
    document.getElementById('currency').value = property.currency || 'USD';
    const statusRadio = propertyForm.querySelector(`input[name="status"][value="${property.status || 'pendiente'}"]`);
    if (statusRadio) statusRadio.checked = true;
    populateFormSelects();
    ensureOptionExists(typeSelect, property.type);
    ensureOptionExists(citySelect, property.zone);
    ensureOptionExists(neighborhoodSelect, property.neighborhood);
    document.getElementById('operation').value = property.operation;
    document.getElementById('surface').value = property.surface;
    document.getElementById('bedrooms').value = property.bedrooms;
    document.getElementById('description').value = property.description || '';
    setImageUrls(property.images || []);

    propertyModal.style.display = 'flex';
};

window.handleDeleteProperty = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta propiedad? Esta acción no se puede deshacer.')) return;

    try {
        await deleteProperty(id);
        alert('Propiedad eliminada correctamente.');
        loadAdminData();
    } catch (error) {
        alert('Error al eliminar: ' + error.message);
    }
};

function openNewPropertyModal() {
    editingId = null;
    modalTitle.textContent = 'Nueva Propiedad';
    propertyForm.reset();
    populateFormSelects();
    setImageUrls([]);
    propertyModal.style.display = 'flex';
}

function closeModal() {
    propertyModal.style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const propertyData = {
        title: document.getElementById('title').value,
        status: propertyForm.querySelector('input[name="status"]:checked')?.value || 'pendiente',
        price: Number(document.getElementById('price').value),
        currency: document.getElementById('currency').value,
        type: document.getElementById('type').value,
        operation: document.getElementById('operation').value,
        neighborhood: document.getElementById('neighborhood').value,
        zone: document.getElementById('zone').value,
        surface: Number(document.getElementById('surface').value),
        bedrooms: Number(document.getElementById('bedrooms').value),
        description: document.getElementById('description').value,
        images: getImageUrls()
    };

    try {
        if (editingId) {
            await updateProperty(editingId, propertyData);
            alert('Propiedad actualizada con éxito.');
        } else {
            await createProperty(propertyData);
            alert('Propiedad creada con éxito.');
        }
        closeModal();
        loadAdminData();
    } catch (error) {
        alert('Error al guardar: ' + error.message);
    }
}
