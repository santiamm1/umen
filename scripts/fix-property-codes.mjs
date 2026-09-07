// Corrige el campo `code` de las propiedades importadas del sitio anterior
// (umen.com.ar), que se scrapeó con una regex que cortaba el código en la
// primera letra acentuada (ej. "LOC-NUÑ-2UF2" quedaba truncado a "LOC-NU-2"
// porque la Ñ no entraba en la clase [A-Za-z0-9-] — ver scrape-old-properties.mjs).
//
// Solo toca propiedades con `legacyUrl` (las de umen.com.ar). Las de
// hotelesenventa.com (`externalUrl`) se resuelven aparte.
//
// Por defecto corre en modo DRY RUN (no escribe nada).
// Para escribir de verdad en Firestore:   node scripts/fix-property-codes.mjs --commit

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

// Termina en el próximo tag (</p>, </div>, etc.), no en la primera letra rara,
// así "Ñ" y otros acentos quedan incluidos en el código.
function extractCode(html) {
    const m = html.match(/C[oó]digo de la propiedad:\s*([^<]+)/i);
    return m ? m[1].trim() : null;
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para corregir de verdad.\n');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const snap = await getDocs(collection(db, 'properties'));
    const legacyProps = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.legacyUrl) legacyProps.push({ id: d.id, title: data.title, code: data.code, legacyUrl: data.legacyUrl });
    });
    console.log(`${legacyProps.length} propiedades de umen.com.ar (legacyUrl) encontradas.\n`);

    const toFix = [];
    for (const p of legacyProps) {
        const res = await fetch(p.legacyUrl);
        if (!res.ok) {
            console.log(` ! ${p.title}: no se pudo leer ${p.legacyUrl} (${res.status})`);
            continue;
        }
        const html = await res.text();
        const realCode = extractCode(html);
        if (realCode && realCode !== p.code) {
            toFix.push({ ...p, realCode });
        }
    }

    if (toFix.length === 0) {
        console.log('Nada para corregir, todos los códigos ya coinciden con el sitio anterior.');
        return;
    }

    console.log(`${toFix.length} propiedad(es) con código desactualizado:\n`);
    for (const p of toFix) {
        console.log(` - ${p.title}: "${p.code}" -> "${p.realCode}"`);
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

    for (const p of toFix) {
        await updateDoc(doc(db, 'properties', p.id), { code: p.realCode, updatedAt: new Date() });
        console.log(` + corregida "${p.title}" -> ${p.realCode}`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
