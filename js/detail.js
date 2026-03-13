// ── DETAIL PAGE ──

const params      = new URLSearchParams(window.location.search);
const RAW_SLUG    = params.get('slug') || '';
let   epSort      = 'desc';
let   epPage      = 1;
const EP_PER_PAGE = 50;
let   allEps      = [];

// ── SLUG HELPER ──
function toAnimeSlug(slug) {
    return slug.replace(/-episode-.*/i, '')
               .replace(/-subtitle-.*/i, '')
               .replace(/-sub-indo.*/i, '')
               .replace(/-end$/i, '')
               .replace(/-tamat$/i, '')
               .trim();
}

const ANIME_SLUG = toAnimeSlug(RAW_SLUG);

// ── FETCH ──
async function fetchDetail(slug) {
    const urlParam = new URLSearchParams(window.location.search).get('url');
    const apiUrl   = urlParam
        ? '/api/anime/detail?url=' + encodeURIComponent(urlParam)
        : '/api/anime/anime/' + slug;
    const res  = await fetch(apiUrl);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.detail) throw new Error('Data tidak ditemukan');
    return data;
}

// ── RENDER ──
function renderDetail(data) {
    const d    = data.detail;
    const info = d.info || {};

    document.title = `${d.title} — AniStream`;

    // Hero bg
    const heroBg = document.getElementById('hero-bg');
    if (heroBg) heroBg.style.backgroundImage = `url('${d.cover || d.poster}')`;

    // Poster
    const posterEl = document.getElementById('detail-poster');
    if (posterEl) {
        posterEl.src     = d.cover || d.poster || '';
        posterEl.alt     = d.title;
        posterEl.onerror = () => posterEl.src = 'https://placehold.co/160x240/181818/333?text=No+Image';
    }

    // Judul
    setText('detail-title', d.title);

    // Judul Jepang
    const japanese = info['Japanese'] || info['Judul Jepang'] || info['japanese'] || '';
    const japEl    = document.getElementById('detail-japanese');
    if (japEl) { japEl.textContent = japanese; japEl.style.display = japanese ? 'block' : 'none'; }

    // Skor
    const score     = info['Skor'] || info['Score'] || info['Rating'] || '';
    const scoreWrap = document.getElementById('detail-score-wrap');
    if (score && scoreWrap) {
        setText('detail-score', score);
        scoreWrap.style.display = 'block';
    }

    // Status
    const statusEl = document.getElementById('detail-status');
    if (statusEl) {
        const status   = info['Status'] || info.status || '–';
        const ongoing  = status.toLowerCase().includes('ongoing') || status.toLowerCase().includes('berlangsung');
        statusEl.textContent = status;
        statusEl.className   = 'status-pill ' + (ongoing ? 'ongoing' : 'completed');
    }

    // Info grid (kartu kecil)
    setText('detail-studio',   info['Studio']        || info['studio']   || '–');
    setText('detail-type',     info['Tipe']          || info['Type']     || info['type'] || '–');
    setText('detail-season',   info['Musim']         || info['Season']   || info['season'] || '–');
    setText('detail-duration', info['Durasi']        || info['Duration'] || info['duration'] || '–');

    // Synopsis
    const synEl = document.getElementById('detail-synopsis');
    if (synEl) {
        let syn = (d.synopsis || '').replace(/^Sinopsis:\s*/i, '').trim();
        synEl.textContent = syn || 'Sinopsis belum tersedia untuk anime ini.';
        // Toggle hanya tampil kalau synopsis panjang
        const toggleEl = document.getElementById('synopsis-toggle');
        if (toggleEl) toggleEl.style.display = syn.length > 150 ? 'inline-block' : 'none';
    }

    // Genres
    const genresEl = document.getElementById('detail-genres');
    if (genresEl) {
        const genres = d.genres || [];
        genresEl.innerHTML = genres.map(g => {
            const name = typeof g === 'string' ? g : (g.name || '');
            return `<span class="genre-chip" onclick="goSearch('${name}')">${name}</span>`;
        }).join('') || '<span style="color:var(--text3);font-size:13px">–</span>';
    }

    // Info table lengkap — semua field dari scraper
    const infoTable = document.getElementById('detail-info-table');
    if (infoTable) {
        // Urutan tampil
        const fields = [
            ['Judul',          info['Judul']         || d.title],
            ['Japanese',       info['Japanese']      || info['Judul Jepang']],
            ['Produser',       info['Produser']      || info['Producer']],
            ['Tipe',           info['Tipe']          || info['Type']],
            ['Status',         info['Status']],
            ['Total Episode',  info['Total Episode'] || (d.total_episodes ? String(d.total_episodes) : null)],
            ['Durasi',         info['Durasi']        || info['Duration']],
            ['Tanggal Rilis',  info['Tanggal Rilis'] || info['Release Date'] || info['Aired']],
            ['Musim',          info['Musim']         || info['Season']],
            ['Studio',         info['Studio']],
            ['Skor',           info['Skor']          || info['Score']],
        ];
        infoTable.innerHTML = fields
            .filter(([, val]) => val && val.trim && val.trim())
            .map(([label, val]) => `
                <tr>
                    <td>${label}</td>
                    <td>${val}</td>
                </tr>`)
            .join('');
    }

    // Episodes
    allEps = d.episodes || d.episode_list || [];
    epPage = 1;
    renderEpisodes();
    updateWatchBtn();

    // Rekomendasi
    renderRecommendations(d.recommendations || []);
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '–';
}

