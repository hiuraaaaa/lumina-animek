// ── WATCH PAGE ──

const params    = new URLSearchParams(window.location.search);
const EP_SLUG   = params.get('slug') || '';
const BACK_SLUG = params.get('anime') || '';

let servers    = [];
let currentIdx = 0;
let epNav      = { prev: null, next: null };

async function init() {
    if (!EP_SLUG) { window.location.href = '/'; return; }
    try {
        const res  = await fetch(`/api/anime/episode/${EP_SLUG}`);
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Gagal');

        const ep = data.result || data;

        document.title = (ep.title || 'Nonton') + ' — AniStream';
        document.getElementById('ep-title').textContent = ep.title || 'Episode';
        document.getElementById('ep-sub').textContent   = ep.series?.name || (BACK_SLUG ? decodeURIComponent(BACK_SLUG).replace(/-/g,' ') : '');

        // Servers
        const mirrorServers = (ep.mirrors || []).map(m => ({ name: m.label, url: m.url }));
        if (ep.stream && !mirrorServers.length) mirrorServers.unshift({ name: 'Server 1', url: ep.stream });
        servers = mirrorServers;
        renderServers();
        if (servers.length) playServer(0);

        renderDownloads(ep.downloads || []);

        // Nav
        epNav.prev = ep.nav?.prev || null;
        epNav.next = ep.nav?.next || null;
        if (epNav.prev) document.getElementById('btn-prev').disabled = false;
        if (epNav.next) document.getElementById('btn-next').disabled = false;

        // Related & Recommended
        renderRelated(ep.related || []);
        renderRecommended(ep.recommended || []);

    } catch(e) {
        document.getElementById('player-loading').style.display = 'none';
        document.getElementById('player-error').style.display   = 'flex';
        showToast('Gagal: ' + e.message);
    }
}

function renderServers() {
    const wrap = document.getElementById('server-tabs');
    if (!servers.length) {
        wrap.innerHTML = '<span style="font-size:12px;color:var(--text3)">Tidak ada server</span>';
        return;
    }
    wrap.innerHTML = servers.map((s, i) => `
        <div class="server-tab" id="stab-${i}" onclick="playServer(${i})">
            <span class="tab-name">${s.name || 'Server ' + (i+1)}</span>
        </div>
    `).join('');
}

window.playServer = function(idx) {
    if (idx < 0 || idx >= servers.length) return;
    currentIdx = idx;
    const s      = servers[idx];
    const iframe = document.getElementById('iframe-player');
    const video  = document.getElementById('video-player');

    document.querySelectorAll('.server-tab').forEach((el, i) => el.classList.toggle('active', i === idx));
    showLoading();

    if (/\.(mp4|m3u8|webm)(\?|$)/i.test(s.url)) {
        iframe.style.display = 'none'; iframe.src = '';
        video.style.display  = 'block';
        video.src = s.url;
        video.load();
        video.play().catch(() => {});
    } else {
        video.style.display  = 'none'; video.src = '';
        iframe.style.display = 'block';
        iframe.src = s.url;
        if (/blogger\.com/i.test(s.url)) setTimeout(() => hideLoading(), 4000);
    }
};

window.tryNextServer = function() {
    const next = currentIdx + 1;
    if (next < servers.length) playServer(next);
    else showToast('Tidak ada server lain');
};

window.hideLoading = function() {
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('player-error').style.display   = 'none';
};

window.onVideoError = function() {
    document.getElementById('player-loading').style.display = 'none';
    document.getElementById('player-error').style.display   = 'flex';
};

window.goPrev = function() {
    if (!epNav.prev) return;
    const slug = epNav.prev.replace('https://oploverz.ch/', '').replace(/\/$/, '');
    window.location.href = '/watch?slug=' + slug;
};

window.goNext = function() {
    if (!epNav.next) return;
    const slug = epNav.next.replace('https://oploverz.ch/', '').replace(/\/$/, '');
    window.location.href = '/watch?slug=' + slug;
};

function showLoading() {
    document.getElementById('player-loading').style.display = 'flex';
    document.getElementById('player-error').style.display   = 'none';
}

function renderDownloads(downloads) {
    const wrap = document.getElementById('dl-group');
    if (!downloads.length) {
        wrap.innerHTML = '<span style="font-size:12px;color:var(--text3)">Tidak ada link download</span>';
        return;
    }
    wrap.innerHTML = downloads.map(d => `
        <a href="${d.url}" target="_blank" rel="noopener noreferrer" class="btn-dl">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ${d.label || 'Download'}
        </a>
    `).join('');
}

function renderRelated(list) {
    if (!list.length) return;
    const section = document.getElementById('rel-section');
    const wrap    = document.getElementById('rel-list');
    section.style.display = 'block';
    wrap.innerHTML = list.map(item => `
        <div class="rec-card" onclick="window.location.href='/watch?slug=${item.slug}'">
            <img src="${item.image || ''}" alt="${item.title || ''}" loading="lazy"
                 onerror="this.style.background='var(--bg3)'">
            <div class="rec-card-title">${item.title || ''}</div>
        </div>
    `).join('');
}

function renderRecommended(list) {
    if (!list.length) return;
    const section = document.getElementById('rec-section');
    const wrap    = document.getElementById('rec-list');
    section.style.display = 'block';
    wrap.innerHTML = list.map(item => {
        const slug = item.url.replace('https://oploverz.ch/series/', '').replace(/\/$/, '');
        return `
            <div class="rec-card" onclick="window.location.href='/detail?slug=${slug}'">
                <img src="${item.image || ''}" alt="${item.title || ''}" loading="lazy"
                     onerror="this.style.background='var(--bg3)'">
                <div class="rec-card-title">${item.title || ''}</div>
            </div>
        `;
    }).join('');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

init();
