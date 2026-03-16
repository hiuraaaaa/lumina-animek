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

// ── TRACEMOE SEARCH ──
async function doImageSearch(file) {
    const grid    = document.getElementById('search-grid');
    const countEl = document.getElementById('result-count');
    const ph      = document.getElementById('search-placeholder');
    if (ph) ph.style.display = 'none';

    // Show loading
    grid.innerHTML = `<div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:12px">
        <div style="width:36px;height:36px;border:2.5px solid var(--bg3);border-top-color:var(--accent2);border-radius:50%;animation:spin 0.7s linear infinite"></div>
        <div style="font-family:'Outfit',sans-serif;font-size:12px;color:var(--text3)">Mencari anime dari gambar...</div>
    </div>`;
    if (countEl) countEl.textContent = '';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const res  = await fetch('https://api-lumina-ashy.vercel.app/ai-tools/tracemoe', {
            method: 'POST',
            body: formData,
        });
        const data = await res.json();

        if (!data.status || !data.result) throw new Error('Tidak ada hasil ditemukan');

        const r = data.result;
        renderTracemoeResult(r);
        if (countEl) countEl.textContent = `Ditemukan dari gambar • Similarity ${r.similarity}`;

    } catch(e) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg><h3>Tidak Ditemukan</h3><p>${e.message}</p></div>`;
    }
}

function renderTracemoeResult(r) {
    const grid   = document.getElementById('search-grid');
    const title  = r.title?.english || r.title?.romaji || r.title?.native || 'Unknown';
    const romaji = r.title?.romaji || '';
    const cover  = r.cover || '';
    const ep     = r.episode ? `Episode ${r.episode}` : '';
    const genres = (r.genres || []).slice(0, 3).join(', ');
    const sim    = r.similarity || '';

    // Format timestamp
    const ts  = Math.floor(r.timestamp || 0);
    const min = Math.floor(ts / 60);
    const sec = ts % 60;
    const timestamp = `${min}:${sec.toString().padStart(2, '0')}`;

    grid.innerHTML = `
      <div style="grid-column:1/-1">
        <!-- RESULT CARD -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent2);padding:16px;display:flex;gap:14px;margin-bottom:12px">
          <img src="${escHtml(cover)}" alt="${escHtml(title)}"
            style="width:80px;aspect-ratio:2/3;object-fit:cover;flex-shrink:0;border:1px solid var(--border)"
            onerror="this.style.display='none'">
          <div style="flex:1;min-width:0">
            <div style="font-family:'Outfit',sans-serif;font-size:14px;font-weight:800;color:var(--text);line-height:1.3;margin-bottom:4px">${escHtml(title)}</div>
            ${romaji && romaji !== title ? `<div style="font-size:10px;color:var(--text3);margin-bottom:6px">${escHtml(romaji)}</div>` : ''}
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
              <span style="font-family:'Outfit',sans-serif;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;padding:2px 7px;background:rgba(124,58,237,0.15);color:var(--accent2);border:1px solid rgba(124,58,237,0.2)">${escHtml(sim)}</span>
              ${ep ? `<span style="font-family:'Outfit',sans-serif;font-size:8px;font-weight:800;text-transform:uppercase;padding:2px 7px;background:var(--bg3);color:var(--text2);border:1px solid var(--border)">${escHtml(ep)}</span>` : ''}
              <span style="font-family:'Outfit',sans-serif;font-size:8px;font-weight:800;text-transform:uppercase;padding:2px 7px;background:var(--bg3);color:var(--text2);border:1px solid var(--border)">${escHtml(timestamp)}</span>
              ${r.format ? `<span style="font-family:'Outfit',sans-serif;font-size:8px;font-weight:800;text-transform:uppercase;padding:2px 7px;background:var(--bg3);color:var(--text2);border:1px solid var(--border)">${escHtml(r.format)}</span>` : ''}
            </div>
            ${genres ? `<div style="font-size:10px;color:var(--text3)">${escHtml(genres)}</div>` : ''}
          </div>
        </div>

        <!-- PREVIEW IMAGE -->
        ${r.preview?.image ? `
        <div style="margin-bottom:12px">
          <div style="font-family:'Outfit',sans-serif;font-size:9px;font-weight:800;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Preview Scene</div>
          <img src="${escHtml(r.preview.image)}" alt="preview"
            style="width:100%;border:1px solid var(--border);display:block"
            onerror="this.style.display='none'">
        </div>` : ''}

        <!-- CARI DI LUNARSTREAM -->
        <button onclick="setSearch('${escHtml(r.title?.romaji || r.title?.english || '')}')"
          style="width:100%;padding:12px;background:var(--accent);color:white;border:none;border-radius:0;font-family:'Outfit',sans-serif;font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;cursor:pointer">
          Cari di LunarStream
        </button>
      </div>
    `;
}

function initSearchInput() {
    const input    = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const ph       = document.getElementById('search-placeholder');
    const camBtn   = document.getElementById('btn-camera');
    const camInput = document.getElementById('camera-input');

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

    // ── CAMERA / IMAGE SEARCH ──
    camBtn?.addEventListener('click', () => camInput?.click());
    camInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Clear input untuk allow same file again
        camInput.value = '';
        // Clear search text
        input.value = ''; if (clearBtn) clearBtn.style.display = 'none'; currentQ = '';
        doImageSearch(file);
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
