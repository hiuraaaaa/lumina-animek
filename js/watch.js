// ── WATCH PAGE ──

const params  = new URLSearchParams(window.location.search);
const EP_SLUG = params.get('slug') || '';

let servers    = [];
let currentIdx = 0;
let _epData    = null;
let _abortCtrl = null;
let _playing   = false;

// ── GUEST LIMIT (3 episode tanpa login) ──
const GUEST_LIMIT = 3;
const STORAGE_KEY = 'lunar_watched_guest';

function getGuestWatched() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function addGuestWatched(slug) {
    const list = getGuestWatched();
    if (!list.includes(slug)) {
        list.push(slug);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
}
function getGuestCount() { return getGuestWatched().length; }

function checkGuestLimit() {
    if (!EP_SLUG) return Promise.resolve(false); // fix bug 4: EP_SLUG kosong
    return new Promise(resolve => {
        const doCheck = () => {
            if (!window.FB) {
                // Firebase tidak ada — fallback ke guest limit
                _applyGuestCheck(resolve);
                return;
            }
            // fix bug 3: tunggu auth state settled, bukan langsung currentUser
            FB.onAuthStateChanged(FB.auth, (user) => {
                if (user) { resolve(false); return; } // sudah login
                _applyGuestCheck(resolve);
            });
        };
        if (window.FB) doCheck();
        else window.addEventListener('firebase-ready', doCheck, { once: true });
        // Timeout fallback 3s — kalau firebase tidak respond
        setTimeout(() => { _applyGuestCheck(resolve); }, 3000);
    });
}

function _applyGuestCheck(resolve) {
    const watched = getGuestWatched();
    if (!watched.includes(EP_SLUG) && watched.length >= GUEST_LIMIT) {
        resolve(true);
    } else {
        addGuestWatched(EP_SLUG);
        resolve(false);
    }
}

function showLoginGate() {
    // Prevent scroll & jumping
    document.body.style.overflow    = 'hidden';
    document.body.style.position    = 'fixed';
    document.body.style.width       = '100%';

    const playerWrap = document.querySelector('.player-wrap');
    if (playerWrap) playerWrap.style.filter = 'blur(8px)';

    const overlay = document.createElement('div');
    overlay.id = 'login-gate';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(8,8,8,0.88);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        overscroll-behavior: none;
        touch-action: none;
    `;
    overlay.innerHTML = `
        <div style="background:var(--bg2);border:1px solid var(--border);border-top:2px solid var(--accent2);padding:28px 24px;max-width:340px;width:100%;text-align:center;display:flex;flex-direction:column;gap:16px">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="var(--accent2)" style="margin:0 auto" viewBox="0 0 256 256"><path d="M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm72.77,97a8,8,0,0,1,1.43,8A96,96,0,1,1,95.07,37.8a8,8,0,0,1,10.6,9.06A88.07,88.07,0,0,0,209.14,150.33,8,8,0,0,1,216.77,153Zm-19.39,14.88c-1.79.09-3.59.14-5.38.14A104.11,104.11,0,0,1,88,64c0-1.79,0-3.59.14-5.38A80,80,0,1,0,197.38,167.86Z"></path></svg>
            <div>
                <div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">Batas Tontonan Gratis</div>
                <div style="font-size:12px;color:var(--text2);line-height:1.6">Kamu sudah menonton <strong>${GUEST_LIMIT} episode</strong> gratis. Login atau daftar gratis untuk lanjut nonton tanpa batas!</div>
            </div>
            <button onclick="window.location.href='/login'"
                style="width:100%;padding:13px;background:var(--accent);color:white;border:none;border-radius:0;font-family:'Outfit',sans-serif;font-size:11px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer">
                Login / Daftar Gratis
            </button>
            <div style="font-family:'Outfit',sans-serif;font-size:10px;color:var(--text3)">Gratis · Tidak perlu kartu kredit</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function init() {
    if (!EP_SLUG) { window.location.href = '/'; return; }

    // Cek guest limit sebelum load
    const needLogin = await checkGuestLimit();
    if (needLogin) {
        showLoginGate();
        return;
    }

    try {
        const res  = await fetch(`/api/anime/episode/${EP_SLUG}`);
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Gagal memuat episode');

        const ep = data.result;
        _epData  = ep;

        document.title = (ep.title || 'Nonton') + ' — LunarStream';
        const titleEl = document.getElementById('ep-title');
        const subEl   = document.getElementById('ep-sub');
        if (titleEl) titleEl.textContent = ep.title || 'Episode';
        if (subEl)   subEl.textContent   = '';

        servers = [];
        if (ep.default_embed) {
            servers.push({ name: 'Lunar', url: ep.default_embed, type: 'embed', q: 'default' });
        }
        const qualities = ['720p', '480p', '360p'];
        for (const q of qualities) {
            const list = ep.mirrors?.[q] || [];
            for (let idx = 0; idx < list.length; idx++) {
                const m = list[idx];
                servers.push({ name: m.name, id: m.id, i: String(idx), q, type: 'mirror' });
            }
        }

        const preferredQ = ['720p', '480p', '360p', 'default'];
        activeQuality = preferredQ.find(q => servers.some(s => s.q === q)) || 'all';

        renderQualityChips();
        renderServers();

        const firstServer = getFilteredServers()[0];
        if (firstServer) playServer(servers.indexOf(firstServer));

        renderDownloads(ep.downloads || {});
        renderEpisodeList(ep.episode_list || [], EP_SLUG);

        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        if (btnPrev) {
            if (ep.prev_episode) {
                const slug = ep.prev_episode.replace(/\/$/, '').split('/').pop();
                btnPrev.onclick  = () => window.location.href = `/watch?slug=${slug}`;
                btnPrev.disabled = false; btnPrev.style.opacity = '1';
            } else { btnPrev.disabled = true; btnPrev.style.opacity = '0.4'; }
        }
        if (btnNext) {
            if (ep.next_episode) {
                const slug = ep.next_episode.replace(/\/$/, '').split('/').pop();
                btnNext.onclick  = () => window.location.href = `/watch?slug=${slug}`;
                btnNext.disabled = false; btnNext.style.opacity = '1';
            } else { btnNext.disabled = true; btnNext.style.opacity = '0.4'; }
        }

        const btnBack = document.getElementById('btn-back');
        if (btnBack && ep.series_url) {
            const animeSlug = ep.series_url.replace(/\/$/, '').split('/').pop();
            btnBack.onclick = () => window.location.href = `/detail?slug=${animeSlug}`;
        }

        trackEpisode(ep);

    } catch(e) {
        document.getElementById('player-loading').style.display = 'none';
        document.getElementById('player-error').style.display   = 'flex';
        showToast('Gagal: ' + e.message);
    }
}

// ── TRACK EPISODE ──
function trackEpisode(ep) {
    const doTrack = () => {
        if (!window.FB) return;
        FB.onAuthStateChanged(FB.auth, (user) => {
            if (!user) return;
            FB.trackWatchedEpisode(user.uid, {
                slug:       EP_SLUG,
                title:      ep.title || '',
                seriesName: ep.series_name || '',
                seriesUrl:  ep.series_url  || '',
            });
        });
    };
    if (window.FB) doTrack();
    else window.addEventListener('firebase-ready', doTrack, { once: true });
}

let activeQuality = 'all';

function renderQualityChips() {
    const wrap = document.getElementById('quality-chips');
    if (!wrap) return;
    const available = ['all'];
    if (servers.some(s => s.q === 'default')) available.push('default');
    ['720p', '480p', '360p'].forEach(q => { if (servers.some(s => s.q === q)) available.push(q); });
    if (available.length <= 2) { wrap.style.display = 'none'; return; }
    const labels = { all: 'Semua', default: 'Lunar', '720p': '720p', '480p': '480p', '360p': '360p' };
    wrap.innerHTML = available.map(q => `
        <div class="quality-chip${q === activeQuality ? ' active' : ''}" onclick="setQuality('${q}')">${labels[q] || q}</div>
    `).join('');
}

window.setQuality = function(q) {
    activeQuality = q;
    document.querySelectorAll('.quality-chip').forEach(el => {
        el.classList.toggle('active', el.textContent.trim() === (q === 'all' ? 'Semua' : q === 'default' ? 'Lunar' : q));
    });
    renderServers();
    const filtered = getFilteredServers();
    if (filtered.length) { const idx = servers.indexOf(filtered[0]); if (idx >= 0) playServer(idx); }
};

function getFilteredServers() {
    if (activeQuality === 'all') return servers;
    return servers.filter(s => s.q === activeQuality);
}

function renderServers() {
    const wrap = document.getElementById('server-tabs');
    if (!wrap) return;
    const filtered = getFilteredServers();
    if (!filtered.length) { wrap.innerHTML = '<span style="font-size:11px;color:var(--text3)">Tidak ada server</span>'; return; }
    // fix bug 2: pakai realIdx (index di servers) untuk active check
    wrap.innerHTML = filtered.map((s) => {
        const realIdx = servers.indexOf(s);
        const isActive = realIdx === currentIdx;
        return `<div class="server-tab${isActive ? ' active' : ''}" data-idx="${realIdx}" onclick="playServer(${realIdx})">${s.name}</div>`;
    }).join('');
}

window.playServer = async function(idx) {
    if (idx < 0 || idx >= servers.length) return;
    if (_playing && idx === currentIdx) return;
    if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null; }
    currentIdx = idx; _playing = true;
    // fix bug 5: highlight berdasarkan data-idx bukan DOM index
    document.querySelectorAll('.server-tab').forEach(t => t.classList.toggle('active', Number(t.dataset.idx) === idx));
    const s = servers[idx];
    const iframe = document.getElementById('iframe-player');
    if (!iframe) return;
    const oldVideo = document.getElementById('video-player');
    if (oldVideo) oldVideo.remove();
    window.showLoading();
    _abortCtrl = new AbortController();
    const signal = _abortCtrl.signal;
    try {
        let embedUrl = s.url || null;
        if (s.type === 'mirror' && s.id) {
            const r = await fetch(`/api/anime/filedon?id=${s.id}&i=${s.i}&q=${s.q}`, { signal });
            const d = await r.json();
            if (d.status && d.result?.mp4_url) {
                iframe.style.display = 'none';
                const videoEl = document.createElement('video');
                videoEl.id = 'video-player'; videoEl.controls = true; videoEl.autoplay = true;
                videoEl.style.cssText = 'width:100%;height:100%;background:#000;display:block;';
                videoEl.src = d.result.mp4_url;
                videoEl.onerror = () => window.tryNextServer();
                iframe.insertAdjacentElement('afterend', videoEl);
                document.getElementById('player-loading').style.display = 'none';
                document.getElementById('player-error').style.display   = 'none';
                _playing = false; return;
            }
            embedUrl = d.result?.embed_url || null;
            if (!embedUrl) {
                const r2 = await fetch(`/api/anime/resolve?id=${s.id}&i=${s.i}&q=${s.q}`, { signal });
                const d2 = await r2.json();
                if (d2.status) embedUrl = d2.result?.embed_url || null;
            }
        }
        iframe.style.display = 'block';
        if (!embedUrl) { window.hideLoading(); document.getElementById('player-error').style.display = 'flex'; _playing = false; return; }
        iframe.src = embedUrl; _playing = false;
    } catch(e) {
        if (e.name === 'AbortError') return;
        window.hideLoading();
        document.getElementById('player-error').style.display = 'flex';
        showToast('Gagal load server: ' + e.message);
        _playing = false;
    }
};

window.tryNextServer = function() {
    const next = currentIdx + 1;
    if (next < servers.length) playServer(next);
    else { document.getElementById('player-loading').style.display = 'none'; document.getElementById('player-error').style.display = 'flex'; }
};
window.hideLoading = function() {
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('player-error').style.display   = 'none';
};
window.showLoading = function() {
    document.getElementById('player-loading').style.display = 'flex';
    document.getElementById('player-error').style.display   = 'none';
};

function renderDownloads(downloads) {
    const wrap = document.getElementById('dl-group');
    if (!wrap) return;
    const entries = Object.entries(downloads);
    if (!entries.length) { wrap.innerHTML = '<p style="color:var(--text3);font-size:13px">Tidak ada link download</p>'; return; }
    wrap.innerHTML = entries.map(([quality, data]) => `
        <div class="dl-quality">
            <span class="dl-label">${quality}${data.size ? ' · ' + data.size : ''}</span>
            <div class="dl-links">
                ${(data.servers || []).map(l => `
                    <a href="${l.link}" target="_blank" rel="noopener" class="btn-dl">
                        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        ${l.name}
                    </a>
                `).join('')}
            </div>
        </div>`).join('');
}

function renderEpisodeList(list, currentSlug) {
    const section = document.getElementById('rel-section');
    const wrap    = document.getElementById('rel-list');
    if (!wrap || !list.length) return;
    section.style.display = 'block';
    wrap.innerHTML = list.map(ep => {
        const isActive = ep.slug === currentSlug;
        const num = ep.label.replace(/episode\s*/i, 'Ep ');
        return `<div class="rel-item${isActive ? ' active' : ''}" id="${isActive ? 'rel-active' : ''}"
            onclick="${isActive ? '' : `window.location.href='/watch?slug=${ep.slug}'`}">
            <span>${num}</span>
            ${isActive ? '<span style="font-size:11px;opacity:0.8">▶ Sedang diputar</span>' : '<span class="rel-item-num">▶</span>'}
        </div>`;
    }).join('');
    setTimeout(() => {
        const active = document.getElementById('rel-active');
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', init);
