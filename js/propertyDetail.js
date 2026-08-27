// propertyDetail.js - Detalle de propiedad premium UMEN

import { getProperty } from './propertyService.js?v=3';

const container = document.getElementById('property-detail');
const urlParams  = new URLSearchParams(window.location.search);
const propertyId = urlParams.get('id');

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

let galleryImages   = [];
let currentGalleryIdx = 0;

// ── Init ──────────────────────────────────────────────────────────────────────
// Los módulos ES son diferidos: el DOM ya está listo cuando este código corre.
// No usar DOMContentLoaded — puede perderse si Firebase CDN tarda más que el módulo local.

(async () => {
    // Esperar hasta 2.5s a que el header partial sea inyectado
    let headerAttempts = 0;
    while (!document.getElementById('header') && headerAttempts < 50) {
        await new Promise(r => setTimeout(r, 50));
        headerAttempts++;
    }
    const header = document.getElementById('header');
    if (header) {
        const handleHeaderScroll = () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        };
        window.addEventListener('scroll', handleHeaderScroll);
        handleHeaderScroll();
    }

    // Esperar hasta 3s a que Firebase inicialice (el inline module puede llegar después)
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    const firebaseReady = window.db && window.db._databaseId?.projectId !== 'TU_PROJECT_ID_AQUI';

    if (propertyId && firebaseReady) {
        try {
            const property = await getProperty(propertyId);
            if (property) render(property);
            else showDemo();
        } catch {
            showDemo();
        }
    } else {
        showDemo();
    }

    // Teclado: flechas para navegar lightbox
    document.addEventListener('keydown', e => {
        const lb = document.getElementById('lightbox');
        if (!lb?.classList.contains('open')) return;
        if (e.key === 'ArrowLeft')  lightboxNav(-1);
        if (e.key === 'ArrowRight') lightboxNav(1);
        if (e.key === 'Escape')     closeLightbox();
    });
})();

// ── Demo ──────────────────────────────────────────────────────────────────────

function showDemo() {
    render({
        title: 'Exclusivo Semipiso sobre Av. Alvear',
        price: 780000,
        type: 'deptos',
        operation: 'venta',
        province: 'Buenos Aires',
        zone: 'Capital Federal',
        neighborhood: 'Recoleta',
        surface: 240,
        bedrooms: 4,
        bathrooms: 3,
        garage: 2,
        year: 2015,
        condition: 'Reciclado a nuevo',
        features: ['Calefacción Central', 'Seguridad 24hs', 'Balcón Terraza', 'Baulera', 'Piscina', 'Gimnasio', 'SUM', 'Lavandería', 'Cochera fija'],
        description: 'Exclusivo semipiso de categoría sobre la distinguida Avenida Alvear, en el corazón de Recoleta. Totalmente reciclado con materiales de primera calidad. Cuenta con palier privado, gran recepción de living y comedor con salida a balcón corrido al frente, toilette de recepción. Cuatro amplios dormitorios (dos en suite), cocina comedor diario totalmente equipada, lavadero independiente. Cochera doble fija y seguridad las 24 horas.',
        images: [
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        ]
    });
}

// ── Render principal ──────────────────────────────────────────────────────────

