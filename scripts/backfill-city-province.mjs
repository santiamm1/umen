// Asigna la provincia (y localidad → provincia) de cada ciudad ya cargada en
// Firestore, para poder filtrar Ciudad/Localidad en cascada según la
// Provincia elegida en el alta/edición de propiedades (antes eran listas
// planas sin relación con la provincia, por eso al elegir "Capital Federal"
// aparecían igual "El Bolsón" o "Punta del Este").
//
// El mapeo es manual (geografía real), armado a partir del dump real de las
// colecciones "cities"/"localities"/"provinces" en umen-dev. Dos ciudades
// quedan sin asignar por ser ambiguas entre dos provincias homónimas
// ("Merlo": San Luis o Buenos Aires; "La Ramada": Córdoba o San Luis) — se
// asignan a mano desde el panel de admin si hace falta.
//
// Por defecto corre en modo DRY RUN (no escribe nada).
// Para escribir de verdad en Firestore:   node scripts/backfill-city-province.mjs --commit

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

const CITY_PROVINCE = {
    'villa la angostura': 'Neuquén', 'trelew': 'Chubut', 'punta del este': 'Maldonado',
    'rivera': 'Rivera', 'parana': 'Entre Ríos', 'monte hermoso': 'Buenos Aires',
    'obera': 'Misiones', 'concon': 'Valparaiso', 'esquina': 'Corrientes',
    'sierra de la ventana': 'Buenos Aires', 'el trapiche': 'San Luis',
    'san miguel del monte': 'Buenos Aires', 'las grutas': 'Río Negro',
    'ameghino': 'Buenos Aires', 'neuquen capital': 'Neuquén',
    'san antonio de areco': 'Buenos Aires', 'san juan': 'San Juan',
    'balvanera': 'Ciudad Autónoma de Buenos Aires',
    'mar de las pampas': 'Buenos Aires', 'caballito': 'Ciudad Autónoma de Buenos Aires',
    'tolhuin': 'Tierra del Fuego', 'guaratuba': 'Parana',
    'colonia carlos pellegrini': 'Corrientes', 'embalse': 'Córdoba',
    'bariloche': 'Río Negro', 'almagro': 'Ciudad Autónoma de Buenos Aires',
    'constitucion': 'Ciudad Autónoma de Buenos Aires', 'san clemente del tuyu': 'Buenos Aires',
    'sunchales': 'Santa Fe', 'villa carlos paz': 'Córdoba', 'el bolson': 'Río Negro',
    'potrero de los funes': 'San Luis', 'lujan': 'Buenos Aires', 'trevelin': 'Chubut',
    'partido villa gesell': 'Buenos Aires', 'termas de rio hondo': 'Santiago del Estero',
    'las rosas': 'Santa Fe', 'los molinos': 'Córdoba', 'gualeguaychu': 'Entre Ríos',
    'baradero': 'Buenos Aires', 'san cristobal': 'Ciudad Autónoma de Buenos Aires',
    'federacion': 'Entre Ríos', 'mar de ajo': 'Buenos Aires', 'el soberbio': 'Misiones',
    'san nicolas': 'Buenos Aires', 'gba norte': 'Buenos Aires', 'puerto iguazu': 'Misiones',
    'villa cura brochero': 'Córdoba', 'cruz del eje': 'Córdoba', 'la falda': 'Córdoba',
    'buzios': 'Rio De Janeiro', 'mina clavero': 'Córdoba', 'empedrado': 'Corrientes',
    'rama caida': 'Mendoza', 'capital federal': 'Ciudad Autónoma de Buenos Aires',
    'lago puelo': 'Chubut', 'villa gesell': 'Buenos Aires', 'la cumbre': 'Córdoba',
    'san bernardo': 'Buenos Aires', 'colon': 'Entre Ríos', 'ubatuba': 'San Pablo',
    'tandil': 'Buenos Aires', 'la plata': 'Buenos Aires', 'general roca': 'Río Negro',
    'ituzaingo': 'Buenos Aires', 'valle hermoso': 'Córdoba', 'villa ballester': 'Buenos Aires',
    'itaguai': 'Rio De Janeiro', 'orense': 'Buenos Aires', 'los reartes': 'Córdoba',
    'bardas blancas': 'Mendoza', 'villa general belgrano': 'Córdoba', 'tanti': 'Córdoba',
    'cerrito': 'Entre Ríos', 'realico': 'La Pampa', 'centro': 'Ciudad Autónoma de Buenos Aires',
    'los molles': 'Mendoza', 'el calafate': 'Santa Cruz', 'chapadmalal': 'Buenos Aires',
    'salta': 'Salta', 'colalao del valle': 'Tucumán', 'las gaviotas': 'Buenos Aires',
    'tigre': 'Buenos Aires', 'lincoln': 'Buenos Aires', 'bahia blanca': 'Buenos Aires',
    'capilla del monte': 'Córdoba', 'las rabonas': 'Córdoba', 'monserrat': 'Ciudad Autónoma de Buenos Aires',
    'mar del plata': 'Buenos Aires', 'tafi del valle': 'Tucumán', 'canuelas': 'Buenos Aires',
    'gba oeste': 'Buenos Aires', 'chascomus': 'Buenos Aires', 'cosquin': 'Córdoba',
    'ushuaia': 'Tierra del Fuego', 'santiago del estero capital': 'Santiago del Estero',
    'corrientes capital': 'Corrientes', 'bialet masse': 'Córdoba', 'gba sur': 'Buenos Aires',
    'morteros': 'Córdoba', 'costa azul': 'Buenos Aires', 'san antonio de arredondo': 'Córdoba',
    'nono': 'Córdoba', 'moron': 'Buenos Aires', 'dina huapi': 'Río Negro',
    'san esteban': 'Córdoba', 'villa pehuenia': 'Neuquén', 'villa traful': 'Neuquén',
    'santa teresita': 'Buenos Aires', 'victoria': 'Entre Ríos', 'rawson': 'Chubut'
};