// ── WATCH BUTTON ──
function updateWatchBtn() {
    const btn = document.getElementById('btn-watch');
    if (!btn || !allEps.length) return;
    const firstEp = allEps[0];
    btn.onclick   = () => goWatch(firstEp.slug || firstEp.url);
    btn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        Tonton ${firstEp.label || 'Episode 1'}
    `;
}

// ── EPISODE LIST ──
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
        container.innerHTML = `<div class="empty-state" style="padding:32px 0"><p>Belum ada episode tersedia</p></div>`;
        return;
    }

    container.innerHTML = slice.map((ep, i) => {
        const epNum   = ep.label ? ep.label.replace(/.*Episode\s*/i, '').trim() : (ep.num || ep.episode || '');
        const epTitle = ep.name || ep.title || ep.label || '';
        const epDate  = ep.date || ep.release_date || '';
        const epDest  = ep.slug || ep.url || '';
        return `
        <div class="ep-item" style="animation-delay:${(i % 20) * 25}ms" onclick="goWatch('${epDest}')">
            <div class="ep-num">Ep ${epNum}</div>
            <div class="ep-info">
                <div class="ep-title">${epTitle}</div>
                ${epDate ? `<div class="ep-date">${epDate}</div>` : ''}
            </div>
            <div class="ep-play">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <polyline points="9,18 15,12 9,6"/>
                </svg>
            </div>
        </div>`;
    }).join('');

    const loadMoreBtn = document.getElementById('ep-load-more');
    if (loadMoreBtn) loadMoreBtn.style.display = (epPage * EP_PER_PAGE) < sorted.length ? 'block' : 'none';
}

function loadMoreEps() { epPage++; renderEpisodes(); }

function toggleSort() {
    epSort = epSort === 'desc' ? 'asc' : 'desc';
    epPage = 1;
    const btn = document.getElementById('sort-btn');
    if (btn) btn.textContent = epSort === 'desc' ? '↓ Terbaru' : '↑ Terlama';
    renderEpisodes();
}

// ── REKOMENDASI ──
function renderRecommendations(recs) {
    const section = document.getElementById('rec-section');
    const grid    = document.getElementById('rec-grid');
    if (!section || !grid || !recs.length) return;

    grid.innerHTML = recs.map(a => {
        const cover = a.cover || a.poster || '';
        const url   = a.url   || '';
        let href = '/';
        if (url.includes('/anime/')) {
            const slug = url.replace(/\/$/, '').split('/').pop();
            href = '/detail?slug=' + slug;
        } else if (url) {
            href = '/detail?url=' + encodeURIComponent(url);
        }
        return `
        <div class="anime-card" onclick="window.location.href='${href}'">
            <div class="anime-card-poster">
                <img src="${cover}" alt="${a.title}" loading="lazy"
                     onerror="this.src='https://placehold.co/200x300/181818/333?text=No+Image'">
                <div class="anime-card-poster-overlay"></div>
                <div class="anime-card-info">
                    <div class="anime-card-title">${a.title}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    section.style.display = 'block';
}

// ── NAVIGATE ──
function goWatch(slugOrUrl) {
    if (!slugOrUrl) return;
    if (slugOrUrl.startsWith('http')) {
        window.location.href = '/watch?url=' + encodeURIComponent(slugOrUrl);
    } else {
        window.location.href = '/watch?slug=' + slugOrUrl;
    }
}
function goSearch(q) { window.location.href = `/search?q=${encodeURIComponent(q)}`; }

// ── SKELETON ──
function showSkeleton() {
    document.getElementById('detail-skeleton').style.display = 'block';
    document.getElementById('detail-content').style.display  = 'none';
}
function hideSkeleton() {
    document.getElementById('detail-skeleton').style.display = 'none';
    document.getElementById('detail-content').style.display  = 'block';
}

// ── INIT ──
async function init() {
    const urlParam = new URLSearchParams(window.location.search).get('url');
    if (!RAW_SLUG && !urlParam) { window.location.href = '/'; return; }

    showSkeleton();
    try {
        const data = await fetchDetail(ANIME_SLUG);
        hideSkeleton();
        renderDetail(data);
        window.currentAnimeSlug = ANIME_SLUG;
        window.currentAnimeData = data.detail;
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
                <small style="color:var(--text3);display:block;margin-top:8px">Slug: ${ANIME_SLUG}</small>
                <button onclick="history.back()" style="margin-top:16px;padding:8px 20px;background:var(--accent);color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">← Kembali</button>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', init);
