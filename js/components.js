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
            'nosotros.html':       'nosotros',
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
            const setCollapsed = (isCollapsed) => {
                filterBar.classList.toggle('collapsed', isCollapsed);
                filterBarToggleBtn.classList.toggle('collapsed', isCollapsed);
                filterBarToggleBtn.title = isCollapsed ? 'Mostrar filtros' : 'Contraer filtros';
            };
            filterBarToggleBtn.addEventListener('click', () => setCollapsed(!filterBar.classList.contains('collapsed')));

            // En el detalle de propiedad ya se eligió qué ver: arranca colapsada
            // para ganar espacio vertical en notebooks chicas.
            if (page === 'property-detail.html') setCollapsed(true);
        }

        // Menú mobile: toggle hamburguesa/X + botón de cerrar propio del overlay
        // (único punto de wiring — antes cada página duplicaba esta lógica y
        // algunas, como contacto/tasaciones, directamente no la tenían).
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const navMenu = document.getElementById('nav-menu');
        if (mobileMenuBtn && navMenu) {
            mobileMenuBtn.addEventListener('click', () => {
                const isOpen = navMenu.classList.toggle('active');
                mobileMenuBtn.querySelector('i').className = isOpen ? 'fas fa-times' : 'fas fa-bars';
            });
            document.getElementById('nav-close-btn')?.addEventListener('click', () => {
                navMenu.classList.remove('active');
                mobileMenuBtn.querySelector('i').className = 'fas fa-bars';
            });
        }

        // Buscador de propiedades dentro del menú mobile
        const mobileSearchForm = document.getElementById('nav-mobile-search');
        mobileSearchForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const operation = mobileSearchForm.querySelector('input[name="mobile-operation"]:checked')?.value || 'venta';
            const keyword = document.getElementById('mobile-quicksearch')?.value.trim();
            const params = new URLSearchParams({ operation });
            if (keyword) params.set('keyword', keyword);
            window.location.href = `propiedades.html?${params.toString()}`;
        });
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

// KPIs de UMEN (Propiedades, Clientes) repetidos en varias páginas.
// Fuente única acá: cambiar el valor una vez actualiza todas las instancias.
const KPIS = {
    properties: '500+',
    clients: '7.000+',
};

document.querySelectorAll('[data-kpi]').forEach(el => {
    el.textContent = KPIS[el.dataset.kpi] ?? el.textContent;
});

// UMEN opera desde el 1/5/1993. Años de trayectoria calculados en vivo así
// nadie tiene que acordarse de actualizar un número "20 años" a mano cada año.
const UMEN_FOUNDING_DATE = new Date(1993, 4, 1);

document.querySelectorAll('[data-years-exp]').forEach(el => {
    const years = Math.floor((Date.now() - UMEN_FOUNDING_DATE) / (365.25 * 24 * 60 * 60 * 1000));
    el.textContent = years;
});
