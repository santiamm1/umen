/**
 * cloudinaryUpload.js
 * Maneja la subida de imágenes a Cloudinary desde el navegador
 * usando Upload Preset unsigned (sin exponer el API Secret).
 *
 * Cloudinary config:
 *   cloud_name  : cfkqfa1z
 *   upload_preset: umen_uploads  (unsigned, configurado en el dashboard)
 *   api_key es SOLO para referencia — NO se usa en uploads unsigned del browser.
 */

const CLOUD_NAME    = 'cfkqfa1z';
const UPLOAD_PRESET = 'umen_uploads';
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// ── Estado interno de la galería ──────────────────────────────────────────────
// Cada item: { url: string, publicId: string, uploading: boolean, error: string|null }
let galleryItems = [];

// ── Callbacks opcionales ──────────────────────────────────────────────────────
let onChangeCallback = null;

// ── Punto de entrada público ──────────────────────────────────────────────────

/**
 * initImageGallery(containerId, options)
 * Monta la UI de galería drag-drop dentro del elemento #containerId.
 * @param {string}   containerId  ID del div contenedor en el HTML
 * @param {object}   options      { onChange(urls) }
 */
export function initImageGallery(containerId, options = {}) {
    onChangeCallback = options.onChange || null;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = buildGalleryHTML();
    bindEvents(container);
}

/**
 * setGalleryUrls(urls)
 * Carga URLs existentes (al editar una propiedad).
 */
export function setGalleryUrls(urls = []) {
    galleryItems = urls.map(url => ({ url, publicId: null, uploading: false, error: null }));
    renderThumbnails();
}

/**
 * getGalleryUrls()
 * Devuelve el array de URLs actuales (solo las subidas con éxito).
 */
export function getGalleryUrls() {
    return galleryItems.filter(i => i.url && !i.uploading).map(i => i.url);
}

// ── HTML base de la galería ───────────────────────────────────────────────────
function buildGalleryHTML() {
    return `
        <div class="cld-gallery" id="cld-gallery">
            <div class="cld-thumbs" id="cld-thumbs"></div>

            <div class="cld-dropzone" id="cld-dropzone">
                <div class="cld-dropzone-inner">
                    <i class="fas fa-cloud-upload-alt cld-dz-icon"></i>
                    <p class="cld-dz-title">Arrastrá las imágenes aquí</p>
                    <p class="cld-dz-sub">o hacé click para seleccionarlas</p>
                    <p class="cld-dz-hint">JPG, PNG, WEBP · Múltiples a la vez · Máx. 10 MB c/u</p>
                </div>
                <input type="file" id="cld-file-input" accept="image/*" multiple style="display:none">
            </div>

            <div class="cld-progress-bar" id="cld-progress-bar" style="display:none">
                <div class="cld-progress-fill" id="cld-progress-fill"></div>
            </div>
            <div class="cld-status" id="cld-status"></div>
        </div>
    `;
}

// ── Bind de eventos ───────────────────────────────────────────────────────────
function bindEvents(container) {
    const dropzone  = container.querySelector('#cld-dropzone');
    const fileInput = container.querySelector('#cld-file-input');

    // Click en dropzone → file picker
    dropzone.addEventListener('click', () => fileInput.click());

    // File picker change
    fileInput.addEventListener('change', e => {
        handleFiles([...e.target.files]);
        fileInput.value = ''; // reset para poder volver a subir el mismo archivo
    });

    // Drag & drop
    dropzone.addEventListener('dragenter', e => { e.preventDefault(); dropzone.classList.add('cld-dz-active'); });
    dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('cld-dz-active'); });
    dropzone.addEventListener('dragleave', e => { e.preventDefault(); dropzone.classList.remove('cld-dz-active'); });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('cld-dz-active');
        handleFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
    });

    // Drag-to-reorder en thumbnails (delegado)
    const thumbs = container.querySelector('#cld-thumbs');
    let dragSrc = null;

    thumbs.addEventListener('dragstart', e => {
        const card = e.target.closest('.cld-thumb');
        if (!card) return;
        dragSrc = card;
        card.classList.add('cld-thumb-dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    thumbs.addEventListener('dragend', e => {
        document.querySelectorAll('.cld-thumb').forEach(c => c.classList.remove('cld-thumb-dragging','cld-thumb-over'));
        dragSrc = null;
    });
    thumbs.addEventListener('dragover', e => {
        e.preventDefault();
        const card = e.target.closest('.cld-thumb');
        if (card && card !== dragSrc) {
            document.querySelectorAll('.cld-thumb').forEach(c => c.classList.remove('cld-thumb-over'));
            card.classList.add('cld-thumb-over');
        }
    });
    thumbs.addEventListener('drop', e => {
        e.preventDefault();
        const card = e.target.closest('.cld-thumb');
        if (!card || !dragSrc || card === dragSrc) return;
        const srcIdx  = Number(dragSrc.dataset.index);
        const destIdx = Number(card.dataset.index);
        const [moved] = galleryItems.splice(srcIdx, 1);
        galleryItems.splice(destIdx, 0, moved);
        renderThumbnails();
        notifyChange();
    });
}

