// scrape-old-properties.mjs usaba item.content.rendered (REST API de WordPress)
// para la descripción, pero en umen.com.ar el texto real vive en un campo
// Toolset Blocks que no viaja por ahí — quedaba corto o con contenido de otro
// campo. Ya se corrigió la extracción (ver extractDescription en
// scrape-old-properties.mjs); este script re-lee cada propiedad importada de
// umen.com.ar (las que tienen `legacyUrl`) desde su ficha real y pisa
// `description` con el texto completo.
//
// Por defecto corre en modo DRY RUN (no escribe nada).
// Para escribir de verdad en Firestore:   node scripts/fix-umen-descriptions.mjs --commit

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

function decodeEntities(str) {
    return (str || '')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, '’')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function stripTags(html) {
    return decodeEntities((html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

// Colapsa espacios/tabs pero conserva los saltos de línea entre párrafos.
function normalizeWhitespace(text) {
    return text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

// Convierte HTML (párrafos, listas, headings) a texto plano conservando la
// separación entre bloques y los ítems de listas como "• ...".
function htmlToParagraphs(html) {
    const prepped = (html || '')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<br[^>]*>/gi, '\n');
    const blocks = [...prepped.matchAll(/<(p|div|ul|ol|h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi)]
        .map(m => decodeEntities(m[2].replace(/<[^>]+>/g, '')))
        .map(normalizeWhitespace)
        .filter(Boolean);
    return blocks.length ? blocks.join('\n\n') : normalizeWhitespace(decodeEntities(prepped.replace(/<[^>]+>/g, ' ')));
}

function extractDescription(html) {
    const m = html.match(/<h3[^>]*>Descripci[oó]n<\/h3>\s*<div class="tb-field"[^>]*>([\s\S]*?)<\/div>\s*\n*\s*<h3/);
    if (!m) return null;
    const block = m[1]
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<div class="tces-js-font-encoded"[\s\S]*?<\/div>/g, '');
    return htmlToParagraphs(block);
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para corregir de verdad.\n');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const snap = await getDocs(collection(db, 'properties'));
    const items = [];
    snap.forEach(d => {
        const data = d.data();
        if (data.legacyUrl) items.push({ id: d.id, title: data.title, description: data.description || '', legacyUrl: data.legacyUrl });
    });
    console.log(`${items.length} propiedades de umen.com.ar encontradas.\n`);

    const toFix = [];
    const notFound = [];
    for (const item of items) {
        const res = await fetch(item.legacyUrl);
        if (!res.ok) {
            notFound.push({ ...item, reason: `HTTP ${res.status}` });
            continue;
        }
        const html = await res.text();
        const fullDescription = extractDescription(html);
        if (!fullDescription) {
            notFound.push({ ...item, reason: 'no se encontró el bloque de descripción' });
            continue;
        }
        if (fullDescription !== item.description) {
            toFix.push({ ...item, fullDescription });
        }
    }

    if (notFound.length) {
        console.log(`${notFound.length} propiedad(es) no revisadas (ver a mano):`);
        notFound.forEach(h => console.log(` - ${h.title}: ${h.legacyUrl} (${h.reason})`));
        console.log('');
    }

    if (toFix.length === 0) {
        console.log('Nada para corregir, todas las descripciones ya están completas.');
        return;
    }

    console.log(`${toFix.length} propiedad(es) con descripción a corregir:\n`);
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
