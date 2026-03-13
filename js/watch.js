// ── WATCH PAGE ──
// Scraper: /api/anime/stream?url=...
// Response: { status, result: { title, cover, series_url, next_episode,
//             default_embed, mirrors{360p,480p,720p}, downloads, episode_list } }

const params  = new URLSearchParams(window.location.search);
const EP_SLUG = params.get('slug') || '';

let servers    = [];
let currentIdx = 0;
let nextUrl    = null;
let prevUrl    = null;

// ── Slug → URL helper ──
function slugToUrl(slug) {
    return `https://otakudesu.blog/episode/${slug}/`;
}

// ── URL → slug helper ──
function urlToSlug(url) {
    return (url || '').replace(/\/$/, '').split('/').pop();
}

async function init() {
    if (!EP_SLUG) { window.location.href = '/'; return; }

    try {
        const epFullUrl = slugToUrl(EP_SLUG);
        const res  = await fetch(`/api/anime/stream?url=${encodeURIComponent(epFullUrl)}`);
        const data = await res.json();
        if (!data.status) throw new Error(data.error || 'Gagal memuat episode');

        const ep = data.result;

        document.title = (ep.title || 'Nonton') + ' — AniStream';
        setText('ep-title', ep.title || 'Episode');

        // Series name dari series_url
        const subEl = document.getElementById('ep-sub');
        if (subEl && ep.series_url) {
            const seriesSlug = urlToSlug(ep.series_url);
            const seriesName = seriesSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            subEl.textContent  = seriesName;
            subEl.onclick      = () => window.location.href = `/detail?slug=${urlToSlug(ep.series_url)}`;
            subEl.style.cursor = 'pointer';
        }

        // ── Build server list ──
        servers = [];

        if (ep.default_embed) {
            servers.push({ name: 'Default', url: ep.default_embed, type: 'embed' });
        }

        // mirrors dari scraper: { '360p': [{name, id, i, q}], '480p': [...], '720p': [...] }
        const qualities = ['720p', '480p', '360p'];
        for (const q of qualities) {
            const list = ep.mirrors?.[q] || [];
            list.forEach((m, idx) => {
                if (m.id) {
                    servers.push({ name: `${m.name} ${q}`, id: m.id, i: String(m.i ?? idx), q, type: 'mirror' });
                } else if (m.url) {
                    servers.push({ name: `${m.name} ${q}`, url: m.url, type: 'embed' });
                }
            });
        }

        renderServers();
        if (servers.length) playServer(0);

        renderDownloads(ep.downloads || {});
        renderRelated(ep.episode_list || [], epFullUrl);

        // Prev/next — scraper hanya return next_episode, prev harus dicari dari episode_list
        nextUrl = ep.next_episode || null;
        prevUrl = findPrevUrl(ep.episode_list || [], epFullUrl);

        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        if (btnPrev) btnPrev.disabled = !prevUrl;
        if (btnNext) btnNext.disabled = !nextUrl;

    } catch(e) {
        document.getElementById('player-loading').style.display = 'none';
        document.getElementById('player-error').style.display   = 'flex';
        showToast('Gagal: ' + e.message);
    }
}

// Scraper tidak return prev_episode — cari dari episode_list
function findPrevUrl(epList, currentUrl) {
    if (!epList.length) return null;
    const currentSlug = urlToSlug(currentUrl);
    const idx = epList.findIndex(ep => urlToSlug(ep.url) === currentSlug);
    // episode_list urutan DESC (terbaru duluan), jadi prev = idx + 1
    return idx !== -1 && idx + 1 < epList.length ? epList[idx + 1].url : null;
}

// ── NAV ──
window.goPrev = function() {
    if (!prevUrl) return;
    window.location.href = `/watch?slug=${urlToSlug(prevUrl)}`;
};
window.goNext = function() {
    if (!nextUrl) return;
    window.location.href = `/watch?slug=${urlToSlug(nextUrl)}`;
};

// ── SERVER TABS ──
function renderServers() {
    const wrap = document.getElementById('server-tabs');
    if (!wrap) return;
    if (!servers.length) {
        wrap.innerHTML = '<span style="font-size:12px;color:var(--text3)">Tidak ada server tersedia</span>';
        return;
    }
    wrap.innerHTML = servers.map((s, i) => `
        <div class="server-tab${i === 0 ? ' active' : ''}" id="stab-${i}" onclick="playServer(${i})">
            <span class="tab-name">${s.name}</span>
        </div>
    `).join('');
}