// ── Manejo de archivos ────────────────────────────────────────────────────────
async function handleFiles(files) {
    if (!files.length) return;
    setStatus(`Subiendo ${files.length} imagen${files.length > 1 ? 'es' : ''}…`);
    showProgress(0);

    // Agregar placeholders
    const startIdx = galleryItems.length;
    files.forEach(() => galleryItems.push({ url: null, publicId: null, uploading: true, error: null }));
    renderThumbnails();

    let completed = 0;
    const results = await Promise.all(files.map(async (file, i) => {
        try {
            const result = await uploadFile(file);
            galleryItems[startIdx + i] = { url: result.secure_url, publicId: result.public_id, uploading: false, error: null };
        } catch (err) {
            galleryItems[startIdx + i] = { url: null, publicId: null, uploading: false, error: err.message || 'Error' };
        }
        completed++;
        showProgress(Math.round((completed / files.length) * 100));
        renderThumbnails();
    }));

    // Eliminar items con error
    const errors = galleryItems.filter(i => i.error).length;
    galleryItems = galleryItems.filter(i => !i.error);
    renderThumbnails();

    hideProgress();
    if (errors > 0) {
        setStatus(`${completed - errors} subidas · ${errors} con error`, 'error');
    } else {
        setStatus(`${completed} imagen${completed > 1 ? 'es' : ''} subida${completed > 1 ? 's' : ''} con éxito`, 'success');
    }
    notifyChange();
    setTimeout(() => setStatus(''), 3000);
}

export async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
}

// ── Renderizado de thumbnails ─────────────────────────────────────────────────
function renderThumbnails() {
    const container = document.getElementById('cld-thumbs');
    if (!container) return;

    container.innerHTML = galleryItems.map((item, i) => {
        if (item.uploading) {
            return `
                <div class="cld-thumb cld-thumb-loading" data-index="${i}">
                    <div class="cld-thumb-spinner"><i class="fas fa-spinner fa-spin"></i></div>
                    ${i === 0 ? '<span class="cld-cover-badge">Portada</span>' : ''}
                </div>`;
        }
        if (item.error) {
            return `
                <div class="cld-thumb cld-thumb-error" data-index="${i}">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${item.error}</span>
                </div>`;
        }
        return `
            <div class="cld-thumb" draggable="true" data-index="${i}" title="Arrastrá para reordenar">
                <img src="${item.url}" alt="Imagen ${i + 1}" loading="lazy">
                ${i === 0 ? '<span class="cld-cover-badge">Portada</span>' : ''}
                <button type="button" class="cld-thumb-del" data-index="${i}" title="Eliminar"><i class="fas fa-times"></i></button>
                <span class="cld-thumb-num">${i + 1}</span>
            </div>`;
    }).join('');

    // Bind delete buttons
    container.querySelectorAll('.cld-thumb-del').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const idx = Number(btn.dataset.index);
            galleryItems.splice(idx, 1);
            renderThumbnails();
            notifyChange();
        });
    });
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
    const el = document.getElementById('cld-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'cld-status' + (type ? ` cld-status-${type}` : '');
}

function showProgress(pct) {
    const bar  = document.getElementById('cld-progress-bar');
    const fill = document.getElementById('cld-progress-fill');
    if (bar)  bar.style.display  = 'block';
    if (fill) fill.style.width   = `${pct}%`;
}
function hideProgress() {
    const bar = document.getElementById('cld-progress-bar');
    if (bar) { setTimeout(() => { bar.style.display = 'none'; }, 400); }
}

function notifyChange() {
    if (onChangeCallback) onChangeCallback(getGalleryUrls());
}
