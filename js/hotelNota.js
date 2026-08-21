// hotelNota.js - Nota individual de contenido de hoteles (linkea al catálogo en Hoteles en Venta)

import { getHotelNote, getHotelNoteBySlug } from './propertyService.js';

const container = document.getElementById('hotel-nota');
const params = new URLSearchParams(window.location.search);
const slug   = params.get('slug');
const noteId = params.get('id'); // compatibilidad con links viejos ?id=

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

(async () => {
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    let note = null;
    if (slug) note = await getHotelNoteBySlug(slug);
    else if (noteId) note = await getHotelNote(noteId);

    if (note) render(note); else showNotFound();
})();

function render(note) {
    document.title = `${note.title} | UMEN Buenos Negocios Inmobiliarios`;
    container.innerHTML = `
        <div class="detail-container hotel-nota-wrap">
        <div class="hotel-nota-media">
            <img src="${note.image || FALLBACK_IMG}" alt="${note.title}">
            <span class="cat">${note.region || 'Hoteles'}</span>
        </div>
        <div class="hotel-nota-article">
            <h1>${note.title}</h1>
            ${note.excerpt ? `<p class="hotel-nota-excerpt">${note.excerpt}</p>` : ''}
            <div class="hotel-nota-body">${renderBody(note.body)}</div>
            ${note.externalUrl ? `
                <div class="content-btn" style="margin-top:32px">
                    <a href="${note.externalUrl}" target="_blank" rel="noopener" class="btn">
                        Ver hoteles en ${note.region || 'Hoteles en Venta'} <i class="fas fa-arrow-right" style="margin-left:8px"></i>
                    </a>
                </div>
            ` : ''}
        </div>
        </div>
    `;
}

// Normaliza "\n" literales (pegados desde texto plano) además de saltos de línea reales
function renderBody(body) {
    return (body || '')
        .replace(/\\n/g, '\n')
        .split(/\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${p}</p>`)
        .join('');
}

function showNotFound() {
    container.innerHTML = `
        <div class="detail-container">
            <div class="no-results">
                <i class="fas fa-search-minus"></i>
                <p>No encontramos esta nota.</p>
                <div class="content-btn" style="margin-top:24px">
                    <a href="propiedades.html" class="btn">Volver a Propiedades</a>
                </div>
            </div>
        </div>
    `;
}