// ── PLAY SERVER ──
window.playServer = async function(idx) {
    if (idx < 0 || idx >= servers.length) return;
    currentIdx = idx;

    document.querySelectorAll('.server-tab').forEach((t, i) => t.classList.toggle('active', i === idx));

    const s       = servers[idx];
    const iframe  = document.getElementById('iframe-player');
    const videoEl = document.getElementById('video-player');
    if (!iframe || !videoEl) return;

    showLoading();

    // Reset dulu
    iframe.src            = '';
    iframe.style.display  = 'none';
    videoEl.src           = '';
    videoEl.style.display = 'none';

    try {
        let embedUrl = s.url || null;

        if (s.type === 'mirror' && s.id) {
            const isFd = s.name.toLowerCase().includes('filedon');

            if (isFd) {
                // Coba bypass filedon → MP4 direct
                const r = await fetch(`/api/anime/filedon?id=${s.id}&i=${s.i}&q=${s.q}`);
                const d = await r.json();
                if (d.status && d.result?.mp4_url) {
                    videoEl.src           = d.result.mp4_url;
                    videoEl.style.display = 'block';
                    videoEl.play().catch(() => {});
                    return;
                }
                // Filedon gagal extract MP4, pakai embed URL-nya
                embedUrl = d.result?.embed_url || null;
            }

            // Non-filedon atau filedon gagal → resolve embed
            if (!embedUrl) {
                const r2 = await fetch(`/api/anime/resolve?id=${s.id}&i=${s.i}&q=${s.q}`);
                const d2 = await r2.json();
                embedUrl = d2.result?.embed_url || null;
            }
        }

        if (!embedUrl) {
            hideLoading();
            document.getElementById('player-error').style.display = 'flex';
            return;
        }

        iframe.src           = embedUrl;
        iframe.style.display = 'block';

    } catch(e) {
        hideLoading();
        document.getElementById('player-error').style.display = 'flex';
        showToast('Gagal load server: ' + e.message);
    }
};

window.tryNextServer = function() {
    if (currentIdx + 1 < servers.length) playServer(currentIdx + 1);
    else showToast('Tidak ada server lain');
};

window.onVideoError = function() {
    document.getElementById('video-player').style.display = 'none';
    hideLoading();
    document.getElementById('player-error').style.display = 'flex';
};

window.hideLoading = function() {
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('player-error').style.display   = 'none';
};

function showLoading() {
    document.getElementById('player-loading').style.display = 'flex';
    document.getElementById('player-error').style.display   = 'none';
}

// ── DOWNLOADS ──
function renderDownloads(downloads) {
    const wrap = document.getElementById('dl-group');
    if (!wrap) return;

    const entries = Object.entries(downloads);
    if (!entries.length) {
        wrap.innerHTML = '<span style="font-size:12px;color:var(--text3)">Tidak ada link download</span>';
        return;
    }

    const batchEntries   = entries.filter(([q]) => q.toLowerCase().includes('batch'));
    const regularEntries = entries.filter(([q]) => !q.toLowerCase().includes('batch'));

    const order = ['1080p', '720p', '480p', '360p'];
    const sortFn = (a, b) => {
        const ai = order.findIndex(o => a[0].includes(o));
        const bi = order.findIndex(o => b[0].includes(o));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    };
    regularEntries.sort(sortFn);

    const renderGroup = (label, list) => {
        if (!list.length) return '';
        return `
            <div style="width:100%;font-size:10px;font-weight:700;color:var(--text3);
                text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 6px">${label}</div>
            ${list.map(([quality, data]) => `
                <div style="width:100%;margin-bottom:8px">
                    <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:6px">
                        ${quality}${data.size ? ' · ' + data.size : ''}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
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
            `).join('')}
        `;
    };

    wrap.innerHTML = renderGroup('Episode', regularEntries) + renderGroup('Batch', batchEntries);
}

// ── RELATED EPISODES ──
// episode_list: [{label, url}] — urutan DESC (terbaru duluan dari scraper)
function renderRelated(epList, currentUrl) {
    const section = document.getElementById('rel-section');
    const list    = document.getElementById('rel-list');
    if (!section || !list || !epList.length) return;

    const currentSlug = urlToSlug(currentUrl);

    list.innerHTML = epList.map(ep => {
        const slug  = urlToSlug(ep.url);
        const isNow = slug === currentSlug;
        const label = ep.label || slug;
        return `
        <div class="rec-card" 
             onclick="${isNow ? '' : `window.location.href='/watch?slug=${urlToSlug(ep.url)}'`}"
             style="${isNow ? 'border-color:var(--accent);opacity:0.6;cursor:default;' : ''}">
            <div style="padding:10px 8px;min-height:52px;display:flex;align-items:center;justify-content:center">
                <div class="rec-card-title" style="text-align:center">${label}</div>
            </div>
        </div>`;
    }).join('');

    section.style.display = 'block';
}

// ── HELPER ──
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', init);
