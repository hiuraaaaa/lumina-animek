// ── GENRE PAGE ──
const params     = new URLSearchParams(window.location.search);
let activeGenre  = params.get('genre')  || '';
let activeStatus = params.get('status') || '';
let currentPage  = 1;
let isLoading    = false;
let hasNext      = false;

async function fetchList(page = 1) {
    const q = new URLSearchParams();
    if (activeGenre) {
        // Genre → /api/anime/genre/:slug
        const slug = activeGenre.toLowerCase().replace(/\s+/g, '-');
        q.set('page', page);
        return fetchJSON(`/api/anime/genre/${slug}?${q}`);
    } else if (activeStatus === 'Ongoing') {
        q.set('page', page);
        return fetchJSON(`/api/anime/ongoing?${q}`);
    } else if (activeStatus === 'Completed') {
        q.set('page', page);
        return fetchJSON(`/api/anime/completed?${q}`);
    } else {
        q.set('page', page);
        return fetchJSON(`/api/anime/ongoing?${q}`);
    }
}

async function loadGenreList() {
    try {
        const data   = await fetchJSON('/api/anime/genres');
        const genres = data.genres || [];
        const el     = document.getElementById('genre-chips');
        if (!el || !genres.length) return;
        el.innerHTML = genres.map(g => `
            <button class="genre-pill ${activeGenre.toLowerCase() === g.name.toLowerCase() ? 'active' : ''}"
                    onclick="selectGenre('${g.name}')">${g.name}</button>`).join('');
    } catch(e) {
        // Fallback ke list statis
        const GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Magic','Mecha','Music','Mystery','Psychological','Romance','School','Sci-Fi','Seinen','Shoujo','Shounen','Slice of Life','Sports','Super Power','Supernatural','Thriller'];
        const el = document.getElementById('genre-chips');
        if (el) el.innerHTML = GENRES.map(g => `
            <button class="genre-pill ${activeGenre.toLowerCase() === g.toLowerCase() ? 'active' : ''}"
                    onclick="selectGenre('${g}')">${g}</button>`).join('');
    }
}

function selectGenre(genre) {
    activeGenre  = activeGenre.toLowerCase() === genre.toLowerCase() ? '' : genre;
    activeStatus = '';
    currentPage  = 1;
    document.querySelectorAll('.genre-pill').forEach(t =>
        t.classList.toggle('active', t.textContent.trim().toLowerCase() === activeGenre.toLowerCase())
    );
    document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
    updateURL();
    loadList(1);
}

function setStatus(status) {
    activeStatus = activeStatus === status ? '' : status;
    activeGenre  = '';
    currentPage  = 1;
    document.querySelectorAll('.status-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.status === activeStatus)
    );
    document.querySelectorAll('.genre-pill').forEach(t => t.classList.remove('active'));
    updateURL();
    loadList(1);
}

function updateURL() {
    const q = new URLSearchParams();
    if (activeGenre)  q.set('genre',  activeGenre);
    if (activeStatus) q.set('status', activeStatus);
    history.replaceState(null, '', q.toString() ? `/genre?${q}` : '/genre');
    const parts = [activeGenre, activeStatus].filter(Boolean);
    const label = document.getElementById('genre-page-title');
    if (label) label.textContent = parts.length ? parts.join(' · ') : 'Semua Anime';
}

async function loadList(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;
    const grid    = document.getElementById('genre-grid');
    const loadBtn = document.getElementById('load-more');
    const countEl = document.getElementById('result-count');

    if (!append) {
        grid.innerHTML = renderSkeleton();
        if (countEl) countEl.textContent = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (loadBtn) loadBtn.textContent = 'Memuat...';

    try {
        const data = await fetchList(page);
        currentPage = page;
        // Otakudesu pakai total_pages bukan pagination.hasNext
        hasNext = data.next_page ? true : (data.total_pages ? page < data.total_pages : false);
        const list = data.anime_list || data.items || [];

        if (!list.length && !append) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg><h3>Tidak ada anime</h3><p>Coba filter lain</p></div>`;
        } else {
            const cards = list.map((a, i) => renderCard(a, i)).join('');
            if (!append) grid.innerHTML = cards;
            else         grid.innerHTML += cards;
        }

        if (countEl && list.length) {
            const total = append ? parseInt(countEl.dataset.count || 0) + list.length : list.length;
            countEl.dataset.count = total;
            countEl.textContent   = `${total} anime${hasNext ? '+' : ''}`;
        }
        if (loadBtn) loadBtn.style.display = hasNext ? 'block' : 'none';

    } catch(err) {
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
    loadGenreList();
    updateURL();
    document.querySelectorAll('.status-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.status === activeStatus)
    );
    loadList(1);
    document.getElementById('load-more')?.addEventListener('click', () => {
        if (hasNext) loadList(currentPage + 1, true);
    });
});
