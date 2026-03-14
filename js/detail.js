// ── DETAIL PAGE ──

const params      = new URLSearchParams(window.location.search);
const RAW_SLUG    = params.get('slug') || '';
let   epSort      = 'desc';
let   epPage      = 1;
const EP_PER_PAGE = 50;
let   allEps      = [];
let   _currentAnime = null; // untuk watchlist

function toAnimeSlug(slug) {
    return slug.replace(/-episode-.*/i, '')
               .replace(/-subtitle-.*/i, '')
               .replace(/-sub-indo.*/i, '')
               .replace(/-end$/i, '')
               .replace(/-tamat$/i, '')
               .trim();
}

const ANIME_SLUG = toAnimeSlug(RAW_SLUG);

function esc(str) {
    return (str || '').toString()
        .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function cleanVal(label, val) {
    if (!val) return '';
    return val.toString().replace(new RegExp('^' + label + '\\s*:\\s*', 'i'), '').trim();
}

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

function renderDetail(data) {
    const d    = data.detail;
    const info = d.info || {};

    document.title = `${d.title} — LunarStream`;

    const heroBg = document.getElementById('hero-bg');
    if (heroBg) heroBg.style.backgroundImage = `url('${esc(d.cover || d.poster)}')`;

    const posterEl = document.getElementById('detail-poster');
    if (posterEl) {
        posterEl.src     = d.cover || d.poster || '';
        posterEl.alt     = d.title;
        posterEl.onerror = () => posterEl.src = 'https://placehold.co/160x240/181818/333?text=No+Image';
    }

    setText('detail-title', d.title);

    const japanese = cleanVal('Japanese', info['Japanese'] || info['Judul Jepang'] || '');
    const japEl    = document.getElementById('detail-japanese');
    if (japEl) { japEl.textContent = japanese; japEl.style.display = japanese ? 'block' : 'none'; }

    const rawScore  = info['Skor'] || info['Score'] || info['Rating'] || '';
    const score     = cleanVal('Skor', rawScore);
    const scoreWrap = document.getElementById('detail-score-wrap');
    if (score && score !== '-' && scoreWrap) {
        setText('detail-score', score);
        scoreWrap.style.display = 'block';
    }

    const statusEl = document.getElementById('detail-status');
    if (statusEl) {
        const rawStatus = info['Status'] || '';
        const status    = cleanVal('Status', rawStatus) || '–';
        const ongoing   = status.toLowerCase().includes('ongoing') || status.toLowerCase().includes('berlangsung');
        statusEl.textContent = status;
        statusEl.className   = 'status-pill ' + (ongoing ? 'ongoing' : 'completed');
    }

    const tipe     = cleanVal('Tipe',          info['Tipe']          || info['Type']    || '');
    const totalEp  = cleanVal('Total Episode', info['Total Episode'] || '') || (d.total_episodes ? String(d.total_episodes) : '');
    const badgesEl = document.getElementById('detail-badges');
    if (badgesEl) {
        const badges = [tipe, totalEp ? totalEp + ' Ep' : ''].filter(Boolean);
        badgesEl.innerHTML = badges.map(b => `<span class="info-badge">${esc(b)}</span>`).join('');
    }

    const synEl = document.getElementById('detail-synopsis');
    if (synEl) {
        const syn = (d.synopsis || '').replace(/^Sinopsis:\s*/i, '').trim();
        synEl.textContent = syn || 'Sinopsis belum tersedia untuk anime ini.';
        const toggleEl = document.getElementById('synopsis-toggle');
        if (toggleEl) toggleEl.style.display = syn.length > 150 ? 'inline-block' : 'none';
    }

    const genresEl = document.getElementById('detail-genres');
    if (genresEl) {
        const genres = d.genres || [];
        genresEl.innerHTML = genres.map(g => {
            const name = typeof g === 'string' ? g : (g.name || '');
            return `<span class="genre-chip" onclick="goSearch('${esc(name)}')">${esc(name)}</span>`;
        }).join('') || '<span style="color:var(--text3);font-size:13px">–</span>';
    }

    const infoTable = document.getElementById('detail-info-table');
    if (infoTable) {
        const fields = [
            ['Judul',         info['Judul']         || d.title],
            ['Japanese',      info['Japanese']      || info['Judul Jepang']],
            ['Produser',      info['Produser']      || info['Producer']],
            ['Tipe',          info['Tipe']          || info['Type']],
            ['Status',        info['Status']],
            ['Total Episode', info['Total Episode'] || (d.total_episodes ? String(d.total_episodes) : null)],
            ['Durasi',        info['Durasi']        || info['Duration']],
            ['Tanggal Rilis', info['Tanggal Rilis'] || info['Release Date'] || info['Aired']],
            ['Musim',         info['Musim']         || info['Season']],
            ['Studio',        info['Studio']],
            ['Skor',          info['Skor']          || info['Score']],
        ];
        infoTable.innerHTML = fields
            .map(([label, val]) => [label, cleanVal(label, val)])
            .filter(([, val]) => val && val !== 'Unknown' && val !== '?' && val !== '-')
            .map(([label, val]) => `<tr><td>${esc(label)}</td><td>${esc(val)}</td></tr>`)
            .join('');
    }

    allEps = d.episodes || d.episode_list || [];
    epPage = 1;
    renderEpisodes();
    updateWatchBtn();
    renderRecommendations(d.recommendations || []);

    // simpan data anime untuk watchlist
    _currentAnime = {
        slug:   ANIME_SLUG,
        title:  d.title  || '',
        cover:  d.cover  || d.poster || '',
        poster: d.poster || d.cover  || '',
        url:    d.url    || '',
    };
    window.currentAnimeSlug = ANIME_SLUG;
    window.currentAnimeData = d;

    // init watchlist button setelah firebase ready
    initWatchlistBtn();
}

// ── WATCHLIST ──
function initWatchlistBtn() {
    const doInit = () => {
        if (!window.FB) return;
        FB.onAuthStateChanged(FB.auth, async (user) => {
            if (!user) return; // tidak login = tombol tetap default
            const profile = await FB.getUserProfile(user.uid);
            const list    = profile?.watchlist || [];
            const saved   = list.some(a => a.slug === ANIME_SLUG);
            updateSaveBtn(saved);
        });
    };
    if (window.FB) doInit();
    else window.addEventListener('firebase-ready', doInit, { once: true });
}

function updateSaveBtn(saved) {
    const btn = document.getElementById('btn-save');
    if (!btn) return;
    btn.classList.toggle('saved', saved);
    btn.innerHTML = saved
        ? `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
        : `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
}

window.toggleWatchlist = async function() {
    if (!window.FB) return showToast('Memuat...');

    const user = FB.auth.currentUser;
    if (!user) {
        window.location.href = '/login';
        return;
    }
    if (!_currentAnime) return;

    try {
        const profile  = await FB.getUserProfile(user.uid);
        const list     = profile?.watchlist || [];
        const idx      = list.findIndex(a => a.slug === ANIME_SLUG);
        const isSaved  = idx >= 0;

        let newList;
        if (isSaved) {
            newList = list.filter(a => a.slug !== ANIME_SLUG);
        } else {
            newList = [_currentAnime, ...list];
        }

        await FB.updateUserProfile(user.uid, { watchlist: newList });
        updateSaveBtn(!isSaved);
        showToast(isSaved ? 'Dihapus dari watchlist' : 'Ditambahkan ke watchlist!');
    } catch(e) {
        showToast('Gagal: ' + e.message);
    }
};

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '–';
}

