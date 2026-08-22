// Carga notas de blog nuevas en Firestore (colección 'blogPosts'), mismo esquema
// que usa admin-dashboard.js: title, slug, excerpt, body, category, image, authorName, authorRole.
// node scripts/add-blog-posts.mjs   (pide ADMIN_EMAIL/ADMIN_PASSWORD por variable de entorno)

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

const POSTS = [
    {
        title: 'Invertir en hoteles boutique: por qué Buenos Aires vuelve a estar en el radar',
        slug: 'invertir-en-hoteles-boutique-buenos-aires-en-el-radar',
        category: 'Inversiones',
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        excerpt: 'La recuperación del turismo y la escasez de oferta hotelera de escala boutique reabrieron el interés de los inversores por este segmento.',
        authorName: 'Equipo Umen',
        authorRole: 'Especialistas en hoteles',
        body: "Después de varios años de retracción, el mercado hotelero porteño vuelve a mostrar señales claras de reactivación. La suba sostenida en la ocupación de hoteles boutique y aparts en barrios como Almagro, Recoleta y Palermo renovó el interés de inversores que buscan alternativas de renta en dólares.\n\nA diferencia de los grandes complejos hoteleros, los establecimientos de 15 a 30 habitaciones tienen menores costos de operación y una gestión más simple, lo que los vuelve especialmente atractivos para inversores que buscan diversificar sin asumir la complejidad de una cadena hotelera tradicional.\n\nA esto se suma un factor estructural: la oferta de hoteles en venta con buena ubicación y funcionando es escasa, lo que sostiene los valores y acorta los tiempos de negociación para quienes ya tienen el capital disponible. Para quienes evalúan ingresar al negocio hotelero, el momento actual combina precios de entrada todavía razonables con una demanda turística en franca recuperación."
    },
    {
        title: 'Núñez y Belgrano: el corredor norte vuelve a concentrar la demanda',
        slug: 'nunez-belgrano-corredor-norte-demanda',
        category: 'Tendencias',
        image: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        excerpt: 'Cercanía a la General Paz, buena conectividad y una oferta de oficinas y departamentos en constante renovación explican el atractivo de la zona.',
        authorName: 'Equipo Umen',
        authorRole: 'Asesores Inmobiliarios',
        body: "El corredor que va de Núñez a Belgrano se consolidó en los últimos años como uno de los destinos preferidos tanto para vivienda como para uso comercial y de oficinas. La avenida Cabildo funciona como columna vertebral de la zona, concentrando desde locales y oficinas de baja escala hasta desarrollos residenciales de categoría.\n\nLa cercanía a la General Paz y a los accesos que conectan con el corredor norte del GBA la convierten en una opción intermedia muy valorada: ofrece la infraestructura y los servicios de la Ciudad sin perder practicidad para quienes se mueven hacia zona norte a diario.\n\nEn paralelo, la renovación edilicia de la zona —con reciclados de oficinas y nuevos desarrollos de pozo— mantiene activa la demanda tanto de compradores finales como de inversores que buscan renta estable en un barrio consolidado, con buena liquidez a la hora de revender o alquilar."
    }
];

async function main() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        console.error('Faltan ADMIN_EMAIL / ADMIN_PASSWORD como variables de entorno.');
        process.exit(1);
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    await signInWithEmailAndPassword(auth, email, password);

    for (const post of POSTS) {
        const existing = await getDocs(query(collection(db, 'blogPosts'), where('slug', '==', post.slug)));
        if (!existing.empty) {
            console.log(`= "${post.title}" ya existe, se salta.`);
            continue;
        }
        const ref = await addDoc(collection(db, 'blogPosts'), { ...post, createdAt: new Date() });
        console.log(`+ creada: ${post.title} (${ref.id})`);
    }
    console.log('\nListo.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
