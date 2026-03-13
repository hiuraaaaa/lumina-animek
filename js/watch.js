// ── WATCH PAGE ──

const params    = new URLSearchParams(window.location.search);
const EP_SLUG   = params.get('slug') || '';
const EP_URL    = params.get('url')  || '';

let servers    = [];
let currentIdx = 0;

async function init() {
    if (!EP_SLUG && !EP_URL) { window.location.href = '/'; return; }
    try {
        const apiUrl = EP_SLUG ? `/api/anime/episode/${EP_SLUG}` : `/api/anime/episode/${EP_URL.replace(/.*\/episode\//,'').replace(/\/$/,'')}`;
        const res    = await fetch(apiUrl);
        const data   = await res.json();
        if (!data.status) throw new Error(data.message || 'Gagal memuat episode');

        const ep = data.result;

        document.title = (ep.title || 'Nonton') + ' — AniStream';
        document.getElementById('ep-title').textContent = ep.title || 'Episode';
        document.getElementById('ep-sub').textContent   = ep.series?.name || '';

        // Build server list dari mirrors otakudesu
        // mirrors: { '360p': [{name, id, i, q}], '480p': [...], '720p': [...] }
        servers = [];
        const qualities = ['720p', '480p', '360p'];
        for (const q of qualities) {
            const list = ep.mirrors?.[q] || [];
            for (let i = 0; i < list.length; i++) {
                const m = list[i];
                servers.push({ name: `${m.name} ${q}`, id: m.id, i: String(i), q, type: 'mirror' });
            }
        }
        // Fallback: default_embed
        if (!servers.length && ep.default_embed) {
            servers.push({ name: 'Server 1', url: ep.default_embed, type: 'embed' });
        }

        renderServers();
        if (servers.length) playServer(0);

        // Downloads
        renderDownloads(ep.downloads || {});

        // Nav buttons
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        if (btnPrev) {
            if (ep.prev_episode) {
                const prevSlug = ep.prev_episode.replace(/\/$/, '').split('/').pop();
                btnPrev.onclick = () => window.location.href = `/watch?slug=${prevSlug}`;
                btnPrev.disabled = false;
            } else { btnPrev.disabled = true; }
        }
        if (btnNext) {
            if (ep.next_episode) {
                const nextSlug = ep.next_episode.replace(/\/$/, '').split('/').pop();
                btnNext.onclick = () => window.location.href = `/watch?slug=${nextSlug}`;
                btnNext.disabled = false;
            } else { btnNext.disabled = true; }
        }

        // Back to detail
        const btnBack = document.getElementById('btn-back');
        if (btnBack && ep.series_url) {
            const animeSlug = ep.series_url.replace(/\/$/, '').split('/').pop();
            btnBack.onclick = () => window.location.href = `/detail?slug=${animeSlug}`;
        }

    } catch(e) {
        document.getElementById('player-loading').style.display = 'none';
        document.getElementById('player-error').style.display   = 'flex';
        showToast('Gagal: ' + e.message);
    }
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
    currentIdx = idx;

    // Update active tab
    document.querySelectorAll('.server-tab').forEach((t, i) => t.classList.toggle('active', i === idx));

    const s      = servers[idx];
    const iframe = document.getElementById('iframe-player');
    if (!iframe) return;

    // Remove any old overlay
    const old = document.getElementById('blogger-btn');
    if (old) old.remove();

    showLoading();

    try {
        let embedUrl = s.url || null;

        // Kalau tipe mirror, resolve dulu via /api/anime/filedon atau /resolve
        if (s.type === 'mirror' && s.id) {
            // Coba filedon dulu
            const r = await fetch(`/api/anime/filedon?id=${s.id}&i=${s.i}&q=${s.q}`);
            const d = await r.json();
            if (d.status && d.result?.mp4_url) {
                // Direct MP4 — pakai <video> tag
                iframe.style.display = 'none';
                let videoEl = document.getElementById('video-player');
                if (!videoEl) {
                    videoEl    = document.createElement('video');
                    videoEl.id = 'video-player';
                    videoEl.controls    = true;
                    videoEl.autoplay    = true;
                    videoEl.style.cssText = 'width:100%;height:100%;background:#000;';
                    iframe.insertAdjacentElement('afterend', videoEl);
                }
                videoEl.src = d.result.mp4_url;
                videoEl.style.display = 'block';
                document.getElementById('player-loading').style.display = 'none';
                return;
            } else if (d.result?.embed_url) {
                embedUrl = d.result.embed_url;
            } else {
                // Fallback ke resolve
                const r2 = await fetch(`/api/anime/resolve?id=${s.id}&i=${s.i}&q=${s.q}`);
                const d2 = await r2.json();
                if (d2.status) embedUrl = d2.result?.embed_url;
            }
        }

        // Hide video player kalau ada
        const videoEl = document.getElementById('video-player');
        if (videoEl) videoEl.style.display = 'none';
        iframe.style.display = 'block';

        if (!embedUrl) {
            hideLoading();
            document.getElementById('player-error').style.display = 'flex';
            return;
        }
        iframe.src = embedUrl;
    } catch(e) {
        hideLoading();
        document.getElementById('player-error').style.display = 'flex';
        showToast('Gagal load server: ' + e.message);
    }
};

window.tryNextServer = function() {
    const next = currentIdx + 1;
    if (next < servers.length) playServer(next);
};

window.hideLoading = function() {
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('player-error').style.display   = 'none';
};

function showLoading() {
    document.getElementById('player-loading').style.display = 'flex';
    document.getElementById('player-error').style.display   = 'none';
}

function renderDownloads(downloads) {
    const wrap = document.getElementById('dl-group');
    if (!wrap) return;
    // downloads: { '720p': { size, servers: [{name, link}] } }
    const entries = Object.entries(downloads);
    if (!entries.length) {
        wrap.innerHTML = '<p style="color:var(--text3);font-size:13px">Tidak ada link download</p>';
        return;
    }
    wrap.innerHTML = entries.map(([quality, data]) => `
        <div class="dl-quality">
            <span class="dl-label">${quality} ${data.size ? '· ' + data.size : ''}</span>
            <div class="dl-links">
                ${(data.servers || []).map(l => `
                    <a href="${l.link}" target="_blank" rel="noopener" class="btn-dl">
                        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        ${l.name}
                    </a>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', init);
