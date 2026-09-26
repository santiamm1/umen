// propertyService.js - Servicios para propiedades con Firebase

import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Helper to wait for Firebase initialization
async function getDb() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds
        const checkDb = () => {
            if (window.db) {
                resolve(window.db);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkDb, 100);
            } else {
                reject(new Error('Firestore no se inicializó a tiempo'));
            }
        };
        checkDb();
    });
}

// Lecturas públicas: por defecto van a php/firestore.php (caché en el servidor, ~10 min),
// así las visitas no gastan la cuota diaria de Firestore. Si el PHP no responde (ej. en local
// con un server sin PHP) se cae a Firestore directo. El admin llama setLiveData() para leer
// siempre de Firestore y ver sus cambios al instante.
let liveData = false;
export function setLiveData() { liveData = true; }

async function readCollection(name) {
    if (!liveData) {
        try {
            const res = await fetch(`/php/firestore.php?c=${name}`);
            if (res.ok) return await res.json();
        } catch { /* sin PHP: seguimos con Firestore */ }
    }
    const db = await getDb();
    const snap = await getDocs(collection(db, name));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Properties
// El catálogo completo se descarga UNA vez por carga de página y todas las consultas filtran
// en memoria. Antes cada sección/filtro disparaba su propia query (el home hacía 5, y
// propiedades.html re-descargaba todo el catálogo en cada cambio de filtro).
// ponytail: con ~180 propiedades (~500 KB) conviene; si el catálogo pasa de ~2000, volver a queries paginadas.
let catalogPromise = null;

function getCatalog() {
    catalogPromise ??= readCollection('properties')
        .catch(err => { catalogPromise = null; throw err; });
    return catalogPromise;
}

export async function getProperties(filters = {}) {
    try {
        let properties = [...await getCatalog()];

        if (filters.category) properties = properties.filter(p => p.type === filters.category);
        if (filters.featured) properties = properties.filter(p => p.featured === true);
        // 'operation' sin distinguir mayúsculas: hay propiedades viejas con "Alquiler"/"Venta".
        if (filters.operation) {
            const wanted = filters.operation.toLowerCase();
            properties = properties.filter(p => (p.operation || '').toLowerCase() === wanted);
        }
        if (filters.province) properties = properties.filter(p => p.provincia === filters.province);
        if (filters.minPrice) properties = properties.filter(p => p.price >= parseInt(filters.minPrice));
        if (filters.maxPrice) properties = properties.filter(p => p.price <= parseInt(filters.maxPrice));

        // Ordenar en memoria por fecha de creación (descendente)
        properties.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB - dateA;
        });

        return properties.slice(0, filters.limit || 100);
    } catch (error) {
        console.error('Error getting properties:', error);
        return [];
    }
}

export async function getProperty(id) {
    try {
        const db = await getDb();
        const docRef = doc(db, 'properties', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting property:', error);
        return null;
    }
}

export async function createProperty(propertyData) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'properties'), {
            ...propertyData,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        catalogPromise = null; // que la próxima lectura traiga el cambio
        return docRef.id;
    } catch (error) {
        console.error('Error creating property:', error);
        throw error;
    }
}

export async function updateProperty(id, propertyData) {
    try {
        const db = await getDb();
        const docRef = doc(db, 'properties', id);
        await updateDoc(docRef, {
            ...propertyData,
            updatedAt: new Date()
        });
        catalogPromise = null; // que la próxima lectura traiga el cambio
    } catch (error) {
        console.error('Error updating property:', error);
        throw error;
    }
}

export async function deleteProperty(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'properties', id));
        catalogPromise = null; // que la próxima lectura traiga el cambio
    } catch (error) {
        console.error('Error deleting property:', error);
        throw error;
    }
}

// Categories
export async function getCategories() {
    try {
        return await readCollection('categories');
    } catch (error) {
        console.error('Error getting categories:', error);
        return [];
    }
}

export async function createCategory(categoryData) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'categories'), categoryData);
        return docRef.id;
    } catch (error) {
        console.error('Error creating category:', error);
        throw error;
    }
}

export async function updateCategory(id, categoryData) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'categories', id), categoryData);
    } catch (error) {
        console.error('Error updating category:', error);
        throw error;
    }
}

export async function deleteCategory(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
        console.error('Error deleting category:', error);
        throw error;
    }
}

// Features
export async function getFeatures() {
    try {
        const querySnapshot = await getDocs(collection(window.db, 'features'));
        const features = [];
        querySnapshot.forEach((doc) => {
            features.push({ id: doc.id, ...doc.data() });
        });
        return features;
    } catch (error) {
        console.error('Error getting features:', error);
        return [];
    }
}

