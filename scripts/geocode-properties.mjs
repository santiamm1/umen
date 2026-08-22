// Geocodifica direcciones (vía Nominatim/OpenStreetMap, el mismo proveedor que usa
// el mapa de admin-dashboard.js) y completa geoLat/geoLng en las propiedades dadas.
// node scripts/geocode-properties.mjs

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

// id de Firestore -> mejor dirección disponible a partir de los datos scrapeados del sitio viejo
const TARGETS = [
    { id: 'xcXrfdyu1L22s3bcYJmv', title: 'Hotel en Venta Almagro 29 habitaciones', address: 'Almagro, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: 'v5s8evpnpLah9Yi05XXm', title: 'Oficina en Alquiler Nuñez – Av Cabildo 4769', address: 'Av. Cabildo 4769, Núñez, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: '1qHf01MqCxIp6Yhc4g61', title: 'Terreno en venta Av Cabildo al 4700 Nuñez', address: 'Av. Cabildo 4700, Núñez, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: 'TE5aVhhINZBwrXyXDF9j', title: 'Terreno La Plata Av 44 entre 5 y 6', address: 'Avenida 44, La Plata, Buenos Aires, Argentina' },
    { id: 'Uofh8ew0NItFKuVXth5h', title: 'Amenabar 2435 Belgrano', address: 'Amenábar 2435, Belgrano, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: 'FbF24TOQMia1yOSB0cLx', title: 'Apart Hotel a metros del Hospital Italiano', address: 'Hospital Italiano de Buenos Aires, Almagro, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: '1MMCMTy2oREKjYtiLfWT', title: 'Hotel Familiar Pension a metros de la UADE', address: 'UADE, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: 'fAlXTs3mWUr2j67ZqsqH', title: 'Av Cabildo y Virrey Loreto', address: 'Virrey Loreto, Belgrano, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: 'kwWvA7gN20LNkGjaGqLZ', title: 'PH en Galicia al 600, Villa Crespo', address: 'Galicia 600, Villa Crespo, Ciudad Autónoma de Buenos Aires, Argentina' },
    { id: 'J7a32k2siWSNgWVRKzW6', title: 'Villa Huapi Bariloche - Los Nostros 1530', address: 'Los Notros, Bariloche, Río Negro, Argentina' },
    { id: 'Sx2looVxxlPcp0Mlgiaf', title: 'Terreno esquina Corredor Medio, San Cristóbal', address: 'San Cristóbal, Ciudad Autónoma de Buenos Aires, Argentina' }
];

async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'umen.com.ar property migration script (admin@umen.com.ar)' } });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name } : null;
}

async function main() {
    const results = [];
    for (const t of TARGETS) {
        const r = await geocode(t.address);
        results.push({ ...t, geo: r });
        console.log(r
            ? `OK  ${t.title} -> [${r.lat}, ${r.lng}] (${r.displayName})`
            : `SIN RESULTADO  ${t.title} (${t.address})`);
        await new Promise(res => setTimeout(res, 1100)); // Nominatim: máx. 1 req/seg
    }

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        console.log('\nADMIN_EMAIL/ADMIN_PASSWORD no seteados: solo se geocodificó, no se escribió en Firestore.');
        return;
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    await signInWithEmailAndPassword(auth, email, password);

    for (const r of results) {
        if (!r.geo) continue;
        await updateDoc(doc(db, 'properties', r.id), { geoLat: r.geo.lat, geoLng: r.geo.lng });
        console.log(`+ actualizado geoLat/geoLng: ${r.title}`);
    }
    console.log('\nListo.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
