// Inyecta partials compartidos (header, footer) en todas las páginas

async function fetchPartial(path) {
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    const base = depth > 1 ? '../'.repeat(depth - 1) : '';
    const res = await fetch(`${base}${path}`);
    if (!res.ok) throw new Error(`fetch failed: ${path}`);
    return res.text();
}

export async function loadHeader() {
    const placeholder = document.getElementById('header-placeholder');
    if (!placeholder) return;

    try {
        const html = await fetchPartial('partials/header.html');
        placeholder.outerHTML = html;

        // Setear link activo según la página actual
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const pageMap = {
            'index.html':          'index',
            '':                    'index',
            'propiedades.html':    'propiedades',
            'property-detail.html':'propiedades',
            'tasaciones.html':     'tasaciones',
            'contacto.html':       'contacto',
        };
        const activePage = pageMap[page] || '';
        document.querySelectorAll('#nav-menu a[data-page]').forEach(link => {
            if (link.getAttribute('data-page') === activePage) {
                link.classList.add('active');
            }
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