export async function createFeature(featureData) {
    try {
        const docRef = await addDoc(collection(window.db, 'features'), featureData);
        return docRef.id;
    } catch (error) {
        console.error('Error creating feature:', error);
        throw error;
    }
}

export async function updateFeature(id, featureData) {
    try {
        const docRef = doc(window.db, 'features', id);
        await updateDoc(docRef, featureData);
    } catch (error) {
        console.error('Error updating feature:', error);
        throw error;
    }
}

export async function deleteFeature(id) {
    try {
        await deleteDoc(doc(window.db, 'features', id));
    } catch (error) {
        console.error('Error deleting feature:', error);
        throw error;
    }
}

// Cities (ciudades) — lista plana, editable desde el panel de admin
export async function getCities() {
    try {
        const cities = await readCollection('cities');
        cities.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return cities;
    } catch (error) {
        console.error('Error getting cities:', error);
        return [];
    }
}

export async function createCity(cityData) {
    const db = await getDb();
    const docRef = await addDoc(collection(db, 'cities'), cityData);
    return docRef.id;
}

export async function updateCity(id, cityData) {
    const db = await getDb();
    await updateDoc(doc(db, 'cities', id), cityData);
}

export async function deleteCity(id) {
    const db = await getDb();
    await deleteDoc(doc(db, 'cities', id));
}

// Neighborhoods (barrios) — lista plana, editable desde el panel de admin
export async function getAllNeighborhoods() {
    try {
        const neighborhoods = await readCollection('neighborhoods');
        neighborhoods.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return neighborhoods;
    } catch (error) {
        console.error('Error getting all neighborhoods:', error);
        return [];
    }
}

export async function createNeighborhood(neighborhoodData) {
    const db = await getDb();
    const docRef = await addDoc(collection(db, 'neighborhoods'), neighborhoodData);
    return docRef.id;
}

export async function updateNeighborhood(id, neighborhoodData) {
    const db = await getDb();
    await updateDoc(doc(db, 'neighborhoods', id), neighborhoodData);
}

export async function deleteNeighborhood(id) {
    const db = await getDb();
    await deleteDoc(doc(db, 'neighborhoods', id));
}

// Locations (legacy: jerarquía zona → barrio, sin UI actualmente)
export async function getZones(provinceId) {
    try {
        const q = query(collection(window.db, 'zones'), where('provinceId', '==', provinceId));
        const querySnapshot = await getDocs(q);
        const zones = [];
        querySnapshot.forEach((doc) => {
            zones.push({ id: doc.id, ...doc.data() });
        });
        return zones;
    } catch (error) {
        console.error('Error getting zones:', error);
        return [];
    }
}

export async function getNeighborhoods(zoneId) {
    try {
        const q = query(collection(window.db, 'neighborhoods'), where('zoneId', '==', zoneId));
        const querySnapshot = await getDocs(q);
        const neighborhoods = [];
        querySnapshot.forEach((doc) => {
            neighborhoods.push({ id: doc.id, ...doc.data() });
        });
        return neighborhoods;
    } catch (error) {
        console.error('Error getting neighborhoods:', error);
        return [];
    }
}

// Taxonomía por defecto — replica los filtros del sitio anterior (umen.com.ar/propiedades-buscador)
// Se usa solo para poblar Firestore la primera vez (si la colección está vacía); luego todo se edita desde el admin.
const DEFAULT_TAXONOMY = {
    categories: ['Casa', 'Departamento', 'Lote', 'Local Comercial', 'Oficina', 'Galpón', 'Cochera'],
    countries: ['Argentina'],
    // Cada provincia pertenece a un país (filtro en cascada País → Provincia).
    provinces: [
        'Ciudad Autónoma de Buenos Aires', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
    ].map(name => ({ name, pais: 'Argentina' })),
    cities: ['Capital Federal', 'GBA Norte', 'GBA Sur', 'GBA Oeste'],
    localities: [
        // CABA no tiene localidades per se, pero GBA sí:
        'Vicente López', 'San Isidro', 'San Fernando', 'Tigre', 'Pilar', // Norte
        'Avellaneda', 'Lanús', 'Lomas de Zamora', 'Quilmes', 'Berazategui', // Sur
        'Tres de Febrero', 'San Martín', 'Morón', 'Ituzaingó', 'Moreno' // Oeste
    ],
    neighborhoods: [
        // CABA
        'Palermo', 'Belgrano', 'Recoleta', 'Caballito', 'Puerto Madero', 'San Telmo', 'Nuñez', 'Almagro', 'Villa Urquiza', 'Villa Devoto', 'Villa Crespo', 'Colegiales', 'Retiro', 'Balvanera',
        // GBA (Algunos barrios o zonas conocidas)
        'Olivos', 'Florida', 'La Lucila', 'Martínez', 'Acassuso', 'Beccar', 'Victoria', 'Nordelta', 'Castelar', 'Ramos Mejía', 'Banfield', 'Temperley', 'Adrogué'
    ],
    operations: ['Venta', 'Alquiler', 'Alquiler temporario'],
    statuses: ['Publicado', 'Pausa', 'Vendido', 'Pendiente', 'Borrador'],
    currencies: ['USD', 'ARS']
};

