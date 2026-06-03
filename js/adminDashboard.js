// adminDashboard.js - Lógica unificada para el panel de administración
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { 
    getProperties, 
    createProperty, 
    updateProperty, 
    deleteProperty, 
    getProperty 
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

// Estado
let properties = [];
let editingId = null;

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
            propertiesTbody.innerHTML = '<tr><td colspan="5" class="text-center">La carga está demorando. Por favor, verifica tu conexión o las reglas de Firebase.</td></tr>';
        }
    }, 6000);

    try {
        properties = await getProperties();
        clearTimeout(loaderTimeout);
        console.log('Propiedades cargadas:', properties.length);
        renderAdminTable();
        updateStats();
    } catch (error) {
        clearTimeout(loaderTimeout);
        console.error('Error al cargar datos de administración:', error);
        propertiesTbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: red;">Error al conectar con la base de datos.</td></tr>';
    }
}

function renderAdminTable() {
    if (properties.length === 0) {
        propertiesTbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay propiedades cargadas.</td></tr>';
        return;
    }

    propertiesTbody.innerHTML = properties.map(prop => `
        <tr>
            <td>
                <strong>${prop.title}</strong>
                <span>${prop.type}</span>
            </td>
            <td>
                <span class="badge ${prop.operation}">${prop.operation.toUpperCase()}</span>
            </td>
            <td>${prop.currency} ${prop.price.toLocaleString()}</td>
            <td>${prop.neighborhood}, ${prop.zone}</td>
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

function updateStats() {
    totalPropertiesEl.textContent = properties.length;
    totalVentaEl.textContent = properties.filter(p => p.operation === 'venta').length;
    totalAlquilerEl.textContent = properties.filter(p => p.operation === 'alquiler').length;
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
    document.getElementById('type').value = property.type;
    document.getElementById('operation').value = property.operation;
    document.getElementById('neighborhood').value = property.neighborhood;
    document.getElementById('zone').value = property.zone;
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