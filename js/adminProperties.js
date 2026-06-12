// adminProperties.js - Lógica para gestionar propiedades en admin

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getProperties, deleteProperty, getCategories, getFeatures, getProvinces, getZones, getNeighborhoods, createProperty, updateProperty, uploadImage } from './propertyService.js';

const propertiesList = document.getElementById('properties-list');
const newPropertyBtn = document.getElementById('new-property-btn');

let properties = [];
let categories = [];
let features = [];
let provinces = [];

// Verificar autenticación
onAuthStateChanged(window.auth, async (user) => {
    if (!user) {
        window.location.href = 'admin-login.html';
    } else {
        await loadData();
        await loadProperties();
        renderProperties();
    }
});

// Cargar datos
async function loadData() {
    categories = await getCategories();
    features = await getFeatures();
    provinces = await getProvinces();
}

// Cargar propiedades
async function loadProperties() {
    properties = await getProperties();
}

// Renderizar propiedades
function renderProperties() {
    propertiesList.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Título</th>
                    <th>Precio</th>
                    <th>Tipo</th>
                    <th>Operación</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${properties.map(property => `
                    <tr>
                        <td>${property.title}</td>
                        <td>$${property.price.toLocaleString()}</td>
                        <td>${getCategoryName(property.type)}</td>
                        <td>${property.operation}</td>
                        <td>
                            <button onclick="editProperty('${property.id}')">Editar</button>
                            <button onclick="deletePropertyHandler('${property.id}')">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getCategoryName(id) {
    const category = categories.find(c => c.id === id);
    return category ? category.name : 'Desconocido';
}

// Nueva propiedad
newPropertyBtn.addEventListener('click', () => {
    showPropertyForm();
});

// Editar propiedad
function editProperty(id) {
    const property = properties.find(p => p.id === id);
    if (property) {
        showPropertyForm(property);
    }
}

// Mostrar formulario
function showPropertyForm(property = null) {
    const formHtml = `
        <div class="modal">
            <div class="modal-content">
                <h2>${property ? 'Editar' : 'Nueva'} Propiedad</h2>
                <form id="property-form">
                    <label>Título: <input type="text" name="title" value="${property?.title || ''}" required></label>
                    <label>Precio: <input type="number" name="price" value="${property?.price || ''}" required></label>
                    <label>Tipo: 
                        <select name="type" required>
                            <option value="">Seleccionar</option>
                            ${categories.map(cat => `<option value="${cat.id}" ${property?.type === cat.id ? 'selected' : ''}>${cat.name}</option>`).join('')}
                        </select>
                    </label>
                    <label>Operación: 
                        <select name="operation" required>
                            <option value="venta" ${property?.operation === 'venta' ? 'selected' : ''}>Venta</option>
                            <option value="alquiler" ${property?.operation === 'alquiler' ? 'selected' : ''}>Alquiler</option>
                        </select>
                    </label>
                    <label>Provincia: 
                        <select name="province" required onchange="loadZones(this.value)">
                            <option value="">Seleccionar</option>
                            ${provinces.map(prov => `<option value="${prov.id}" ${property?.province === prov.id ? 'selected' : ''}>${prov.name}</option>`).join('')}
                        </select>
                    </label>
                    <label>Zona: <select name="zone" required><option value="${property?.zone || ''}">${property?.zone || 'Seleccionar'}</option></select></label>
                    <label>Barrio: <input type="text" name="neighborhood" value="${property?.neighborhood || ''}" required></label>
                    <label>Superficie: <input type="number" name="surface" value="${property?.surface || ''}"></label>
                    <label>Habitaciones: <input type="number" name="bedrooms" value="${property?.bedrooms || ''}"></label>
                    <label>Baños: <input type="number" name="bathrooms" value="${property?.bathrooms || ''}"></label>
                    <label>Garage: <input type="number" name="garage" value="${property?.garage || ''}"></label>
                    <label>Año: <input type="number" name="year" value="${property?.year || ''}"></label>
                    <label>Estado: <input type="text" name="condition" value="${property?.condition || ''}"></label>
                    <label>Descripción: <textarea name="description">${property?.description || ''}</textarea></label>
                    <label>Características: 
                        <select name="features" multiple>
                            ${features.map(feat => `<option value="${feat.name}" ${property?.features?.includes(feat.name) ? 'selected' : ''}>${feat.name}</option>`).join('')}
                        </select>
                    </label>
                    <label>Imágenes: <input type="file" name="images" multiple accept="image/*"></label>
                    <button type="submit">${property ? 'Actualizar' : 'Crear'}</button>
                    <button type="button" onclick="closeModal()">Cancelar</button>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', formHtml);
    document.getElementById('property-form').addEventListener('submit', (e) => handlePropertySubmit(e, property?.id));
}

// Manejar submit
async function handlePropertySubmit(e, id) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const propertyData = {
        title: formData.get('title'),
        price: parseInt(formData.get('price')),
        type: formData.get('type'),
        operation: formData.get('operation'),
        province: formData.get('province'),
        zone: formData.get('zone'),
        neighborhood: formData.get('neighborhood'),
        surface: parseInt(formData.get('surface')) || 0,
        bedrooms: parseInt(formData.get('bedrooms')) || 0,
        bathrooms: parseInt(formData.get('bathrooms')) || 0,
        garage: parseInt(formData.get('garage')) || 0,
        year: parseInt(formData.get('year')) || 0,
        condition: formData.get('condition'),
        description: formData.get('description'),
        features: Array.from(formData.getAll('features'))
    };

    // Handle images
    const imageFiles = formData.getAll('images');
    if (imageFiles.length > 0) {
        propertyData.images = [];
        for (const file of imageFiles) {
            if (file.size > 0) {
                const url = await uploadImage(file, `properties/${Date.now()}_${file.name}`);
                propertyData.images.push(url);
            }
        }
    }

    try {
        if (id) {
            await updateProperty(id, propertyData);
        } else {
            await createProperty(propertyData);
        }
        closeModal();
        await loadProperties();
        renderProperties();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Eliminar propiedad
async function deletePropertyHandler(id) {
    if (confirm('¿Estás seguro de eliminar esta propiedad?')) {
        try {
            await deleteProperty(id);
            await loadProperties();
            renderProperties();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
}

// Cerrar modal
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
}

// Cargar zonas (para el formulario)
async function loadZones(provinceId) {
    if (!provinceId) return;
    const zones = await getZones(provinceId);
    const zoneSelect = document.querySelector('select[name="zone"]');
    zoneSelect.innerHTML = '<option value="">Seleccionar</option>' + zones.map(z => `<option value="${z.name}">${z.name}</option>`).join('');
}

// Exponer funciones globales
window.editProperty = editProperty;
window.deletePropertyHandler = deletePropertyHandler;
window.closeModal = closeModal;
window.loadZones = loadZones;