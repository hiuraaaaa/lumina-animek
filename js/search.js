// ── SEARCH PAGE ──
const params      = new URLSearchParams(window.location.search);
let   currentQ    = params.get('q') || '';
let   currentPage = 1;
let   isLoading   = false;
let   hasNext     = false;
let   allResults  = [];

async function doSearch(q, page = 1, append = false) {
    if (!q.trim() || isLoading) return;
    isLoading = true;
    const grid    = document.getElementById('search-grid');
    const loadBtn = document.getElementById('load-more');
    const countEl = document.getElementById('result-count');
    const ph      = document.getElementById('search-placeholder');
    if (ph) ph.style.display = 'none';
    if (!append) { grid.innerHTML = renderSkeleton(9); if (countEl) countEl.textContent = ''; }
    if (loadBtn) loadBtn.textContent = 'Memuat...';
    try {
        const data  = await fetchJSON(`/api/anime/search?q=${encodeURIComponent(q)}&page=${page}`);
        currentPage = page;
        hasNext     = data.next_page ? true : (data.total_pages ? currentPage < data.total_pages : false);
        const list  = data.anime_list || [];
        if (!append) allResults = list; else allResults = [...allResults, ...list];
        if (!allResults.length) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg><h3>Tidak ditemukan</h3><p>Coba kata kunci lain</p></div>`;
        } else {
            if (!append) grid.innerHTML = allResults.map(renderCard).join('');
            else grid.innerHTML += list.map(renderCard).join('');
        }
        if (countEl) countEl.textContent = allResults.length
            ? `${allResults.length} hasil untuk "${q}"${hasNext ? '+' : ''}` : '';
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

function initSearchInput() {
    const input    = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const ph       = document.getElementById('search-placeholder');
    if (!input) return;
    if (currentQ) { input.value = currentQ; if (clearBtn) clearBtn.style.display = 'flex'; if (ph) ph.style.display = 'none'; }
    let timer;
    input.addEventListener('input', () => {
        const q = input.value.trim();
        if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
        if (ph) ph.style.display = q ? 'none' : 'block';
        clearTimeout(timer);
        if (!q) { document.getElementById('search-grid').innerHTML = ''; document.getElementById('result-count').textContent = ''; return; }
        timer = setTimeout(() => { currentQ = q; history.replaceState(null, '', `/search?q=${encodeURIComponent(q)}`); doSearch(q, 1); }, 400);
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { clearTimeout(timer); const q = input.value.trim(); if (q) { currentQ = q; doSearch(q, 1); } }
    });
    clearBtn?.addEventListener('click', () => {
        input.value = ''; clearBtn.style.display = 'none'; currentQ = '';
        document.getElementById('search-grid').innerHTML = '';
        document.getElementById('result-count').textContent = '';
        if (ph) ph.style.display = 'block';
        history.replaceState(null, '', '/search');
        input.focus();
    });
    input.focus();
}

function renderTrending() {
    const list = document.getElementById('trending-list');
    if (!list) return;
    const trending = ['One Piece','Naruto','Jujutsu Kaisen','Bleach','Attack on Titan','Demon Slayer','Blue Lock','Frieren'];
    list.innerHTML = trending.map((title, i) => `
        <div class="trending-item" onclick="setSearch('${title}')">
            <span class="trending-num ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <span class="trending-text">${title}</span>
            <span class="trending-icon"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9,18 15,12 9,6"/></svg></span>
        </div>`).join('');
}

function setSearch(q) {
    const input = document.getElementById('search-input');
    if (input) { input.value = q; input.dispatchEvent(new Event('input')); }
}

document.addEventListener('DOMContentLoaded', () => {
    initSearchInput();
    renderTrending();
    if (currentQ) doSearch(currentQ, 1);
    document.getElementById('load-more')?.addEventListener('click', () => { if (hasNext) doSearch(currentQ, currentPage + 1, true); });
});