function updateWatchBtn() {
    const btn = document.getElementById('btn-watch');
    if (!btn) return;
    if (!allEps.length) { btn.style.display = 'none'; return; }
    const firstEp = allEps[0];
    const label   = firstEp.label
        ? firstEp.label.replace(/subtitle indonesia/i, '').trim()
        : 'Episode 1';
    btn.onclick   = () => goWatch(firstEp.slug || firstEp.url);
    btn.innerHTML = `
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        Tonton ${esc(label)}
    `;
}

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
        const epNum   = ep.label
            ? ep.label.replace(/.*Episode\s*/i, '').replace(/subtitle indonesia/i, '').trim()
            : (ep.num || ep.episode || '');
        const epTitle = ep.name || ep.title || ep.label || '';
        const epDate  = ep.date || ep.release_date || '';
        const epDest  = ep.slug || ep.url || '';
        return `
        <div class="ep-item" style="animation-delay:${(i % 20) * 25}ms" onclick="goWatch('${esc(epDest)}')">
            <div class="ep-num">Ep ${esc(epNum)}</div>
            <div class="ep-info">
                <div class="ep-title">${esc(epTitle)}</div>
                ${epDate ? `<div class="ep-date">${esc(epDate)}</div>` : ''}
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

function renderRecommendations(recs) {
    const section = document.getElementById('rec-section');
    const grid    = document.getElementById('rec-grid');
    if (!section || !grid) return;
    if (!recs.length) { section.style.display = 'none'; return; }

    grid.innerHTML = recs.map(a => {
        const cover = a.cover || a.poster || '';
        const url   = a.url   || '';
        let href;
        if (url.includes('/anime/')) {
            href = '/detail?slug=' + url.replace(/\/$/, '').split('/').pop();
        } else if (url) {
            href = '/detail?url=' + encodeURIComponent(url);
        } else {
            href = '/';
        }
        return `
        <div class="anime-card" onclick="window.location.href='${href}'">
            <div class="anime-card-poster">
                <img src="${esc(cover)}" alt="${esc(a.title)}" loading="lazy"
                     onerror="this.src='https://placehold.co/200x300/181818/333?text=No+Image'">
                <div class="anime-card-poster-overlay"></div>
                <div class="anime-card-info">
                    <div class="anime-card-title">${esc(a.title)}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    section.style.display = 'block';
}

function goWatch(slugOrUrl) {
    if (!slugOrUrl) return;
    if (slugOrUrl.startsWith('http')) {
        window.location.href = '/watch?url=' + encodeURIComponent(slugOrUrl);
    } else {
        window.location.href = '/watch?slug=' + slugOrUrl;
    }
}
function goSearch(q) { window.location.href = `/search?q=${encodeURIComponent(q)}`; }

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

async function init() {
    const urlParam = new URLSearchParams(window.location.search).get('url');
    if (!RAW_SLUG && !urlParam) { window.location.href = '/'; return; }

    showSkeleton();
    try {
        const data = await fetchDetail(ANIME_SLUG);
        hideSkeleton();
        renderDetail(data);
    } catch (err) {
        hideSkeleton();
        const ct = document.getElementById('detail-content');
        if (ct) ct.innerHTML = `
            <div class="empty-state" style="padding:80px 24px">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Gagal Memuat</h3>
                <p>${esc(err.message)}</p>
                <small style="color:var(--text3);display:block;margin-top:8px">Slug: ${esc(ANIME_SLUG)}</small>
                <button onclick="history.back()" style="margin-top:16px;padding:8px 20px;background:var(--accent);color:white;border:none;font-size:13px;font-weight:600;cursor:pointer">← Kembali</button>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', init);