export async function ensureDefaultTaxonomy() {
    try {
        const db = await getDb();

        const seedIfEmpty = async (collectionName, names) => {
            const snapshot = await getDocs(collection(db, collectionName));
            const existingNames = new Set();
            snapshot.forEach(doc => existingNames.add(doc.data().name?.toLowerCase()));

            for (const name of names) {
                if (!existingNames.has(name.toLowerCase())) {
                    await addDoc(collection(db, collectionName), { name });
                }
            }
        };

        // Provincias: cada una lleva su país, así que se siembran aparte (no son
        // strings planos como el resto de las taxonomías).
        const seedProvincesIfEmpty = async (provinces) => {
            const snapshot = await getDocs(collection(db, 'provinces'));
            const existingNames = new Set();
            snapshot.forEach(doc => existingNames.add(doc.data().name?.toLowerCase()));

            for (const { name, pais } of provinces) {
                if (!existingNames.has(name.toLowerCase())) {
                    await addDoc(collection(db, 'provinces'), { name, pais });
                }
            }
        };

        await Promise.all([
            seedIfEmpty('categories', DEFAULT_TAXONOMY.categories),
            seedIfEmpty('countries', DEFAULT_TAXONOMY.countries),
            seedProvincesIfEmpty(DEFAULT_TAXONOMY.provinces),
            seedIfEmpty('cities', DEFAULT_TAXONOMY.cities),
            seedIfEmpty('localities', DEFAULT_TAXONOMY.localities),
            seedIfEmpty('neighborhoods', DEFAULT_TAXONOMY.neighborhoods),
            seedIfEmpty('operations', DEFAULT_TAXONOMY.operations),
            seedIfEmpty('statuses', DEFAULT_TAXONOMY.statuses),
            seedIfEmpty('currencies', DEFAULT_TAXONOMY.currencies)
        ]);
    } catch (error) {
        console.error('Error seeding default taxonomy:', error);
    }
}

// ── Notas de Hoteles (contenido tipo blog, se linkea al catálogo externo de Hoteles en Venta) ──
export async function getHotelNotes() {
    try {
        return await readCollection('hotelNotes');
    } catch (error) {
        console.error('Error getting hotel notes:', error);
        return [];
    }
}

export async function getHotelNote(id) {
    try {
        const db = await getDb();
        const docSnap = await getDoc(doc(db, 'hotelNotes', id));
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error('Error getting hotel note:', error);
        return null;
    }
}

export async function getHotelNoteBySlug(slug) {
    try {
        const db = await getDb();
        const q = query(collection(db, 'hotelNotes'), where('slug', '==', slug), limit(1));
        const querySnapshot = await getDocs(q);
        let note = null;
        querySnapshot.forEach((doc) => { note = { id: doc.id, ...doc.data() }; });
        return note;
    } catch (error) {
        console.error('Error getting hotel note by slug:', error);
        return null;
    }
}

export async function createHotelNote(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'hotelNotes'), { ...data, createdAt: new Date() });
        return docRef.id;
    } catch (error) {
        console.error('Error creating hotel note:', error);
        throw error;
    }
}

export async function updateHotelNote(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'hotelNotes', id), data);
    } catch (error) {
        console.error('Error updating hotel note:', error);
        throw error;
    }
}

export async function deleteHotelNote(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'hotelNotes', id));
    } catch (error) {
        console.error('Error deleting hotel note:', error);
        throw error;
    }
}

// ── Blog (Notas de Interés & Urbanismo) ──
function sortByCreatedAtDesc(items) {
    return items.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
    });
}

export async function getBlogPosts(limitCount) {
    try {
        const posts = sortByCreatedAtDesc(await readCollection('blogPosts'));
        return limitCount ? posts.slice(0, limitCount) : posts;
    } catch (error) {
        console.error('Error getting blog posts:', error);
        return [];
    }
}

export async function getBlogPost(id) {
    try {
        const db = await getDb();
        const docSnap = await getDoc(doc(db, 'blogPosts', id));
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error('Error getting blog post:', error);
        return null;
    }
}