function render(property) {
    document.title = `${property.title} | UMEN Inmobiliaria`;

    galleryImages = property.images?.length > 0 ? [...property.images] : [FALLBACK_IMG];
    currentGalleryIdx = 0;

    const opLabel   = property.operation === 'venta' ? 'Venta' : 'Alquiler';
    const typeLabel = getTypeLabel(property.type);
    const location  = [property.neighborhood, property.zone].filter(Boolean).join(', ');
    const mapQuery  = encodeURIComponent([property.neighborhood, property.zone, 'Argentina'].filter(Boolean).join(', '));
    const codeLabel = property.code ? ` (Cód. ${property.code})` : '';
    const waMsg     = encodeURIComponent(`Hola UMEN, vi la propiedad "${property.title}"${codeLabel} y me gustaría recibir más información.`);
    const waUrl     = `https://wa.me/5491131444207?text=${waMsg}`;
    const pricePerM2 = property.surface > 0 ? Math.round(property.price / property.surface) : null;

    container.innerHTML = `
        <div class="detail-container">

            <!-- ── Breadcrumb ─────────────────────────────────── -->
            <div class="detail-breadcrumb">
                <a href="/">Inicio</a>
                <i class="fas fa-chevron-right"></i>
                <a href="propiedades.html?v=3">Propiedades</a>
                <i class="fas fa-chevron-right"></i>
                <span>${property.title}</span>
            </div>

            <!-- ── Encabezado: título + precio + compartir ─────── -->
            <div class="detail-header-row">
                <div class="detail-header-info">
                    <span class="detail-badge">${opLabel}</span>
                    ${property.tag ? `<span class="detail-badge detail-badge-tag">${property.tag}</span>` : ''}
                    <h1 class="detail-title">${property.title}</h1>
                    <p class="detail-location">
                        <i class="fas fa-map-marker-alt"></i> ${location}
                        ${property.code ? `<span class="detail-code">Cód. ${property.code}</span>` : ''}
                    </p>
                </div>
                <div class="detail-header-right">
                    <div class="detail-price-box">
                        <span class="price-label">Valor de ${opLabel}</span>
                        <span class="price-value">${currencyLabel(property.currency)} ${property.price.toLocaleString()}${property.operation === 'alquiler' ? ' <span class="price-period">/mes</span>' : ''}</span>
                        ${pricePerM2 ? `<span class="price-sqm">${pricePerM2.toLocaleString()} ${currencyLabel(property.currency)}/m²</span>` : ''}
                    </div>
                    <div class="detail-share">
                        <a href="${waUrl}" target="_blank" class="share-btn share-wa" title="WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </a>
                        <button class="share-btn share-link" title="Copiar enlace" onclick="copyPropertyLink()">
                            <i class="fas fa-link"></i>
                        </button>
                        <button class="share-btn share-print" title="Imprimir" onclick="window.print()">
                            <i class="fas fa-print"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- ── Galería: principal + secundarias ──────────── -->
            <div class="detail-gallery${galleryImages.length <= 1 ? ' gallery-single' : ''}">

                <!-- Foto principal -->
                <div class="main-image-container" onclick="openLightbox()">
                    <img src="${galleryImages[0]}" id="main-detail-image" alt="${property.title}">
                    <span class="gallery-counter" id="gallery-counter">1 / ${galleryImages.length}</span>
                    ${galleryImages.length > 1 ? `
                    <button class="gallery-nav-btn gallery-prev" onclick="event.stopPropagation(); navGallery(-1)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="gallery-nav-btn gallery-next" onclick="event.stopPropagation(); navGallery(1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>` : ''}
                    <div class="gallery-expand-hint">
                        <i class="fas fa-expand-alt"></i> Ver todas las fotos
                    </div>
                </div>

                <!-- Foto secundaria 1 -->
                ${galleryImages.length > 1 ? `
                <div class="gallery-secondary${galleryImages.length === 2 ? ' gallery-secondary-full' : ''}"
                     onclick="goToGalleryImage(1); openLightbox();">
                    <img src="${galleryImages[1]}" alt="Vista 2" loading="lazy">
                </div>` : ''}

                <!-- Foto secundaria 2 + overlay "+N" si hay más -->
                ${galleryImages.length > 2 ? `
                <div class="gallery-secondary" onclick="goToGalleryImage(2); openLightbox();">
                    <img src="${galleryImages[2]}" alt="Vista 3" loading="lazy">
                    ${galleryImages.length > 3 ? `
                    <div class="gallery-more">
                        +${galleryImages.length - 3}
                        <span>más fotos</span>
                    </div>` : ''}
                </div>` : ''}

            </div>

            <!-- ── Barra de stats rápidos ─────────────────────── -->
            <div class="detail-stats-bar">
                ${property.surface  ? statPill('fas fa-ruler-combined', property.surface + ' m²',  'Superficie')  : ''}
                ${property.supVendibleDest ? statPill('fas fa-ruler-combined', property.supVendibleDest + ' m²', 'M² vendibles') : ''}
                ${property.bedrooms ? statPill('fas fa-door-open',      property.bedrooms,           'Ambientes')   : ''}
                ${property.bathrooms? statPill('fas fa-bath',           property.bathrooms,          'Baños')       : ''}
                ${property.garage   ? statPill('fas fa-car',            property.garage,             'Cocheras')    : ''}
                ${property.toilette ? statPill('fas fa-toilet',         property.toilette,           'Toilette')    : ''}
                ${property.pisos    ? statPill('fas fa-building',       'Piso ' + property.pisos,    'Piso')        : ''}
                ${property.year     ? statPill('fas fa-calendar-alt',   property.year,               'Año')         : ''}
                ${property.estadoConservacion ? statPill('fas fa-certificate', property.estadoConservacion, 'Estado') : ''}
            </div>

            <!-- ── Grid: contenido + sidebar ─────────────────── -->
            <div class="detail-grid">
                <div class="detail-main-content">

                    <!-- Ficha técnica en tabla -->
                    <section class="detail-section">
                        <h2>Ficha Técnica</h2>
                        <div class="detail-data-table">
                            ${dataRow('Tipo de propiedad', typeLabel)}
                            ${dataRow('Operación', opLabel)}
                            ${property.neighborhood ? dataRow('Barrio', property.neighborhood) : ''}
                            ${property.zone         ? dataRow('Zona / Partido', property.zone) : ''}
                            ${property.surface      ? dataRow('Superficie', property.surface + ' m²') : ''}
                            ${property.supVendibleDest ? dataRow('M² vendibles', property.supVendibleDest + ' m²') : ''}
                            ${property.bedrooms     ? dataRow('Ambientes', property.bedrooms) : ''}
                            ${property.bathrooms    ? dataRow('Baños', property.bathrooms) : ''}
                            ${property.garage       ? dataRow('Cocheras', property.garage) : ''}
                            ${property.toilette     ? dataRow('Toilette', property.toilette) : ''}
                            ${property.pisos        ? dataRow('Piso', property.pisos) : ''}
                            ${property.disposicionDest ? dataRow('Disposición', property.disposicionDest) : ''}
                            ${property.year         ? dataRow('Año de construcción', property.year) : ''}
                            ${property.condition    ? dataRow('Estado', property.condition) : ''}
                            ${property.estadoConservacion ? dataRow('Estado de conservación', property.estadoConservacion) : ''}
                            ${property.aguaCorriente ? dataRow('Agua corriente', property.aguaCorriente === 'si' ? 'Sí' : 'No') : ''}
                            ${property.electricidad  ? dataRow('Electricidad', property.electricidad === 'si' ? 'Sí' : 'No') : ''}
                            ${property.gasNatural    ? dataRow('Gas natural', property.gasNatural === 'si' ? 'Sí' : 'No') : ''}
                            ${pricePerM2            ? dataRow('Precio por m²', currencyLabel(property.currency) + ' ' + pricePerM2.toLocaleString()) : ''}
                        </div>
                    </section>

                    <!-- Descripción -->
                    ${property.description ? `
                    <section class="detail-section">
                        <h2>Descripción</h2>
                        <p class="description-text">${property.description}</p>
                    </section>` : ''}

                    <!-- Amenities -->
                    ${property.features?.length > 0 ? `
                    <section class="detail-section">
                        <h2>Amenities &amp; Servicios</h2>
                        <div class="amenities-list">
                            ${property.features.map(f => `<span class="amenity-tag"><i class="fas fa-check"></i> ${f}</span>`).join('')}
                        </div>
                    </section>` : ''}

                    <!-- Mapa -->
                    <section class="detail-section detail-section-map">
                        <h2>Ubicación</h2>
                        <div class="detail-map">
                            <iframe
                                loading="lazy"
                                referrerpolicy="no-referrer-when-downgrade"
                                src="https://maps.google.com/maps?q=${mapQuery}&output=embed&z=15"
                                allowfullscreen>
                            </iframe>
                        </div>
                    </section>

                </div>

                <!-- ── Sidebar sticky de contacto ── -->
                <aside class="detail-sidebar">
                    <div class="contact-card">
                        <h3>¿Querés conocer esta propiedad?</h3>
                        <p>Nuestros asesores te responden de inmediato.</p>

                        <a href="${waUrl}" target="_blank" style="text-decoration:none">
                            <button class="btn-primary full-width">
                                <i class="fab fa-whatsapp"></i> Contactar por WhatsApp
                            </button>
                        </a>
                        <a href="tel:+5491131444207" style="text-decoration:none">
                            <button class="btn-secondary full-width">
                                <i class="fas fa-phone-alt"></i> Llamar ahora
                            </button>
                        </a>
                        <a href="mailto:info@umen.com.ar?subject=Consulta: ${encodeURIComponent(property.title)}" style="text-decoration:none">
                            <button class="btn-secondary full-width btn-email">
                                <i class="fas fa-envelope"></i> Enviar consulta
                            </button>
                        </a>

                        <div class="agent-info">
                            <img src="https://umen.com.ar/wp-content/uploads/2021/02/UMEN-logo.png"
                                 alt="UMEN"
                                 style="border-radius:4px; height:36px; width:auto; object-fit:contain; background:#fff; padding:4px">
                            <div>
                                <strong>UMEN Buenos Negocios</strong>
                                <span>División Residencial</span>
                                <span>Av. Cabildo 4769 9° Piso, Nuñez</span>
                            </div>
                        </div>

                        <div class="contact-trust">
                            <div class="contact-trust-item"><i class="fas fa-shield-alt"></i> Asesoramiento profesional matriculado</div>
                            <div class="contact-trust-item"><i class="fas fa-clock"></i> Respuesta en menos de 24 horas</div>
                            <div class="contact-trust-item"><i class="fas fa-handshake"></i> Sin compromiso de contratación</div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>

        <!-- ── Lightbox ───────────────────────────────────────── -->
        <div class="lightbox-overlay" id="lightbox" onclick="closeLightbox()">
            <button class="lightbox-close" onclick="closeLightbox()">
                <i class="fas fa-times"></i>
            </button>
            <button class="lightbox-nav lightbox-prev" onclick="event.stopPropagation(); lightboxNav(-1)">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="lightbox-img-wrap" onclick="event.stopPropagation()">
                <img id="lightbox-img" src="" alt="">
            </div>
            <button class="lightbox-nav lightbox-next" onclick="event.stopPropagation(); lightboxNav(1)">
                <i class="fas fa-chevron-right"></i>
            </button>
            <div class="lightbox-counter" id="lightbox-counter"></div>
        </div>
    `;
}

// ── Helpers de plantilla ──────────────────────────────────────────────────────

function currencyLabel(currency) {
    return currency === 'ARS' ? '$' : (currency || 'USD');
}

function statPill(icon, value, label) {
    return `<div class="stat-pill">
        <i class="${icon}"></i>
        <span class="stat-v">${value}</span>
        <span class="stat-l">${label}</span>
    </div>`;
}

function dataRow(label, value) {
    return `<div class="data-row">
        <span class="data-label">${label}</span>
        <span class="data-value">${value}</span>
    </div>`;
}

function getTypeLabel(type) {
    const map = {
        deptos: 'Departamento', casas: 'Casa', oficinas: 'Oficina',
        lotes: 'Lote / Terreno', hoteles: 'Hotel', locales: 'Local Comercial'
    };
    return map[type] || type || 'Propiedad';
}

// ── Galería: navegación en página ────────────────────────────────────────────

window.navGallery = function(dir) {
    currentGalleryIdx = (currentGalleryIdx + dir + galleryImages.length) % galleryImages.length;
    updateGalleryUI();
};

window.goToGalleryImage = function(idx) {
    currentGalleryIdx = idx;
    updateGalleryUI();
};

function updateGalleryUI() {
    const mainImg = document.getElementById('main-detail-image');
    const counter = document.getElementById('gallery-counter');
    if (mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(() => {
            mainImg.src = galleryImages[currentGalleryIdx];
            mainImg.style.opacity = '1';
        }, 150);
    }
    if (counter) counter.textContent = `${currentGalleryIdx + 1} / ${galleryImages.length}`;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

window.openLightbox = function(startIdx) {
    currentGalleryIdx = startIdx ?? currentGalleryIdx;
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    updateLightboxUI();
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('open');
    document.body.style.overflow = '';
};

window.lightboxNav = function(dir) {
    currentGalleryIdx = (currentGalleryIdx + dir + galleryImages.length) % galleryImages.length;
    updateLightboxUI();
};

function updateLightboxUI() {
    const img     = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    if (img) {
        img.style.opacity = '0';
        setTimeout(() => {
            img.src = galleryImages[currentGalleryIdx];
            img.style.opacity = '1';
        }, 120);
    }
    if (counter) counter.textContent = `${currentGalleryIdx + 1} / ${galleryImages.length}`;
}

// ── Compartir enlace ──────────────────────────────────────────────────────────

window.copyPropertyLink = function() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = document.querySelector('.share-link');
        if (!btn) return;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-link"></i>'; }, 2000);
    });
};

// Compatibilidad con código previo
window.changeMainImage = function(url) {
    const idx = galleryImages.indexOf(url);
    if (idx >= 0) { currentGalleryIdx = idx; updateGalleryUI(); }
};
