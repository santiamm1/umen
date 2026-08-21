// Scrapea las propiedades del sitio anterior (umen.com.ar, WordPress + Toolset)
// y las deja listas en scripts/output/old-properties.json para revisar/importar.
// Es de solo lectura: no escribe nada en el sitio viejo ni en Firestore.
//
// Uso: node scripts/scrape-old-properties.mjs

const SITE = 'https://umen.com.ar';
const OUT_DIR = new URL('./output/', import.meta.url);

async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
}

async function getAllPages(path) {
    const first = await fetch(`${SITE}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=1`);
    const totalPages = parseInt(first.headers.get('x-wp-totalpages') || '1');
    let items = await first.json();
    for (let page = 2; page <= totalPages; page++) {
        items = items.concat(await getJSON(`${SITE}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`));
    }
    return items;
}

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

function parsePriceText(text) {
    if (!text) return { raw: '', amount: null, currency: null };
    const clean = text.trim();
    const currency = /u\$s/i.test(clean) ? 'USD' : (/\$/.test(clean) ? 'ARS' : null);
    const digits = clean.replace(/[^\d]/g, '');
    return { raw: clean, amount: digits ? parseInt(digits, 10) : null, currency };
}

async function fetchTaxonomyMap(taxonomy) {
    const terms = await getAllPages(`/wp-json/wp/v2/${taxonomy}`);
    const map = new Map();
    for (const t of terms) map.set(t.id, t.name);
    return map;
}

function extractSpecs(html) {
    const specs = {};
    const re = /<span class="elementor-icon-list-text"><strong>([^<]+):<\/strong>\s*([^<]*)<\/span>/g;
    let m;
    while ((m = re.exec(html))) {
        specs[decodeEntities(m[1]).trim()] = decodeEntities(m[2]).trim();
    }
    return specs;
}

function extractPrice(html) {
    const m = html.match(/id="precio_ficha_prop"[^>]*>\s*<p[^>]*>([^<]*)<\/p>/);
    return parsePriceText(m ? m[1] : '');
}

function extractCode(html) {
    const m = html.match(/C[oó]digo de la propiedad:\s*([A-Za-z0-9-]+)/);
    return m ? m[1] : null;
}

function extractImages(html) {
    const re = /<a href="(https:\/\/umen\.com\.ar\/wp-content\/uploads\/[^"]+)" data-lightbox="/g;
    const urls = new Set();
    let m;
    while ((m = re.exec(html))) urls.add(m[1]);
    return [...urls];
}

// "452" -> 452 | "1.234" (3 dígitos = separador de miles) -> 1234 | "316.96" (1-2 dígitos = decimal) -> 317
function parseAmbiguousNumber(text) {
    const m = text.match(/[\d.,]+/);
    if (!m) return null;
    const sep = m[0].match(/[.,](\d+)$/);
    const isDecimal = sep && sep[1].length <= 2;
    const normalized = isDecimal
        ? m[0].slice(0, -sep[0].length) + '.' + sep[1]
        : m[0].replace(/[.,]/g, '');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? Math.round(n) : null;
}

function surfaceFromSpecs(specs) {
    const find = (label) => {
        const key = Object.keys(specs).find(k => k.toLowerCase().includes(label));
        return key ? parseAmbiguousNumber(specs[key]) : null;
    };
    return find('cubierta') || find('total') || null;
}

function numberFromSpecs(specs, ...labels) {
    for (const label of labels) {
        const key = Object.keys(specs).find(k => k.toLowerCase().includes(label));
        if (key) {
            const n = parseAmbiguousNumber(specs[key]);
            if (n !== null) return n;
        }
    }
    return null;
}

async function scrapeOne(item, taxMaps) {
    const detailRes = await fetch(item.link);
    const html = await detailRes.text();

    const specs = extractSpecs(html);
    const price = extractPrice(html);

    const typeNames = (item['tipo-de-propiedad'] || []).map(id => taxMaps.tipo.get(id)).filter(Boolean);
    const opNames = (item['tipo-de-operacion'] || []).map(id => taxMaps.op.get(id)).filter(Boolean);
    const barrioNames = (item['barrio'] || []).map(id => taxMaps.barrio.get(id)).filter(Boolean);
    const ciudadNames = (item['ciudad'] || []).map(id => taxMaps.ciudad.get(id)).filter(Boolean);
    const provinciaNames = (item['provincia'] || []).map(id => taxMaps.provincia.get(id)).filter(Boolean);

    return {
        _source: item.link,
        _code: extractCode(html),
        title: decodeEntities(item.title.rendered),
        slug: item.slug,
        description: stripTags(item.content.rendered),
        price: price.amount,
        priceCurrency: price.currency,
        priceRaw: price.raw,
        type: typeNames[0] || null,
        operation: opNames[0] ? opNames[0].toLowerCase() : null,
        province: provinciaNames[0] || null,
        city: ciudadNames[0] || null,
        neighborhood: barrioNames[0] || null,
        surface: surfaceFromSpecs(specs),
        bedrooms: numberFromSpecs(specs, 'dormitor', 'habitac', 'ambiente'),
        bathrooms: numberFromSpecs(specs, 'baño'),
        garage: numberFromSpecs(specs, 'cochera', 'garage'),
        specsRaw: specs,
        images: extractImages(html)
    };
}

async function main() {
    console.log('Descargando taxonomías...');
    const taxMaps = {
        tipo: await fetchTaxonomyMap('tipo-de-propiedad'),
        op: await fetchTaxonomyMap('tipo-de-operacion'),
        barrio: await fetchTaxonomyMap('barrio'),
        ciudad: await fetchTaxonomyMap('ciudad'),
        provincia: await fetchTaxonomyMap('provincia')
    };

    console.log('Descargando listado de propiedades...');
    const list = await getAllPages('/wp-json/wp/v2/propiedad');
    console.log(`${list.length} propiedades encontradas. Extrayendo detalle de cada una...`);

    const results = [];
    for (const item of list) {
        console.log(` - ${item.slug}`);
        try {
            results.push(await scrapeOne(item, taxMaps));
        } catch (err) {
            console.error(`   ERROR: ${err.message}`);
        }
    }

    await import('node:fs/promises').then(fs => fs.mkdir(OUT_DIR, { recursive: true }));
    const fs = await import('node:fs/promises');
    await fs.writeFile(new URL('old-properties.json', OUT_DIR), JSON.stringify(results, null, 2));

    const missing = results.filter(r => !r.price || !r.type || !r.operation);
    console.log(`\nListo: ${results.length} propiedades en scripts/output/old-properties.json`);
    if (missing.length) {
        console.log(`Atención: ${missing.length} propiedad(es) con datos incompletos (revisar precio/tipo/operación):`);
        missing.forEach(m => console.log(`   - ${m.slug}`));
    }
}

main();
