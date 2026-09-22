// hotelesenventa.com no tiene un campo de cantidad de baños por hotel (nunca
// existió, no es que se perdió al migrar) — por eso las 168 propiedades
// importadas quedaron con bathrooms:0 y las cards muestran "1 Baños" a modo de
// fallback genérico, un dato inventado. "Plazas" (capacidad de huéspedes) sí
// es un dato real y propio de hoteles que la ficha original declara cuando
// existe. Este script lo agrega a cada propiedad ya importada.
//
// Por defecto corre en modo DRY RUN (no escribe nada).
// Para escribir de verdad en Firestore:   node scripts/fix-hotel-plazas.mjs --commit

import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

const COMMIT = process.argv.includes('--commit');

// "1.503" -> 1503 | "290.40" -> 290 (decimal, se descarta la parte fraccionaria)
function parseSurfaceNumber(text) {
    const m = (text || '').match(/\d[\d.,]*\d|\d/);
    if (!m) return null;
    const normalized = m[0].replace(/[.,](\d{1,2})$/, '.$1').replace(/[.,](?=\d{3})/g, '');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? Math.round(n) : null;
}

function extractPlazas(html) {
    const m = html.match(/<p class="fa plazas">([^<]+)<\/p>/);
    return m ? parseSurfaceNumber(m[1]) : null;
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para corregir de verdad.\n');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const snap = await getDocs(collection(db, 'properties'));
    const hotels = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.externalUrl) hotels.push({ id: d.id, title: data.title, plazas: data.plazas || 0, externalUrl: data.externalUrl });
    });
    console.log(`${hotels.length} propiedades de hotelesenventa.com encontradas.\n`);

    const toFix = [];
    const sinPlazas = [];
    for (const h of hotels) {
        const res = await fetch(h.externalUrl);
        if (!res.ok) continue;
        const html = await res.text();
        const plazas = extractPlazas(html);
        if (!plazas) {
            sinPlazas.push(h);
        } else if (plazas !== h.plazas) {
            toFix.push({ ...h, plazas });
        }
    }

    console.log(`${sinPlazas.length} hotel(es) sin dato de "Plazas" en la ficha (no hay nada que agregar ahí).\n`);

    if (toFix.length === 0) {
        console.log('Nada para corregir, todas las plazas ya están al día.');
        return;
    }

    console.log(`${toFix.length} propiedad(es) con plazas a agregar/corregir:\n`);
    for (const h of toFix) {
        console.log(` - ${h.title}: ${h.plazas} plazas`);
    }

    if (!COMMIT) {
        console.log('\nDry run terminado. Corré con --commit para aplicar estos cambios.');
        return;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const email = process.env.ADMIN_EMAIL || await rl.question('\nEmail admin: ');
    const password = process.env.ADMIN_PASSWORD || await rl.question('Password: ');
    rl.close();

    const auth = getAuth(app);
    console.log('\nIniciando sesión...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('Sesión OK.\n');

    for (const h of toFix) {
        await updateDoc(doc(db, 'properties', h.id), { plazas: h.plazas, updatedAt: new Date() });
        console.log(` + corregida "${h.title}" (${h.plazas} plazas)`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
