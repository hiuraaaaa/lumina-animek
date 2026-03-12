// ── GENRE PAGE ──

const params         = new URLSearchParams(window.location.search);
let   activeGenre    = params.get('genre')  || '';
let   activeStatus   = params.get('status') || '';
let   activeType     = params.get('type')   || '';
let   currentPage    = 1;
let   isLoading      = false;
let   hasNext        = false;

const GENRES = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
    'Horror', 'Magic', 'Mecha', 'Music', 'Mystery',
    'Psychological', 'Romance', 'School', 'Sci-Fi',
    'Seinen', 'Shounen', 'Slice of Life', 'Sports',
    'Super Power', 'Supernatural', 'Thriller'
];

// ════════════════════════════
//  FETCH
// ════════════════════════════
async function fetchList(page = 1) {
    const q = new URLSearchParams();
    if (activeGenre)  q.set('genre',  activeGenre.toLowerCase().replace(/ /g, '-'));
    if (activeStatus) q.set('status', activeStatus);
    if (activeType)   q.set('type',   activeType);
    q.set('page', page);
    const res = await fetch(`/api/anime/list?${q.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ════════════════════════════
//  RENDER GENRE CHIPS
// ════════════════════════════
function renderGenreChips() {
    const el = document.getElementById('genre-chips');
    if (!el) return;
    el.innerHTML = GENRES.map(g => `
        <button class="genre-pill ${activeGenre.toLowerCase() === g.toLowerCase() ? 'active' : ''}"
                onclick="selectGenre('${g}')">${g}</button>
    `).join('');
}

function selectGenre(genre) {
    activeGenre  = activeGenre.toLowerCase() === genre.toLowerCase() ? '' : genre;
    currentPage  = 1;
    renderGenreChips();
    updateURL();
    loadList(1);
}

// ════════════════════════════
//  FILTER TABS
// ════════════════════════════
function setStatus(status) {
    activeStatus = activeStatus === status ? '' : status;
    currentPage  = 1;
    document.querySelectorAll('.status-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.status === activeStatus);
    });
    updateURL();
    loadList(1);
}

function setType(type) {
    activeType  = activeType === type ? '' : type;
    currentPage = 1;
    document.querySelectorAll('.type-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === activeType);
    });
    updateURL();
    loadList(1);
}

// ════════════════════════════
//  URL SYNC
// ════════════════════════════
function updateURL() {
    const q = new URLSearchParams();
    if (activeGenre)  q.set('genre',  activeGenre);
    if (activeStatus) q.set('status', activeStatus);
    if (activeType)   q.set('type',   activeType);
    const qs = q.toString();
    history.replaceState(null, '', qs ? `/genre?${qs}` : '/genre');
    updatePageTitle();
}

function updatePageTitle() {
    const parts = [];
    if (activeGenre)  parts.push(activeGenre);
    if (activeStatus) parts.push(activeStatus === 'ongoing' ? 'Ongoing' : 'Completed');
    if (activeType)   parts.push(activeType);
    const label = document.getElementById('genre-page-title');
    if (label) label.textContent = parts.length ? parts.join(' · ') : 'Semua Anime';
}

// ════════════════════════════
//  RENDER CARDS
// ════════════════════════════
function badgeClass(type) {
    const map = { 'TV': 'badge-tv', 'Movie': 'badge-movie', 'Special': 'badge-special', 'Live Action': 'badge-live-action', 'OVA': 'badge-ova' };
    return map[type] || 'badge-tv';
}

function renderCard(a, i) {
    const completed = a.status === 'Completed' || a.episode === 'Completed';
    return `
        <div class="anime-card" style="animation-delay:${(i % 12) * 35}ms"
             onclick="window.location.href='/detail?slug=${a.slug}'">
            <div class="anime-card-poster">
                <img src="${a.poster}" alt="${a.title}" loading="lazy"
                     onerror="this.src='https://placehold.co/200x300/181818/333?text=No+Image'">
                <div class="anime-card-poster-overlay"></div>
                <div class="anime-card-info">
                    <div class="anime-card-title">${a.title}</div>
                    <div class="anime-card-ep">${a.episode || '–'}</div>
                </div>
                <span class="anime-card-badge ${badgeClass(a.type)}">${a.type}</span>
                <span class="status-dot ${completed ? 'completed' : 'ongoing'}"></span>
            </div>
        </div>
    `;
}

function renderSkeleton(n = 12) {
    return Array.from({ length: n }, () => `
        <div class="skeleton-card">
            <div class="skeleton-poster"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        </div>
    `).join('');
}

// ════════════════════════════
//  LOAD LIST
// ════════════════════════════
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
        const data  = await fetchList(page);
        currentPage = page;
        hasNext     = data.pagination?.hasNext || false;
        const list  = data.anime_list || [];

        if (!list.length && !append) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <h3>Tidak ada anime</h3>
                    <p>Coba filter lain</p>
                </div>`;
        } else if (!append) {
            grid.innerHTML = list.map((a, i) => renderCard(a, i)).join('');
        } else {
            grid.innerHTML += list.map((a, i) => renderCard(a, i)).join('');
        }

        if (countEl && list.length) {
            const total = append
                ? parseInt(countEl.dataset.count || 0) + list.length
                : list.length;
            countEl.dataset.count = total;
            countEl.textContent   = `${total} anime${hasNext ? '+' : ''}`;
        }

        if (loadBtn) loadBtn.style.display = hasNext ? 'block' : 'none';

    } catch (err) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Gagal Memuat</h3>
                <p>${err.message}</p>
            </div>`;
    } finally {
        isLoading = false;
        if (loadBtn && hasNext) loadBtn.textContent = 'Muat Lebih Banyak';
    }
}

// ════════════════════════════
//  INIT
// ════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    renderGenreChips();
    updatePageTitle();

    // Set active tabs dari URL
    document.querySelectorAll('.status-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.status === activeStatus);
    });
    document.querySelectorAll('.type-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === activeType);
    });

    loadList(1);

    document.getElementById('load-more')?.addEventListener('click', () => {
        if (hasNext) loadList(currentPage + 1, true);
    });
});

