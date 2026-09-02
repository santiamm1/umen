// Importa hoteles desde hotelesenventa.com (WordPress) a la categoría "Hotel" de UMEN.
// Cada propiedad creada guarda `externalUrl` apuntando a su ficha original en
// hotelesenventa.com; las cards de propiedades.html redirigen para allá en vez de
// abrir property-detail.html (ver js/propiedades.js).
//
// Por defecto corre en modo DRY RUN y trae solo 3 hoteles para probar.
// Para escribir de verdad en Firestore:      node scripts/import-hoteles-en-venta.mjs --commit
// Para traer todos (168 al momento de escribir esto): agregá --limit=999
//
// Ejemplos:
//   node scripts/import-hoteles-en-venta.mjs                       (dry run, 3 hoteles)
//   node scripts/import-hoteles-en-venta.mjs --commit               (importa 3 de verdad)
//   node scripts/import-hoteles-en-venta.mjs --commit --limit=999   (importa todos)

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

const SITE = 'https://hotelesenventa.com';
const COMMIT = process.argv.includes('--commit');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 3;

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

// "1.503" -> 1503 | "290.40" -> 290 (decimal, se descarta la parte fraccionaria de m2)
function parseSurfaceNumber(text) {
    const m = text.match(/\d[\d.,]*\d|\d/);
    if (!m) return null;
    const normalized = m[0].replace(/[.,](\d{1,2})$/, '.$1').replace(/[.,](?=\d{3})/g, '');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? Math.round(n) : null;
}

// Slug de taxonomía tipo "capital-federal" -> "Capital Federal"
function prettifySlug(slug) {
    if (!slug) return '';
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function taxonomyFromClassList(classList, prefix) {
    const cls = (classList || []).find(c => c.startsWith(prefix));
    return cls ? prettifySlug(cls.slice(prefix.length)) : '';
}

function extractPrice(html) {
    const m = html.match(/<h1 class="preciohotel">([\s\S]*?)<\/h1>/);
    const text = stripTags(m ? m[1] : '');
    if (!text || /consultar/i.test(text)) return { amount: 0, consultar: true };
    const digits = text.replace(/[^\d]/g, '');
    return { amount: digits ? parseInt(digits, 10) : 0, consultar: false };
}

function extractOperation(html) {
    const m = html.match(/<h3 class="tipohotel">([\s\S]*?)<\/h3>/);
    const text = stripTags(m ? m[1] : '');
    const label = text.split(':')[0].trim().toLowerCase();
    return label === 'alquiler' ? 'alquiler' : 'venta';
}

function extractDatosHotel(html) {
    const m = html.match(/<div class="datoshotel">([\s\S]*?)<\/div>\s*<\/div>/);
    const block = m ? m[1] : '';
    const items = [...block.matchAll(/<p[^>]*>([^<]+)<\/p>/g)].map(x => decodeEntities(x[1]).trim());

    // La cantidad de unidades siempre va en <p class="fa hab">, sea "Habitaciones",
    // "Unidades" o "Cabañas" según el tipo de hotel.
    const unidadesMatch = block.match(/<p class="fa hab">([^<]+)<\/p>/);
    const construida = items.find(t => /construida/i.test(t));
    const terreno = items.find(t => /terreno/i.test(t));

    return {
        rooms: parseSurfaceNumber(unidadesMatch ? unidadesMatch[1] : ''),
        surface: parseSurfaceNumber(construida || terreno || '')
    };
}

async function scrapeOne(item) {
    const res = await fetch(item.link);
    const html = await res.text();

    const price = extractPrice(html);
    const { rooms, surface } = extractDatosHotel(html);
    const image = item.yoast_head_json?.og_image?.[0]?.url || '';

    return {
        code: `HEV-${item.id}`,
        title: decodeEntities(item.title.rendered),
        status: 'Publicado',
        price: price.amount,
        consultarPrecio: price.consultar,
        currency: 'USD',
        type: 'Hotel',
        operation: extractOperation(html),
        pais: 'Argentina',
        provincia: taxonomyFromClassList(item.class_list, 'provincia-'),
        zone: taxonomyFromClassList(item.class_list, 'ciudad-'),
        neighborhood: '',
        description: stripTags(item.content.rendered).slice(0, 500),
        surface: surface || 0,
        bedrooms: rooms || 0,
        bathrooms: 0,
        garage: 0,
        images: image ? [image] : [],
        externalUrl: item.link
    };
}

async function ensureTaxonomy(db, collectionName, name) {
    if (!name) return;
    const q = query(collection(db, collectionName), where('name', '==', name));
    const snap = await getDocs(q);
    if (!snap.empty) return;
    await addDoc(collection(db, collectionName), { name });
    console.log(`   + agregado "${name}" a "${collectionName}"`);
}

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para importar de verdad.\n');
    console.log(`Trayendo ${LIMIT} hotel(es) de ${SITE}...\n`);

    const listRes = await fetch(`${SITE}/wp-json/wp/v2/hotel?per_page=${LIMIT}`);
    const list = await listRes.json();

    const results = [];
    for (const item of list) {
        console.log(` - ${item.slug}`);
        results.push(await scrapeOne(item));
    }

    if (!COMMIT) {
        console.log('');
        for (const doc of results) {
            console.log(`\n${doc.title}`);
            console.log('   ', JSON.stringify({
                code: doc.code, price: doc.price, consultarPrecio: doc.consultarPrecio,
                operation: doc.operation, provincia: doc.provincia, zone: doc.zone,
                surface: doc.surface, bedrooms: doc.bedrooms, images: doc.images.length,
                externalUrl: doc.externalUrl
            }));
        }
        console.log('\nDry run terminado (no se tocó Firestore). Revisá arriba y corré con --commit para importar de verdad.');
        return;
    }

    const email = process.env.ADMIN_EMAIL || await createInterface({ input: process.stdin, output: process.stdout }).question('Email admin: ');
    const password = process.env.ADMIN_PASSWORD || await createInterface({ input: process.stdin, output: process.stdout }).question('Password: ');

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    console.log('\nIniciando sesión...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('Sesión OK.\n');

    for (const doc of results) {
        const existing = await getDocs(query(collection(db, 'properties'), where('code', '==', doc.code)));
        if (!existing.empty) {
            console.log(`= "${doc.title}" (${doc.code}) ya existe, se salta.`);
            continue;
        }

        console.log(`\n${doc.title}`);
        await ensureTaxonomy(db, 'provinces', doc.provincia);
        await ensureTaxonomy(db, 'cities', doc.zone);

        const ref = await addDoc(collection(db, 'properties'), { ...doc, createdAt: new Date(), updatedAt: new Date() });
        console.log(`   + creada propiedad ${ref.id}`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
