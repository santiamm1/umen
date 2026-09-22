// import-hoteles-en-venta.mjs truncaba la descripción a 500 caracteres
// (`.slice(0, 500)`), cortando el texto a mitad de palabra. Ya se sacó ese
// slice del import, pero las propiedades que ya se importaron con el bug
// quedaron con la descripción cortada. Este script las re-lee de
// hotelesenventa.com (vía su REST API, por slug tomado de `externalUrl`) y
// pisa `description` con el texto completo.
//
// Por defecto corre en modo DRY RUN (no escribe nada).
// Para escribir de verdad en Firestore:   node scripts/fix-hotel-descriptions.mjs --commit

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

const SITE = 'https://hotelesenventa.com';
const COMMIT = process.argv.includes('--commit');

function decodeEntities(str) {
    return (str || '')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, '’')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x1f[0-9a-f]{3};/gi, '')
        .trim();
}

function stripTags(html) {
    return decodeEntities((html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

// Colapsa espacios/tabs pero conserva los saltos de línea entre párrafos
// (stripTags a secas los pisa todos a un solo espacio).
function normalizeWhitespace(text) {
    return text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

function contentToParagraphs(html) {
    const prepped = (html || '')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<br[^>]*>/gi, '\n');
    const paragraphs = [...prepped.matchAll(/<(p|div|ul|ol|h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)]
        .map(m => decodeEntities(m[2].replace(/<[^>]+>/g, '')))
        .map(normalizeWhitespace)
        .filter(Boolean);
    return paragraphs.length ? paragraphs.join('\n\n') : stripTags(html);
}

function slugFromUrl(url) {
    return url.replace(/\/$/, '').split('/').pop();
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para corregir de verdad.\n');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const snap = await getDocs(collection(db, 'properties'));
    const hotels = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.externalUrl) hotels.push({ id: d.id, title: data.title, description: data.description || '', externalUrl: data.externalUrl });
    });
    console.log(`${hotels.length} propiedades de hotelesenventa.com encontradas.\n`);

    const toFix = [];
    const notFound = [];
    for (const h of hotels) {
        const slug = slugFromUrl(h.externalUrl);
        const res = await fetch(`${SITE}/wp-json/wp/v2/hotel?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) {
            notFound.push({ ...h, reason: `HTTP ${res.status}` });
            continue;
        }
        const items = await res.json();
        if (!items.length) {
            notFound.push({ ...h, reason: 'sin resultados' });
            continue;
        }
        const fullDescription = contentToParagraphs(items[0].content.rendered);
        if (fullDescription && fullDescription !== h.description) {
            toFix.push({ ...h, fullDescription });
        }
    }

    if (notFound.length) {
        console.log(`${notFound.length} propiedad(es) no encontradas en hotelesenventa.com (revisar a mano):`);
        notFound.forEach(h => console.log(` - ${h.title}: ${h.externalUrl} (${h.reason})`));
        console.log('');
    }

    if (toFix.length === 0) {
        console.log('Nada para corregir, todas las descripciones ya están completas.');
        return;
    }

    console.log(`${toFix.length} propiedad(es) con descripción incompleta:\n`);
    for (const h of toFix) {
        console.log(` - ${h.title}: ${h.description.length} -> ${h.fullDescription.length} caracteres`);
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
        await updateDoc(doc(db, 'properties', h.id), { description: h.fullDescription, updatedAt: new Date() });
        console.log(` + corregida "${h.title}" (${h.fullDescription.length} caracteres)`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
