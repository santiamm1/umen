// cardFeatures.js - fila de datos (m², ambientes, baños/plazas) de las cards de propiedades.
// Solo se muestra lo que la propiedad realmente tiene cargado: nada de fallbacks
// inventados (un terreno sin ambientes no muestra "0 Amb.", una propiedad sin
// baños cargados no muestra "1 Baños"). Así cada tipo de propiedad (hotel,
// terreno, depto, cochera...) termina mostrando solo lo que le corresponde.

export function cardTypeStripHTML(p) {
    return p.type ? `<div class="card-type-strip">${p.type}</div>` : '';
}

export function cardCodeHTML(p) {
    return p.code ? `<div class="card-code">Cód. ${p.code}</div>` : '';
}

export function cardFeaturesHTML(p) {
    const items = [];
    if (p.surface) items.push(`<div class="feature-item"><i class="fas fa-ruler-combined"></i> ${p.surface} m²</div>`);
    if (p.bedrooms) items.push(`<div class="feature-item"><i class="fas fa-bed"></i> ${p.bedrooms} Amb.</div>`);
    if (p.type === 'Hotel') {
        if (p.plazas) items.push(`<div class="feature-item"><i class="fas fa-users"></i> ${p.plazas} Plazas</div>`);
    } else if (p.bathrooms) {
        items.push(`<div class="feature-item"><i class="fas fa-bath"></i> ${p.bathrooms} Baños</div>`);
    }
    return items.join('');
}
