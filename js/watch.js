// ── WATCH PAGE ──

const params  = new URLSearchParams(window.location.search);
const EP_SLUG = params.get('slug') || '';

let servers    = [];
let currentIdx = 0;
let _epData    = null;
let _abortCtrl = null; // cancel pending fetch saat ganti server
let _playing   = false; // prevent double-click

async function init() {
    if (!EP_SLUG) { window.location.href = '/'; return; }
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

        // Build server list
        servers = [];
        if (ep.default_embed) {
            servers.push({ name: 'LunarSrv', url: ep.default_embed, type: 'embed' });
        }
        const qualities = ['720p', '480p', '360p'];
        for (const q of qualities) {
            const list = ep.mirrors?.[q] || [];
            for (let idx = 0; idx < list.length; idx++) {
                const m = list[idx];
                servers.push({ name: `${m.name} ${q}`, id: m.id, i: String(idx), q, type: 'mirror' });
            }
        }

        renderServers();
        if (servers.length) playServer(0);

        renderDownloads(ep.downloads || {});
        renderEpisodeList(ep.episode_list || [], EP_SLUG);

        // Nav prev/next
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        if (btnPrev) {
            if (ep.prev_episode) {
                const slug = ep.prev_episode.replace(/\/$/, '').split('/').pop();
                btnPrev.onclick  = () => window.location.href = `/watch?slug=${slug}`;
                btnPrev.disabled = false;
                btnPrev.style.opacity = '1';
            } else {
                btnPrev.disabled = true;
                btnPrev.style.opacity = '0.4';
            }
        }
        if (btnNext) {
            if (ep.next_episode) {
                const slug = ep.next_episode.replace(/\/$/, '').split('/').pop();
                btnNext.onclick  = () => window.location.href = `/watch?slug=${slug}`;
                btnNext.disabled = false;
                btnNext.style.opacity = '1';
            } else {
                btnNext.disabled = true;
                btnNext.style.opacity = '0.4';
            }
        }

        // Back to detail
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

function renderServers() {
    const wrap = document.getElementById('server-tabs');
    if (!wrap) return;
    wrap.innerHTML = servers.map((s, i) => `
        <div class="server-tab${i === 0 ? ' active' : ''}" id="stab-${i}" onclick="playServer(${i})">
            ${s.name}
        </div>
    `).join('');
}

window.playServer = async function(idx) {
    if (idx < 0 || idx >= servers.length) return;
    if (_playing && idx === currentIdx) return; // prevent double-click same server

    // Cancel fetch sebelumnya
    if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null; }

    currentIdx = idx;
    _playing   = true;
    document.querySelectorAll('.server-tab').forEach((t, i) => t.classList.toggle('active', i === idx));

    const s      = servers[idx];
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
                videoEl.id            = 'video-player';
                videoEl.controls      = true;
                videoEl.autoplay      = true;
                videoEl.style.cssText = 'width:100%;height:100%;background:#000;display:block;';
                videoEl.src           = d.result.mp4_url;
                videoEl.onerror       = () => window.tryNextServer();
                iframe.insertAdjacentElement('afterend', videoEl);
                document.getElementById('player-loading').style.display = 'none';
                document.getElementById('player-error').style.display   = 'none';
                _playing = false;
                return;
            }

            embedUrl = d.result?.embed_url || null;
            if (!embedUrl) {
                const r2 = await fetch(`/api/anime/resolve?id=${s.id}&i=${s.i}&q=${s.q}`, { signal });
                const d2 = await r2.json();
                if (d2.status) embedUrl = d2.result?.embed_url || null;
            }
        }

        iframe.style.display = 'block';

        if (!embedUrl) {
            window.hideLoading();
            document.getElementById('player-error').style.display = 'flex';
            _playing = false;
            return;
        }
        iframe.src = embedUrl;
        _playing   = false;

    } catch(e) {
        if (e.name === 'AbortError') return; // user ganti server, ignore
        window.hideLoading();
        document.getElementById('player-error').style.display = 'flex';
        showToast('Gagal load server: ' + e.message);
        _playing = false;
    }
};

window.tryNextServer = function() {
    const next = currentIdx + 1;
    if (next < servers.length) playServer(next);
    else {
        document.getElementById('player-loading').style.display = 'none';
        document.getElementById('player-error').style.display   = 'flex';
    }
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
    if (!entries.length) {
        wrap.innerHTML = '<p style="color:var(--text3);font-size:13px">Tidak ada link download</p>';
        return;
    }
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
        </div>
    `).join('');
}

function renderEpisodeList(list, currentSlug) {
    const section = document.getElementById('rel-section');
    const wrap    = document.getElementById('rel-list');
    if (!wrap || !list.length) return;
    section.style.display = 'block';

    // Scroll ke episode aktif setelah render
    wrap.innerHTML = list.map(ep => {
        const isActive = ep.slug === currentSlug;
        const num = ep.label.replace(/episode\s*/i, 'Ep ');
        return `<div class="rel-item${isActive ? ' active' : ''}" id="${isActive ? 'rel-active' : ''}"
            onclick="${isActive ? '' : `window.location.href='/watch?slug=${ep.slug}'`}">
            <span>${num}</span>
            ${isActive
                ? '<span style="font-size:11px;opacity:0.8">▶ Sedang diputar</span>'
                : '<span class="rel-item-num">▶</span>'}
        </div>`;
    }).join('');

    // Scroll ke episode aktif
    setTimeout(() => {
        const active = document.getElementById('rel-active');
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', init);
