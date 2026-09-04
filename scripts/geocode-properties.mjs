// Geocodifica direcciones (vía Nominatim/OpenStreetMap, el mismo proveedor que usa
// el mapa de admin-dashboard.js) y completa geoLat/geoLng en TODAS las propiedades
// que todavía no lo tengan, usando barrio + zona como dirección.
// node scripts/geocode-properties.mjs

import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'umen.com.ar property migration script (admin@umen.com.ar)' } });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name } : null;
}

async function main() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const email = process.env.ADMIN_EMAIL || await rl.question('Email admin: ');
    const password = process.env.ADMIN_PASSWORD || await rl.question('Password: ');
    rl.close();

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    await signInWithEmailAndPassword(auth, email, password);

    const snap = await getDocs(collection(db, 'properties'));
    const targets = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.geoLat || !p.geoLng)
        .map(p => {
            // De más específica a más genérica: "provincia" a veces trae etiquetas
            // internas del sitio viejo (ej "Cost Atlantica", "Patagonia") que no son
            // un lugar real para el geocodificador, así que probamos sin ella también.
            const candidates = [
                [p.neighborhood, p.zone, p.provincia, 'Argentina'],
                [p.neighborhood, p.zone, 'Argentina'],
                [p.zone, 'Argentina']
            ]
                .map(parts => parts.filter(Boolean).join(', '))
                .filter(addr => addr !== 'Argentina');
            return { id: p.id, title: p.title || p.id, candidates: [...new Set(candidates)] };
        })
        .filter(t => t.candidates.length > 0); // sin barrio ni zona no hay nada que geocodificar

    console.log(`${targets.length} propiedades sin geoLat/geoLng.\n`);

    for (const t of targets) {
        let r = null;
        let usedAddress = '';
        for (const address of t.candidates) {
            r = await geocode(address);
            await new Promise(res => setTimeout(res, 1100)); // Nominatim: máx. 1 req/seg
            if (r) { usedAddress = address; break; }
        }
        if (r) {
            await updateDoc(doc(db, 'properties', t.id), { geoLat: r.lat, geoLng: r.lng });
            console.log(`OK  ${t.title} -> [${r.lat}, ${r.lng}] (${usedAddress})`);
        } else {
            console.log(`SIN RESULTADO  ${t.title} (${t.candidates.join(' | ')})`);
        }
    }
    console.log('\nListo.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
