// blog.js - Listado del blog (Notas de Interés & Urbanismo)

import { getBlogPosts } from './propertyService.js';

const container = document.getElementById('blog-list');
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1560184897-ae75f418493e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=65';

(async () => {
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    let posts = [];
    try {
        posts = await getBlogPosts();
    } catch {
        posts = [];
    }

    if (posts.length === 0) {
        container.innerHTML = `<div class="no-results"><i class="fas fa-search-minus"></i><p>Todavía no hay notas publicadas.</p></div>`;
        return;
    }

    container.innerHTML = posts.map(post => `
        <a href="${post.slug ? 'blog/' + post.slug : 'blog-post.html?id=' + post.id}" class="item">
            <div class="media">
                <img src="${post.image || FALLBACK_IMG}" alt="${post.title}">
                <span class="cat">${post.category || 'Novedades'}</span>
            </div>
            <div class="item-content">
                <h4>${post.title}</h4>
                <p class="item-excerpt">${post.excerpt || ''}</p>
                <span class="item-more">Leer más <i class="fas fa-arrow-right"></i></span>
            </div>
        </a>
    `).join('');
})();
