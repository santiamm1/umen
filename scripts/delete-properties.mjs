// Borra propiedades por ID de Firestore. Uso puntual para deshacer duplicados.
// node scripts/delete-properties.mjs id1 id2 id3 ...
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDw30av8qmGjZg9-xeOvPp4o5MILHPDYoI",
    authDomain: "umen-dev.firebaseapp.com",
    projectId: "umen-dev",
    storageBucket: "umen-dev.firebasestorage.app",
    messagingSenderId: "773651890001",
    appId: "1:773651890001:web:5163ff0f4d544e43f21d70"
};

const ids = process.argv.slice(2);
if (ids.length === 0) {
    console.error('Uso: node scripts/delete-properties.mjs id1 id2 ...');
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

await signInWithEmailAndPassword(auth, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);

for (const id of ids) {
    await deleteDoc(doc(db, 'properties', id));
    console.log('borrada:', id);
}
process.exit(0);