export async function getBlogPostBySlug(slug) {
    try {
        const db = await getDb();
        const q = query(collection(db, 'blogPosts'), where('slug', '==', slug), limit(1));
        const querySnapshot = await getDocs(q);
        let post = null;
        querySnapshot.forEach((doc) => { post = { id: doc.id, ...doc.data() }; });
        return post;
    } catch (error) {
        console.error('Error getting blog post by slug:', error);
        return null;
    }
}

export async function createBlogPost(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'blogPosts'), { ...data, createdAt: new Date() });
        return docRef.id;
    } catch (error) {
        console.error('Error creating blog post:', error);
        throw error;
    }
}

export async function updateBlogPost(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'blogPosts', id), data);
    } catch (error) {
        console.error('Error updating blog post:', error);
        throw error;
    }
}

export async function deleteBlogPost(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'blogPosts', id));
    } catch (error) {
        console.error('Error deleting blog post:', error);
        throw error;
    }
}

// ── Operaciones ──
export async function getOperations() {
    try {
        const db = await getDb();
        const querySnapshot = await getDocs(collection(db, 'operations'));
        const arr = [];
        querySnapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        return arr;
    } catch (error) { console.error(error); return []; }
}
export async function createOperation(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'operations'), data);
        return docRef.id;
    } catch (error) { throw error; }
}
export async function updateOperation(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'operations', id), data);
    } catch (error) { throw error; }
}
export async function deleteOperation(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'operations', id));
    } catch (error) { throw error; }
}

// ── Estados ──
export async function getStatuses() {
    try {
        const db = await getDb();
        const querySnapshot = await getDocs(collection(db, 'statuses'));
        const arr = [];
        querySnapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        return arr;
    } catch (error) { console.error(error); return []; }
}
export async function createStatus(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'statuses'), data);
        return docRef.id;
    } catch (error) { throw error; }
}
export async function updateStatus(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'statuses', id), data);
    } catch (error) { throw error; }
}
export async function deleteStatus(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'statuses', id));
    } catch (error) { throw error; }
}

// ── Monedas ──
export async function getCurrencies() {
    try {
        const db = await getDb();
        const querySnapshot = await getDocs(collection(db, 'currencies'));
        const arr = [];
        querySnapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        return arr;
    } catch (error) { console.error(error); return []; }
}
export async function createCurrency(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'currencies'), data);
        return docRef.id;
    } catch (error) { throw error; }
}
export async function updateCurrency(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'currencies', id), data);
    } catch (error) { throw error; }
}
export async function deleteCurrency(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'currencies', id));
    } catch (error) { throw error; }
}

// ── Países ──
export async function getCountries() {
    try {
        return await readCollection('countries');
    } catch (error) { console.error(error); return []; }
}
export async function createCountry(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'countries'), data);
        return docRef.id;
    } catch (error) { throw error; }
}
export async function updateCountry(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'countries', id), data);
    } catch (error) { throw error; }
}
export async function deleteCountry(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'countries', id));
    } catch (error) { throw error; }
}

// ── Provincias ──
export async function getProvinces() {
    try {
        return await readCollection('provinces');
    } catch (error) { console.error(error); return []; }
}
export async function createProvince(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'provinces'), data);
        return docRef.id;
    } catch (error) { throw error; }
}
export async function updateProvince(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'provinces', id), data);
    } catch (error) { throw error; }
}
export async function deleteProvince(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'provinces', id));
    } catch (error) { throw error; }
}

// ── Localidades ──
export async function getLocalities() {
    try {
        return await readCollection('localities');
    } catch (error) { console.error(error); return []; }
}
export async function createLocality(data) {
    try {
        const db = await getDb();
        const docRef = await addDoc(collection(db, 'localities'), data);
        return docRef.id;
    } catch (error) { throw error; }
}
export async function updateLocality(id, data) {
    try {
        const db = await getDb();
        await updateDoc(doc(db, 'localities', id), data);
    } catch (error) { throw error; }
}
export async function deleteLocality(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'localities', id));
    } catch (error) { throw error; }
}

// Perfil del administrador (nombre, teléfono — email/contraseña se manejan por Firebase Auth)
export async function getAdminProfile(uid) {
    try {
        const db = await getDb();
        const snap = await getDoc(doc(db, 'admins', uid));
        return snap.exists() ? snap.data() : {};
    } catch (error) { console.error(error); return {}; }
}
export async function saveAdminProfile(uid, data) {
    try {
        const db = await getDb();
        await setDoc(doc(db, 'admins', uid), data, { merge: true });
    } catch (error) { throw error; }
}