// Inyecta partials compartidos (header, footer) en todas las páginas

// Raíz del sitio calculada desde la ubicación real de este archivo (js/components.js),
// no desde la URL visible de la página. Así funciona igual si el sitio vive en la raíz
// del dominio, en un subpath (ej. GitHub Pages: usuario.github.io/repo/) o detrás de las
// URLs "lindas" reescritas por .htaccess (donde la URL visible no coincide con la carpeta real).
export const siteRoot = new URL('../', import.meta.url);

async function fetchPartial(path) {
    const res = await fetch(new URL(path, siteRoot));
    if (!res.ok) throw new Error(`fetch failed: ${path}`);
    return res.text();
}

export async function loadHeader() {
    const placeholder = document.getElementById('header-placeholder');
    if (!placeholder) return;

    try {
        const html = await fetchPartial('partials/header.html');
        placeholder.outerHTML = html;

        // El logo usa una ruta absoluta ("/assets/...") en el HTML estático porque las
        // URLs lindas del blog/hoteles necesitan una raíz fija; la recalculamos acá con
        // siteRoot para que también funcione en subpaths (GitHub Pages).
        const logoImg = document.getElementById('header-logo');
        if (logoImg) logoImg.src = new URL('assets/Logo/Logo.png', siteRoot).href;

        // Setear link activo según la página actual
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const pageMap = {
            'index.html':          'index',
            '':                    'index',
            'propiedades.html':    'propiedades',
            'property-detail.html':'propiedades',
            'tasaciones.html':     'tasaciones',
            'blog.html':           'blog',
            'blog-post.html':      'blog',
            'contacto.html':       'contacto',
        };
        const activePage = pageMap[page] || '';
        document.querySelectorAll('#nav-menu a[data-page]').forEach(link => {
            if (link.getAttribute('data-page') === activePage) {
                link.classList.add('active');
            }
        });

        // Botón para contraer/expandir la barra de filtros (solo visible vía CSS
        // en páginas con clase .page-with-filter-toggle en <body>)
        const filterBarToggleBtn = document.getElementById('filter-bar-toggle');
        const filterBar = document.querySelector('.header-filter-bar');
        if (filterBarToggleBtn && filterBar) {
            filterBarToggleBtn.addEventListener('click', () => {
                const isCollapsed = filterBar.classList.toggle('collapsed');
                filterBarToggleBtn.classList.toggle('collapsed', isCollapsed);
                filterBarToggleBtn.title = isCollapsed ? 'Mostrar filtros' : 'Contraer filtros';
            });
        }
    } catch (e) {
        console.warn('No se pudo cargar el header compartido:', e);
    }
}

export async function loadFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) return;

    try {
        const html = await fetchPartial('partials/footer.html');
        placeholder.outerHTML = html;
    } catch (e) {
        console.warn('No se pudo cargar el footer compartido:', e);
    }
}
