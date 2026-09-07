// Corrige el campo `pais` de las propiedades tipo "Hotel" importadas por
// import-hoteles-en-venta.mjs, que hasta ahora hardcodeaba pais: 'Argentina'
// para todas (ver ese archivo). El sitio origen sí tiene el país correcto en
// una clase `pais-*` (ej. "pais-uruguay") que nunca se leía.
//
// Matchea por el campo `code` (HEV-<id>) que ya guarda cada propiedad.
//
// Por defecto corre en modo DRY RUN (no escribe nada).
// Para escribir de verdad en Firestore:   node scripts/fix-hotel-pais.mjs --commit

import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc, addDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

const SITE = 'https://hotelesenventa.com';
const COMMIT = process.argv.includes('--commit');

function prettifySlug(slug) {
    if (!slug) return '';
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function taxonomyFromClassList(classList, prefix) {
    const cls = (classList || []).find(c => c.startsWith(prefix));
    return cls ? prettifySlug(cls.slice(prefix.length)) : '';
}

async function fetchAllHotels() {
    const list = [];
    for (let page = 1; ; page++) {
        const res = await fetch(`${SITE}/wp-json/wp/v2/hotel?per_page=100&page=${page}`);
        const batch = await res.json();
        if (!Array.isArray(batch) || batch.length === 0) break;
        list.push(...batch);
    }
    return list;
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para corregir de verdad.\n');

    console.log(`Trayendo taxonomía de países desde ${SITE}...`);
    const items = await fetchAllHotels();
    const paisByCode = new Map();
    for (const item of items) {
        const pais = taxonomyFromClassList(item.class_list, 'pais-');
        if (pais) paisByCode.set(`HEV-${item.id}`, pais);
    }
    console.log(`${items.length} hoteles encontrados en el origen.\n`);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const snap = await getDocs(query(collection(db, 'properties'), where('type', '==', 'Hotel')));
    console.log(`${snap.size} propiedades tipo Hotel en Firestore.\n`);

    const toFix = [];
    snap.forEach(d => {
        const data = d.data();
        const paisReal = paisByCode.get(data.code);
        if (paisReal && paisReal !== data.pais) {
            toFix.push({ id: d.id, code: data.code, title: data.title, from: data.pais, to: paisReal });
        }
    });

    if (toFix.length > 0) {
        console.log(`${toFix.length} propiedades con país incorrecto:\n`);
        for (const p of toFix) {
            console.log(` - ${p.title} (${p.code}): "${p.from}" -> "${p.to}"`);
        }
    } else {
        console.log('Las propiedades ya tienen el país correcto.');
    }

    // "countries" es la colección aparte que alimenta el filtro de país en la web;
    // puede faltarle países aunque las propiedades ya estén bien, así que se chequea
    // siempre (no solo cuando hay propiedades para corregir).
    const existingCountries = new Set(
        (await getDocs(collection(db, 'countries'))).docs.map(d => (d.data().name || '').toLowerCase())
    );
    const allPaises = new Set([...paisByCode.values()]);
    const missingCountries = [...allPaises].filter(name => !existingCountries.has(name.toLowerCase()));

    if (missingCountries.length > 0) {
        console.log(`\n${missingCountries.length} país(es) faltan en la colección "countries" (filtro de la web): ${missingCountries.join(', ')}`);
    }

    if (toFix.length === 0 && missingCountries.length === 0) {
        console.log('\nNada para hacer.');
        return;
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

    for (const name of missingCountries) {
        await addDoc(collection(db, 'countries'), { name });
        console.log(` + agregado "${name}" a la colección "countries"`);
    }

    for (const p of toFix) {
        await updateDoc(doc(db, 'properties', p.id), { pais: p.to, updatedAt: new Date() });
        console.log(` + corregida "${p.title}" -> ${p.to}`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
