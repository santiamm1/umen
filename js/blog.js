// blog.js - Listado del blog (Notas de Interés & Urbanismo)

import { getBlogPosts } from './propertyService.js';

const container = document.getElementById('blog-list');
const searchInput = document.getElementById('blog-search');
const categoryFilter = document.getElementById('blog-category-filter');
const sortSelect = document.getElementById('blog-sort');
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1560184897-ae75f418493e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=65';

let allPosts = [];

(async () => {
    let attempts = 0;
    while (!window.db && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    try {
        allPosts = await getBlogPosts();
    } catch {
        allPosts = [];
    }

    if (allPosts.length === 0) {
        container.innerHTML = `<div class="no-results"><i class="fas fa-search-minus"></i><p>Todavía no hay notas publicadas.</p></div>`;
        return;
    }

    const categories = [...new Set(allPosts.map(p => p.category).filter(Boolean))].sort();
    categoryFilter.insertAdjacentHTML('beforeend', categories.map(c => `<option value="${c}">${c}</option>`).join(''));

    render();
    searchInput.addEventListener('input', render);
    categoryFilter.addEventListener('change', render);
    sortSelect.addEventListener('change', render);
})();

function postDate(post) {
    return post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt || 0);
}

function render() {
    const term = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;

    let posts = allPosts.filter(post => {
        const matchesTerm = !term || post.title?.toLowerCase().includes(term) || post.excerpt?.toLowerCase().includes(term);
        const matchesCategory = !category || post.category === category;
        return matchesTerm && matchesCategory;
    });

    posts = posts.sort((a, b) => {
        const diff = postDate(a) - postDate(b);
        return sortSelect.value === 'asc' ? diff : -diff;
    });

    if (posts.length === 0) {
        container.innerHTML = `<div class="no-results"><i class="fas fa-search-minus"></i><p>No encontramos notas con esos filtros.</p></div>`;
        return;
    }

    container.innerHTML = posts.map(post => `
        <a href="${post.slug ? 'blog-post.html?slug=' + post.slug : 'blog-post.html?id=' + post.id}" class="item">
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
}
