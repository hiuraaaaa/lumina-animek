// ── GENRE PAGE ──
const params       = new URLSearchParams(window.location.search);
let activeGenre    = params.get('genre')  || '';
let activeStatus   = params.get('status') || '';
let activeType     = params.get('type')   || '';
let currentPage    = 1;
let isLoading      = false;
let hasNext        = false;

const GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Magic','Mecha','Music','Mystery','Psychological','Romance','School','Sci-Fi','Seinen','Shounen','Slice of Life','Sports','Super Power','Supernatural','Thriller'];

async function fetchList(page = 1) {
    const q = new URLSearchParams();
    if (activeGenre)  q.set('genre',  activeGenre.toLowerCase().replace(/ /g, '-'));
    if (activeStatus) q.set('status', activeStatus);
    if (activeType)   q.set('type',   activeType);
    q.set('page', page);
    return fetchJSON(`/api/anime/list?${q.toString()}`);
}

function renderGenreChips() {
    const el = document.getElementById('genre-chips');
    if (!el) return;
    el.innerHTML = GENRES.map(g => `
        <button class="genre-pill ${activeGenre.toLowerCase() === g.toLowerCase() ? 'active' : ''}"
                onclick="selectGenre('${g}')">${g}</button>`).join('');
}

function selectGenre(genre) {
    activeGenre = activeGenre.toLowerCase() === genre.toLowerCase() ? '' : genre;
    currentPage = 1;
    renderGenreChips();
    updateURL();
    loadList(1);
}

function setStatus(status) {
    activeStatus = activeStatus === status ? '' : status;
    currentPage  = 1;
    document.querySelectorAll('.status-tab').forEach(t => t.classList.toggle('active', t.dataset.status === activeStatus));
    updateURL();
    loadList(1);
}

function setType(type) {
    activeType  = activeType === type ? '' : type;
    currentPage = 1;
    document.querySelectorAll('.type-tab').forEach(t => t.classList.toggle('active', t.dataset.type === activeType));
    updateURL();
    loadList(1);
}

function updateURL() {
    const q = new URLSearchParams();
    if (activeGenre)  q.set('genre',  activeGenre);
    if (activeStatus) q.set('status', activeStatus);
    if (activeType)   q.set('type',   activeType);
    history.replaceState(null, '', q.toString() ? `/genre?${q}` : '/genre');
    const parts = [activeGenre, activeStatus === 'ongoing' ? 'Ongoing' : activeStatus === 'completed' ? 'Completed' : '', activeType].filter(Boolean);
    const label = document.getElementById('genre-page-title');
    if (label) label.textContent = parts.length ? parts.join(' · ') : 'Semua Anime';
}

async function loadList(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;
    const grid    = document.getElementById('genre-grid');
    const loadBtn = document.getElementById('load-more');
    const countEl = document.getElementById('result-count');
    if (!append) { grid.innerHTML = renderSkeleton(); if (countEl) countEl.textContent = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (loadBtn) loadBtn.textContent = 'Memuat...';
    try {
        const data  = await fetchList(page);
        currentPage = page;
        hasNext     = data.pagination?.hasNext || false;
        const list  = data.anime_list || [];
        if (!list.length && !append) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg><h3>Tidak ada anime</h3><p>Coba filter lain</p></div>`;
        } else {
            if (!append) grid.innerHTML = list.map(renderCard).join('');
            else grid.innerHTML += list.map(renderCard).join('');
        }
        if (countEl && list.length) {
            const total = append ? parseInt(countEl.dataset.count || 0) + list.length : list.length;
            countEl.dataset.count = total;
            countEl.textContent   = `${total} anime${hasNext ? '+' : ''}`;
        }
        if (loadBtn) loadBtn.style.display = hasNext ? 'block' : 'none';
    } catch (err) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg><h3>Gagal Memuat</h3><p>${err.message}</p></div>`;
    } finally {
        isLoading = false;
        if (loadBtn && hasNext) loadBtn.textContent = 'Muat Lebih Banyak';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderGenreChips();
    updateURL();
    document.querySelectorAll('.status-tab').forEach(t => t.classList.toggle('active', t.dataset.status === activeStatus));
    document.querySelectorAll('.type-tab').forEach(t => t.classList.toggle('active', t.dataset.type === activeType));
    loadList(1);
    document.getElementById('load-more')?.addEventListener('click', () => { if (hasNext) loadList(currentPage + 1, true); });
});
