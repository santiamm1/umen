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
    if (p.type === 'Hotel') {
        const items = [];
        if (p.surface) items.push(`<div class="feature-item"><i class="fas fa-ruler-combined"></i> ${p.surface} m²</div>`);
        if (p.bedrooms) items.push(`<div class="feature-item"><i class="fas fa-bed"></i> ${p.bedrooms} Amb.</div>`);
        if (p.plazas) items.push(`<div class="feature-item"><i class="fas fa-users"></i> ${p.plazas} Plazas</div>`);
        return items.join('');
    }

    // Mismo orden de prioridad que la barra de stats de la ficha (propertyDetail.js).
    const candidates = [
        p.surface && `<i class="fas fa-ruler-combined"></i> ${p.surface} m²`,
        p.supVendibleDest && `<i class="fas fa-ruler-combined"></i> ${p.supVendibleDest} m² vend.`,
        p.bedrooms && `<i class="fas fa-bed"></i> ${p.bedrooms} Amb.`,
        p.bathrooms && `<i class="fas fa-bath"></i> ${p.bathrooms} Baños`,
        p.garage && `<i class="fas fa-car"></i> ${p.garage} Cocheras`,
        p.toilette && `<i class="fas fa-toilet"></i> ${p.toilette} Toilette`,
        p.pisos && `<i class="fas fa-building"></i> Piso ${p.pisos}`,
        p.antiguedad != null && p.antiguedad !== '' && `<i class="fas fa-calendar-alt"></i> ${p.antiguedad} años`,
        p.estadoConservacion && `<i class="fas fa-certificate"></i> ${p.estadoConservacion}`,
    ].filter(Boolean);

    // Solo los primeros 3 campos destacados que la propiedad tenga cargados.
    return candidates.slice(0, 3).map(html => `<div class="feature-item">${html}</div>`).join('');
}
