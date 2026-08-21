// Importa a Firestore las propiedades scrapeadas del sitio anterior
// (scripts/output/old-properties.json, generado por scrape-old-properties.mjs).
//
// Por defecto corre en modo DRY RUN: solo muestra qué crearía, no escribe nada.
// Para escribir de verdad en Firestore: node scripts/import-old-properties.mjs --commit
//
// Pide el email/password de un usuario admin ya existente (el mismo que se usa
// en admin-login.html) para autenticarse antes de escribir.

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, addDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

const COMMIT = process.argv.includes('--commit');

async function prompt(question, hidden = false) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
}

async function ensureTaxonomy(db, collectionName, name) {
    if (!name) return;
    const q = query(collection(db, collectionName), where('name', '==', name));
    const snap = await getDocs(q);
    if (!snap.empty) return;
    await addDoc(collection(db, collectionName), { name });
    console.log(`   + agregado "${name}" a "${collectionName}"`);
}

function mapToPropertyDoc(item) {
    return {
        code: item._code || '',
        title: item.title,
        status: 'Publicado',
        price: item.price || 0,
        currency: item.priceCurrency || 'USD',
        type: item.type || '',
        operation: item.operation || '',
        provincia: item.province || '',
        zone: item.city || '',
        neighborhood: item.neighborhood || '',
        pais: 'Argentina',
        description: item.description || '',
        surface: item.surface || 0,
        bedrooms: item.bedrooms || 0,
        cantDormitorios: item.bedrooms || null,
        bathrooms: item.bathrooms || 0,
        cantBanos: item.bathrooms || null,
        garage: item.garage || 0,
        images: item.images || [],
        legacyUrl: item._source,
        legacySlug: item.slug
    };
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para importar de verdad.\n');

    const raw = await readFile(new URL('./output/old-properties.json', import.meta.url), 'utf-8');
    const items = JSON.parse(raw);

    const incomplete = items.filter(i => !i.price || !i.type || !i.operation);
    if (incomplete.length) {
        console.log(`Atención: ${incomplete.length} propiedad(es) con precio/tipo/operación faltante. Se importan igual, pero revisalas después:`);
        incomplete.forEach(i => console.log(`   - ${i.slug}`));
        console.log('');
    }

    if (!COMMIT) {
        for (const item of items) {
            const doc = mapToPropertyDoc(item);
            console.log(`\n${doc.title}`);
            console.log('   ', JSON.stringify({ code: doc.code, price: doc.price, currency: doc.currency, type: doc.type, operation: doc.operation, provincia: doc.provincia, zone: doc.zone, neighborhood: doc.neighborhood, surface: doc.surface, images: doc.images.length }));
        }
        console.log('\nDry run terminado (no se tocó Firestore). Revisá arriba y corré con --commit para importar de verdad.');
        return;
    }

    const email = process.env.ADMIN_EMAIL || await prompt('Email admin: ');
    const password = process.env.ADMIN_PASSWORD || await prompt('Password: ');

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    console.log('\nIniciando sesión...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('Sesión OK.\n');

    for (const item of items) {
        const existing = await getDocs(query(collection(db, 'properties'), where('code', '==', item._code || '__none__')));
        if (item._code && !existing.empty) {
            console.log(`= "${item.title}" (${item._code}) ya existe, se salta.`);
            continue;
        }

        console.log(`\n${item.title}`);
        await ensureTaxonomy(db, 'categories', item.type);
        await ensureTaxonomy(db, 'operations', item.operation);
        await ensureTaxonomy(db, 'provinces', item.province);
        await ensureTaxonomy(db, 'cities', item.city);
        await ensureTaxonomy(db, 'neighborhoods', item.neighborhood);

        const doc = mapToPropertyDoc(item);
        const ref = await addDoc(collection(db, 'properties'), { ...doc, createdAt: new Date(), updatedAt: new Date() });
        console.log(`   + creada propiedad ${ref.id}`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
