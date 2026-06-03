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
    row.style.cssText = 'display:flex;gap:8px;align-items:center';
    row.innerHTML = `
        <input type="text" class="image-url-input" value="${url}"
               placeholder="https://..."
               style="flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-family:inherit;font-size:0.9rem;outline:none">
        <button type="button"
                style="flex-shrink:0;width:34px;height:34px;border:none;background:#fee2e2;color:#dc2626;border-radius:6px;cursor:pointer;font-size:1.1rem;line-height:1"
                onclick="this.parentElement.remove()">×</button>
    `;
    list.appendChild(row);
}

function setImageUrls(urls) {
    const list = document.getElementById('image-url-list');
    if (!list) return;
    list.innerHTML = '';
    if (urls.length === 0) {
        addImageRow('');
    } else {
        urls.forEach(url => addImageRow(url));
    }
}

function getImageUrls() {
    return Array.from(document.querySelectorAll('.image-url-input'))
        .map(input => input.value.trim())
        .filter(url => url.length > 0);
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