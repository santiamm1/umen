// blogPost.js - Nota individual del blog (Notas de Interés & Urbanismo)

import { getBlogPost, getBlogPostBySlug, getBlogPosts } from './propertyService.js';

const container = document.getElementById('blog-post');
const params = new URLSearchParams(window.location.search);
const slug   = params.get('slug');
const postId = params.get('id'); // compatibilidad con links viejos ?id=

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1560184897-ae75f418493e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

(async () => {
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    let post = null;
    if (slug) post = await getBlogPostBySlug(slug);
    else if (postId) post = await getBlogPost(postId);

    if (post) render(post); else showNotFound();
})();

function formatDate(createdAt) {
    const date = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt || Date.now());
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function readTime(body) {
    const words = (body || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
}

// El editor enriquecido del admin guarda HTML directo. Las notas viejas se guardaron
// como texto plano con "\n" — si no parece HTML, la envolvemos en <p> como antes.
function renderBody(body) {
    const text = body || '';
    if (/<[a-z][\s\S]*>/i.test(text)) return text;
    return text
        .replace(/\\n/g, '\n')
        .split(/\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${p}</p>`)
        .join('');
}

function setMeta(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
}

async function render(post) {
    const seoTitle = post.seoTitle || `${post.title} | UMEN Buenos Negocios Inmobiliarios`;
    const seoDescription = post.seoDescription || post.excerpt || '';
    const shareUrl = window.location.href;

    document.title = seoTitle;
    setMeta('meta[name="description"]', 'content', seoDescription);
    setMeta('link[rel="canonical"]', 'href', shareUrl);
    setMeta('meta[property="og:title"]', 'content', seoTitle);
    setMeta('meta[property="og:description"]', 'content', seoDescription);
    setMeta('meta[property="og:image"]', 'content', post.image || FALLBACK_IMG);
    setMeta('meta[property="og:url"]', 'content', shareUrl);

    const authorName = post.authorName || 'Equipo UMEN';
    const authorRole = post.authorRole || 'Asesores Inmobiliarios';
    const authorInitial = authorName.trim().charAt(0).toUpperCase();
    const waHref = `https://wa.me/?text=${encodeURIComponent(post.title + ' - ' + shareUrl)}`;
    const mailHref = `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(shareUrl)}`;

    container.innerHTML = `
        <div class="detail-container blog-post-wrap">
            <div class="blog-breadcrumb">
                <a href="/">Inicio</a> <i class="fas fa-chevron-right"></i>
                <a href="blog.html">Blog</a> <i class="fas fa-chevron-right"></i>
                <span>${post.category || 'Novedades'}</span>
            </div>

            <div class="hotel-nota-media blog-post-media">
                <img src="${post.image || FALLBACK_IMG}" alt="${post.title}">
                <span class="cat">${post.category || 'Novedades'}</span>
            </div>

            <div class="blog-post-grid">
                <div class="hotel-nota-article">
                    <h1>${post.title}</h1>

                    <div class="blog-post-meta">
                        <div class="blog-post-avatar">${authorInitial}</div>
                        <div class="blog-post-meta-text">
                            <strong>${authorName}</strong>
                            <span>${authorRole}</span>
                        </div>
                        <div class="blog-post-meta-sep"></div>
                        <span>${formatDate(post.createdAt)}</span>
                        <div class="blog-post-meta-sep"></div>
                        <span>${readTime(post.body)} min de lectura</span>
                    </div>

                    ${post.excerpt ? `<p class="hotel-nota-excerpt">${post.excerpt}</p>` : ''}
                    <div class="hotel-nota-body">${renderBody(post.body)}</div>
                </div>

                <aside class="blog-post-sidebar">
                    <div class="blog-post-about-card">
                        <span>Sobre UMEN</span>
                        <p>Somos una inmobiliaria especializada en propiedades premium, inversiones y hoteles. Acompañamos a nuestros clientes en cada etapa: búsqueda, tasación y cierre del negocio.</p>
                    </div>
                    <div class="contact-card">
                        <h3>¿Te interesa este tema?</h3>
                        <p>Nuestro equipo de asesores te ayuda a encontrar la mejor opción para vos.</p>
                        <a href="https://wa.me/5491131444207" class="btn-primary full-width" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Hablar con un asesor</a>
                        <a href="contacto.html" class="btn-secondary full-width">Contactanos</a>
                    </div>
                    <div class="blog-post-share-card">
                        <span>Compartir nota</span>
                        <div class="blog-post-share">
                            <a href="${waHref}" target="_blank" rel="noopener" title="Compartir por WhatsApp"><i class="fab fa-whatsapp"></i></a>
                            <a href="${mailHref}" title="Compartir por email"><i class="fas fa-envelope"></i></a>
                        </div>
                    </div>
                </aside>
            </div>

            <div id="blog-related"></div>
        </div>
    `;

    renderRelated(post);
}

async function renderRelated(currentPost) {
    let all = [];
    try {
        all = await getBlogPosts(3); // solo se muestran 2 relacionadas, con margen por si el post actual está incluido
    } catch {
        all = [];
    }

    const related = all.filter(p => p.id !== currentPost.id).slice(0, 2);
    if (related.length === 0) return;

    const el = document.getElementById('blog-related');
    if (!el) return;

    el.innerHTML = `
        <div class="blog-related-section">
            <h3>También te puede interesar</h3>
            <div class="items-container">
                ${related.map(p => `
                    <a href="${p.slug ? 'blog-post.html?slug=' + p.slug : 'blog-post.html?id=' + p.id}" class="item">
                        <div class="media">
                            <img src="${p.image || FALLBACK_IMG}" alt="${p.title}">
                            <span class="cat">${p.category || 'Novedades'}</span>
                        </div>
                        <div class="item-content">
                            <h4>${p.title}</h4>
                            <p class="item-excerpt">${p.excerpt || ''}</p>
                            <span class="item-more">Leer más <i class="fas fa-arrow-right"></i></span>
                        </div>
                    </a>
                `).join('')}
            </div>
        </div>
    `;
}

function showNotFound() {
    container.innerHTML = `
        <div class="detail-container">
            <div class="no-results">
                <i class="fas fa-search-minus"></i>
                <p>No encontramos esta nota.</p>
                <div class="content-btn" style="margin-top:24px">
                    <a href="blog.html" class="btn">Volver al Blog</a>
                </div>
            </div>
        </div>
    `;
}
