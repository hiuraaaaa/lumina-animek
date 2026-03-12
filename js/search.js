// ── SEARCH PAGE ──

const params      = new URLSearchParams(window.location.search);
let   currentQ    = params.get('q') || '';
let   currentPage = 1;
let   isLoading   = false;
let   hasNext     = false;
let   allResults  = [];

// Ekstrak slug dari oploverz_url
function extractSlug(item) {
    if (item.oploverz_url) {
        const m = item.oploverz_url.match(/\/anime\/([^\/]+)\/?$/);
        if (m) return m[1];
    }
    return item.slug;
}

// ════════════════════════════
//  FETCH
// ════════════════════════════
async function fetchSearch(q, page = 1) {
    const res = await fetch(`/api/anime/search?q=${encodeURIComponent(q)}&page=${page}`);
    if (!res.ok) throw new Error('Gagal memuat hasil pencarian');
    return res.json();
}

// ════════════════════════════
//  RENDER
// ════════════════════════════
function badgeClass(type) {
    const map = { 'TV': 'badge-tv', 'Movie': 'badge-movie', 'Special': 'badge-special', 'Live Action': 'badge-live-action', 'OVA': 'badge-ova' };
    return map[type] || 'badge-tv';
}

function renderCard(a, i) {
    const slug      = extractSlug(a);
    const completed = a.status === 'Completed' || a.episode === 'Completed';
    return `
        <div class="anime-card" style="animation-delay:${(i % 12) * 40}ms"
             onclick="window.location.href='/detail?slug=${slug}'">
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

function renderSkeleton(n = 9) {
    return Array.from({ length: n }, () => `
        <div class="skeleton-card">
            <div class="skeleton-poster"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        </div>
    `).join('');
}

// ════════════════════════════
//  SEARCH
// ════════════════════════════
async function doSearch(q, page = 1, append = false) {
    if (!q.trim() || isLoading) return;
    isLoading = true;

    const grid    = document.getElementById('search-grid');
    const loadBtn = document.getElementById('load-more');
    const countEl = document.getElementById('result-count');

    if (!append) {
        grid.innerHTML = renderSkeleton();
        if (countEl) countEl.textContent = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (loadBtn) loadBtn.textContent = 'Memuat...';

    try {
        const data  = await fetchSearch(q, page);
        currentPage = page;
        hasNext     = data.pagination?.hasNext || false;
        const list  = data.anime_list || [];

        if (!append) allResults = list;
        else allResults = [...allResults, ...list];

        if (!allResults.length) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <h3>Tidak ditemukan</h3>
                    <p>Coba kata kunci lain</p>
                </div>`;
        } else {
            if (!append) {
                grid.innerHTML = allResults.map((a, i) => renderCard(a, i)).join('');
            } else {
                grid.innerHTML += list.map((a, i) => renderCard(a, allResults.length - list.length + i)).join('');
            }
        }

        if (countEl) countEl.textContent = allResults.length
            ? `${allResults.length} hasil untuk "${q}"${hasNext ? '+' : ''}`
            : '';

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
//  SEARCH INPUT
// ════════════════════════════
function initSearchInput() {
    const input   = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if (!input) return;

    // Set nilai awal
    if (currentQ) {
        input.value = currentQ;
        if (clearBtn) clearBtn.style.display = 'flex';
    }

    let timer;
    input.addEventListener('input', () => {
        const q = input.value.trim();
        if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
        clearTimeout(timer);
        if (!q) {
            document.getElementById('search-grid').innerHTML = '';
            document.getElementById('result-count').textContent = '';
            return;
        }
        timer = setTimeout(() => {
            currentQ = q;
            history.replaceState(null, '', `/search?q=${encodeURIComponent(q)}`);
            doSearch(q, 1, false);
        }, 400);
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            clearTimeout(timer);
            const q = input.value.trim();
            if (q) { currentQ = q; doSearch(q, 1, false); }
        }
        if (e.key === 'Escape') input.blur();
    });

    clearBtn?.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        currentQ = '';
        document.getElementById('search-grid').innerHTML = '';
        document.getElementById('result-count').textContent = '';
        history.replaceState(null, '', '/search');
        input.focus();
    });

    // Auto focus
    input.focus();
}

// ════════════════════════════
//  INIT
// ════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    renderTrending();
    initSearchInput();

    if (currentQ) doSearch(currentQ, 1, false);

    document.getElementById('load-more')?.addEventListener('click', () => {
        if (hasNext) doSearch(currentQ, currentPage + 1, true);
    });
});

// ════════════════════════════
//  TRENDING LIST
// ════════════════════════════
function renderTrending() {
    const list = document.getElementById('trending-list');
    if (!list) return;
    const trending = [
        'One Piece', 'Naruto', 'Jujutsu Kaisen', 'Bleach',
        'Attack on Titan', 'Demon Slayer', 'Blue Lock', 'Frieren'
    ];
    list.innerHTML = trending.map((title, i) => `
        <div class="trending-item" onclick="setSearch('${title}')">
            <span class="trending-num ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <span class="trending-text">${title}</span>
            <span class="trending-icon">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <polyline points="9,18 15,12 9,6"/>
                </svg>
            </span>
        </div>
    `).join('');
}