const LOCALITY_PROVINCE = {
    'capital federal': 'Ciudad Autónoma de Buenos Aires', 'moreno': 'Buenos Aires',
    'san isidro': 'Buenos Aires', 'san fernando': 'Buenos Aires', 'avellaneda': 'Buenos Aires',
    'san martín': 'Buenos Aires', 'tres de febrero': 'Buenos Aires', 'lanús': 'Buenos Aires',
    'lomas de zamora': 'Buenos Aires', 'vicente lópez': 'Buenos Aires', 'quilmes': 'Buenos Aires',
    'ituzaingó': 'Buenos Aires', 'morón': 'Buenos Aires', 'pilar': 'Buenos Aires',
    'berazategui': 'Buenos Aires', 'tigre': 'Buenos Aires', 'gran buenos aires': 'Buenos Aires'
};

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a escribir en Firestore.\n' : 'MODO DRY RUN (no se escribe nada). Pasá --commit para aplicar de verdad.\n');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const provincesSnap = await getDocs(collection(db, 'provinces'));
    const provinceNames = new Set(provincesSnap.docs.map(d => d.data().name));

    async function planFor(collectionName, map) {
        const snap = await getDocs(collection(db, collectionName));
        const plan = [];
        const unrecognized = [];
        snap.forEach(d => {
            const data = d.data();
            const name = (data.name || '').toLowerCase().trim();
            const provincia = map[name];
            if (!provincia) { unrecognized.push(data.name); return; }
            if (!provinceNames.has(provincia)) { console.warn(`ADVERTENCIA: la provincia "${provincia}" (para "${data.name}") no existe en la colección "provinces".`); return; }
            if (data.provincia !== provincia) plan.push({ id: d.id, name: data.name, provincia });
        });
        return { plan, unrecognized };
    }

    const { plan: cityPlan, unrecognized: cityUnrecognized } = await planFor('cities', CITY_PROVINCE);
    const { plan: localityPlan, unrecognized: localityUnrecognized } = await planFor('localities', LOCALITY_PROVINCE);

    console.log(`Ciudades a actualizar: ${cityPlan.length}`);
    console.log(`Localidades a actualizar: ${localityPlan.length}`);
    if (cityUnrecognized.length) console.log(`\nCiudades sin mapeo (quedan sin provincia, asignar a mano): ${cityUnrecognized.join(', ')}`);
    if (localityUnrecognized.length) console.log(`Localidades sin mapeo: ${localityUnrecognized.join(', ')}`);

    if (cityPlan.length === 0 && localityPlan.length === 0) {
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

    for (const c of cityPlan) {
        await updateDoc(doc(db, 'cities', c.id), { provincia: c.provincia });
        console.log(` + ${c.name} -> ${c.provincia}`);
    }
    for (const l of localityPlan) {
        await updateDoc(doc(db, 'localities', l.id), { provincia: l.provincia });
        console.log(` + ${l.name} -> ${l.provincia}`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
