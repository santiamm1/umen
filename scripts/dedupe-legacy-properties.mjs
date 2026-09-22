// Borra duplicados puntuales detectados al revisar la migración de umen.com.ar
// y hotelesenventa.com (mismo `code` en más de un documento). Casos, ya
// revisados a mano:
//
//  - TER-NUÑ-2: el mismo terreno quedó cargado 2 veces desde umen.com.ar.
//    Se mantiene el doc más nuevo (con geocoding y featured:true).
//  - AR-CA1-36 / AR-CA1-32 / AR-CA1-34: 3 hoteles quedaron cargados tanto
//    desde umen.com.ar (mal categorizados, ej. "Departamento - Semipiso")
//    como desde hotelesenventa.com (type "Hotel", la fuente correcta para
//    hoteles). Se mantiene la versión de hotelesenventa.com y se borra la de
//    umen.com.ar.
//
// Por defecto corre en modo DRY RUN (no borra nada).
// Para borrar de verdad en Firestore:   node scripts/dedupe-legacy-properties.mjs --commit

import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

const COMMIT = process.argv.includes('--commit');

const TO_DELETE = [
    { id: '1qHf01MqCxIp6Yhc4g61', reason: 'TER-NUÑ-2 duplicado (umen.com.ar) — se mantiene DzTuIztLA1XaY9uPgtKw' },
    { id: 'A67I7fqDzJy1PZ6YQwT7', reason: 'AR-CA1-36 duplicado (umen.com.ar) — se mantiene la versión de hotelesenventa.com' },
    { id: 'FbF24TOQMia1yOSB0cLx', reason: 'AR-CA1-32 duplicado (umen.com.ar) — se mantiene la versión de hotelesenventa.com' },
    { id: 'xcXrfdyu1L22s3bcYJmv', reason: 'AR-CA1-34 duplicado (umen.com.ar) — se mantiene la versión de hotelesenventa.com' }
];

async function main() {
    console.log(COMMIT ? 'MODO COMMIT: se va a borrar en Firestore.\n' : 'MODO DRY RUN (no se borra nada). Pasá --commit para borrar de verdad.\n');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log(`${TO_DELETE.length} propiedad(es) a borrar:\n`);
    const found = [];
    for (const item of TO_DELETE) {
        const snap = await getDoc(doc(db, 'properties', item.id));
        if (!snap.exists()) {
            console.log(` ! ${item.id} ya no existe (¿se borró antes?), se salta.`);
            continue;
        }
        const data = snap.data();
        console.log(` - [${data.code}] "${data.title}" (${item.id})`);
        console.log(`   motivo: ${item.reason}`);
        found.push(item);
    }

    if (!COMMIT) {
        console.log('\nDry run terminado. Corré con --commit para borrar de verdad.');
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

    for (const item of found) {
        await deleteDoc(doc(db, 'properties', item.id));
        console.log(` + borrada ${item.id}`);
    }

    console.log('\nListo.');
}

main().catch(err => {
    console.error('\nError:', err.message);
    process.exit(1);
});
