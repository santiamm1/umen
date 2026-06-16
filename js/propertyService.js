// propertyService.js - Servicios para propiedades con Firebase

import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';

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

// Properties
export async function getProperties(filters = {}) {
    try {
        const db = await getDb();
        console.log('Consultando Firestore con filtros:', filters);
        const colRef = collection(db, 'properties');
        let queryConstraints = [];

        if (filters.category) {
            queryConstraints.push(where('type', '==', filters.category));
        }
        if (filters.operation) {
            queryConstraints.push(where('operation', '==', filters.operation));
        }
        if (filters.province) {
            queryConstraints.push(where('province', '==', filters.province));
        }
        if (filters.minPrice) {
            queryConstraints.push(where('price', '>=', parseInt(filters.minPrice)));
        }
        if (filters.maxPrice) {
            queryConstraints.push(where('price', '<=', parseInt(filters.maxPrice)));
        }

        // No agregamos orderBy aquí para evitar errores de índice si el usuario no los tiene configurados
        queryConstraints.push(limit(100));

        const q = query(colRef, ...queryConstraints);
        
        const querySnapshot = await getDocs(q);
        console.log('Snapshot recibido. Tamaño:', querySnapshot.size);
        
        let properties = [];
        querySnapshot.forEach((doc) => {
            console.log('Documento encontrado:', doc.id, doc.data());
            properties.push({ id: doc.id, ...doc.data() });
        });

        // Ordenar en memoria por fecha de creación (descendente)
        properties.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB - dateA;
        });

        console.log('Propiedades finales enviadas al dashboard:', properties);
        return properties;
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
    } catch (error) {
        console.error('Error updating property:', error);
        throw error;
    }
}

export async function deleteProperty(id) {
    try {
        const db = await getDb();
        await deleteDoc(doc(db, 'properties', id));
    } catch (error) {
        console.error('Error deleting property:', error);
        throw error;
    }
}

// Categories
export async function getCategories() {
    try {
        const db = await getDb();
        const querySnapshot = await getDocs(collection(db, 'categories'));
        const categories = [];
        querySnapshot.forEach((doc) => {
            categories.push({ id: doc.id, ...doc.data() });
        });
        return categories;
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
        const db = await getDb();
        const querySnapshot = await getDocs(collection(db, 'cities'));
        const cities = [];
        querySnapshot.forEach((doc) => cities.push({ id: doc.id, ...doc.data() }));
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
        const db = await getDb();
        const querySnapshot = await getDocs(collection(db, 'neighborhoods'));
        const neighborhoods = [];
        querySnapshot.forEach((doc) => neighborhoods.push({ id: doc.id, ...doc.data() }));
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

// Locations (legacy: jerarquía provincia → zona → barrio, sin UI actualmente)
export async function getProvinces() {
    try {
        const db = await getDb();
        const querySnapshot = await getDocs(collection(db, 'provinces'));
        const provinces = [];
        querySnapshot.forEach((doc) => {
            provinces.push({ id: doc.id, ...doc.data() });
        });
        return provinces;
    } catch (error) {
        console.error('Error getting provinces:', error);
        return [];
    }
}

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
    categories: ['Departamento', 'PH', 'Oficina', 'Edificio en Block', 'Hotel', 'Negocio Especial', 'Terreno'],
    cities: ['Capital Federal', 'Bariloche', 'Dina Huapi', 'La Plata'],
    neighborhoods: ['Almagro', 'Belgrano', 'Caballito', 'Centro', 'Microcentro', 'Nuñez', 'San Cristóbal', 'Villa Crespo']
};

export async function ensureDefaultTaxonomy() {
    try {
        const db = await getDb();

        const seedIfEmpty = async (collectionName, names) => {
            const snapshot = await getDocs(collection(db, collectionName));
            if (!snapshot.empty) return;
            for (const name of names) {
                await addDoc(collection(db, collectionName), { name });
            }
        };

        await Promise.all([
            seedIfEmpty('categories', DEFAULT_TAXONOMY.categories),
            seedIfEmpty('cities', DEFAULT_TAXONOMY.cities),
            seedIfEmpty('neighborhoods', DEFAULT_TAXONOMY.neighborhoods)
        ]);
    } catch (error) {
        console.error('Error seeding default taxonomy:', error);
    }
}

// Image upload
export async function uploadImage(file, path) {
    try {
        const storageRef = ref(window.storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

export async function deleteImage(url) {
    try {
        const storageRef = ref(window.storage, url);
        await deleteObject(storageRef);
    } catch (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
}