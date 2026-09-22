// Solo lectura: compara scripts/output/old-properties.json (sitio viejo, recién
// scrapeado) contra lo que hay hoy en Firestore. Reporta qué falta importar y
// qué propiedades ya importadas del sitio viejo tienen la descripción vacía.
//
// Uso: node scripts/check-legacy-sync.mjs

import { readFile } from 'node:fs/promises';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

async function main() {
    const raw = await readFile(new URL('./output/old-properties.json', import.meta.url), 'utf-8');
    const scraped = JSON.parse(raw);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snap = await getDocs(collection(db, 'properties'));
    const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const byCode = new Map(existing.filter(p => p.code).map(p => [p.code.toLowerCase(), p]));
    const bySlug = new Map(existing.filter(p => p.legacySlug).map(p => [p.legacySlug, p]));

    const missing = [];
    const needsDescription = [];

    for (const item of scraped) {
        const match = (item._code && byCode.get(item._code.toLowerCase())) || bySlug.get(item.slug);
        if (!match) {
            missing.push(item);
            continue;
        }
        if (!match.description && item.description) {
            needsDescription.push({ id: match.id, title: match.title, code: match.code, newDescription: item.description });
        }
    }

    console.log(`Firestore: ${existing.length} propiedades totales.`);
    console.log(`Sitio viejo (scrapeado): ${scraped.length} propiedades.\n`);

    console.log(`=== Faltan importar (${missing.length}) ===`);
    missing.forEach(m => console.log(`   - [${m._code}] ${m.title} (${m.slug})`));

    console.log(`\n=== Ya existen pero sin descripción (${needsDescription.length}) ===`);
    needsDescription.forEach(m => console.log(`   - [${m.code}] ${m.title} -> "${m.newDescription}"`));
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
