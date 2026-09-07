// Corrige el campo `code` de las propiedades tipo "Hotel" importadas de
// hotelesenventa.com. import-hoteles-en-venta.mjs guardaba `code: HEV-<id>`
// (el ID interno de WordPress) porque nunca leyó el código real de la
// propiedad — ese código vive en el cuerpo de cada ficha individual, como un
// widget de heading (<p class="elementor-heading-title ...">AR-CA1-36</p>)
// ubicado justo antes de la galería de imágenes.
//
// Matchea por `externalUrl` (ya guardado en cada propiedad).
//
// Por defecto corre en modo DRY RUN (no escribe nada).
// Para escribir de verdad en Firestore:   node scripts/fix-hotel-codes.mjs --commit

import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

const COMMIT = process.argv.includes('--commit');

// El código real es el único heading en <p> (no <h2>/<h3>) con esta clase,
// y siempre precede al widget de la galería de imágenes.
function extractHotelCode(html) {
    const m = html.match(/<p class="elementor-heading-title elementor-size-default">([^<]+)<\/p>[\s\S]{0,300}?elementor-widget-image-gallery/);
    return m ? m[1].trim() : null;
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para corregir de verdad.\n');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const snap = await getDocs(query(collection(db, 'properties'), where('type', '==', 'Hotel')));
    const hotels = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.externalUrl) hotels.push({ id: d.id, title: data.title, code: data.code, externalUrl: data.externalUrl });
    });
    console.log(`${hotels.length} hoteles de hotelesenventa.com encontrados.\n`);

    const toFix = [];
    const noCode = [];
    for (const h of hotels) {
        const res = await fetch(h.externalUrl);
        if (!res.ok) {
            console.log(` ! ${h.title}: no se pudo leer ${h.externalUrl} (${res.status})`);
            continue;
        }
        const html = await res.text();
        const realCode = extractHotelCode(html);
        if (!realCode) {
            noCode.push(h);
        } else if (realCode !== h.code) {
            toFix.push({ ...h, realCode });
        }
    }

    if (noCode.length > 0) {
        console.log(`${noCode.length} hotel(es) sin código detectado en la ficha (revisar a mano):`);
        noCode.forEach(h => console.log(` - ${h.title}: ${h.externalUrl}`));
        console.log('');
    }

    if (toFix.length === 0) {
        console.log('Nada para corregir, todos los códigos ya coinciden con hotelesenventa.com.');
        return;
    }

    console.log(`${toFix.length} propiedad(es) con código desactualizado:\n`);
    for (const h of toFix) {
        console.log(` - ${h.title}: "${h.code}" -> "${h.realCode}"`);
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
        await updateDoc(doc(db, 'properties', h.id), { code: h.realCode, updatedAt: new Date() });
        console.log(` + corregida "${h.title}" -> ${h.realCode}`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
