// ── DETAIL PAGE ──

const params      = new URLSearchParams(window.location.search);
const SLUG        = params.get('slug') || '';
let   epSort      = 'desc';
let   epPage      = 1;
const EP_PER_PAGE = 50;
let   allEps      = [];

// ════════════════════════════
//  FETCH
// ════════════════════════════
async function fetchDetail(slug) {
    const res = await fetch(`/api/anime/detail/${slug}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.detail) throw new Error('Data detail tidak ditemukan');
    return data;
}

// ════════════════════════════
//  RENDER
// ════════════════════════════
function renderDetail(data) {
    const d    = data.detail;
    const info = d.info || {};

    document.title = `${d.title} — AniStream`;

    // Hero bg blur
    const heroBg = document.getElementById('hero-bg');
    if (heroBg) heroBg.style.backgroundImage = `url('${d.poster}')`;

    // Poster
    const posterEl = document.getElementById('detail-poster');
    if (posterEl) {
        posterEl.src = d.poster;
        posterEl.alt = d.title;
        posterEl.onerror = () => posterEl.src = 'https://placehold.co/160x240/181818/333?text=No+Image';
    }

    setText('detail-title',    d.title);
    setText('detail-studio',   info.studio   || '–');
    setText('detail-season',   info.season   || '–');
    setText('detail-duration', info.duration || '–');
    setText('detail-type',     info.type     || '–');
    setText('detail-updated',  info.updated_on || '–');

    // Status
    const statusEl = document.getElementById('detail-status');
    if (statusEl) {
        const ongoing         = info.status === 'Ongoing';
        statusEl.textContent  = info.status || '–';
        statusEl.className    = `status-pill ${ongoing ? 'ongoing' : 'completed'}`;
    }

    // Synopsis
    const synEl = document.getElementById('detail-synopsis');
    if (synEl) {
        let syn = (d.synopsis || 'Tidak ada sinopsis.').replace(/^Sinopsis:\s*/i, '');
        // Potong kalau terlalu panjang & cuma berisi SEO spam
        if (syn.length < 50 || syn.includes('oploverz')) {
            syn = 'Sinopsis belum tersedia untuk anime ini.';
        }
        synEl.textContent = syn;
    }

    // Genres
    const genresEl = document.getElementById('detail-genres');
    if (genresEl) {
        genresEl.innerHTML = (d.genres || []).map(g =>
            `<span class="genre-chip" onclick="goSearch('${g.name}')">${g.name}</span>`
        ).join('') || '<span style="color:var(--text3);font-size:13px">–</span>';
    }

    // Episodes
    allEps = d.episode_list || [];
    epPage = 1;
    renderEpisodes();
    updateWatchBtn();
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ════════════════════════════
//  WATCH BUTTON
// ════════════════════════════
function updateWatchBtn() {
    const btn = document.getElementById('btn-watch');
    if (!btn || !allEps.length) return;
    // Tonton dari episode pertama (index 0 di list asli = ep terlama)
    const firstEp = allEps[0];
    btn.onclick = () => goWatch(firstEp.slug);
    btn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        Tonton Ep ${firstEp.episode}
    `;
}

// ════════════════════════════
//  EPISODE LIST
// ════════════════════════════
function getSortedEps() {
    const sorted = [...allEps];
    if (epSort === 'desc') sorted.reverse();
    return sorted;
}

function renderEpisodes() {
    const container = document.getElementById('ep-list');
    if (!container) return;

    const sorted = getSortedEps();
    const slice  = sorted.slice(0, epPage * EP_PER_PAGE);

    setText('ep-count', `${allEps.length} Episode`);

    if (!slice.length) {
        container.innerHTML = `<div class="empty-state" style="padding:32px 0">
            <p>Belum ada episode tersedia</p></div>`;
        return;
    }

    container.innerHTML = slice.map((ep, i) => `
        <div class="ep-item" style="animation-delay:${(i % 20) * 25}ms"
             onclick="goWatch('${ep.slug}')">
            <div class="ep-num">Ep ${ep.episode}</div>
            <div class="ep-info">
                <div class="ep-title">${ep.title}</div>
                <div class="ep-date">${ep.release_date || ''}</div>
            </div>
            <div class="ep-play">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <polyline points="9,18 15,12 9,6"/>
                </svg>
            </div>
        </div>
    `).join('');

    const loadMoreBtn = document.getElementById('ep-load-more');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = (epPage * EP_PER_PAGE) < sorted.length ? 'block' : 'none';
    }
}

function loadMoreEps() {
    epPage++;
    renderEpisodes();
}

function toggleSort() {
    epSort = epSort === 'desc' ? 'asc' : 'desc';
    epPage = 1;
    const btn = document.getElementById('sort-btn');
    if (btn) btn.textContent = epSort === 'desc' ? '↓ Terbaru' : '↑ Terlama';
    renderEpisodes();
}

// ════════════════════════════
//  NAVIGATE
// ════════════════════════════
function goWatch(slug) {
    window.location.href = `/watch?slug=${slug}`;
}

function goSearch(genre) {
    window.location.href = `/search?q=${encodeURIComponent(genre)}`;
}

// ════════════════════════════
//  SKELETON
// ════════════════════════════
function showSkeleton() {
    const sk = document.getElementById('detail-skeleton');
    const ct = document.getElementById('detail-content');
    if (sk) sk.style.display = 'block';
    if (ct) ct.style.display = 'none';
}

function hideSkeleton() {
    const sk = document.getElementById('detail-skeleton');
    const ct = document.getElementById('detail-content');
    if (sk) sk.style.display = 'none';
    if (ct) ct.style.display = 'block';
}

// ════════════════════════════
//  INIT
// ════════════════════════════
async function init() {
    if (!SLUG) { window.location.href = '/'; return; }

    showSkeleton();
    try {
        const data = await fetchDetail(SLUG);
        hideSkeleton();
        renderDetail(data);
    } catch (err) {
        hideSkeleton();
        document.getElementById('detail-content').innerHTML = `
            <div class="empty-state" style="padding:80px 24px">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Gagal Memuat</h3>
                <p>${err.message}</p>
                <button onclick="history.back()" style="margin-top:16px;padding:8px 20px;background:var(--accent);color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
                    ← Kembali
                </button>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', init);
