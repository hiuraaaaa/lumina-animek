// ── WATCH PAGE ──

const params   = new URLSearchParams(window.location.search);
const EP_SLUG  = params.get('slug') || '';
const BACK_SLUG = params.get('anime') || '';

let servers    = [];
let currentIdx = 0;

async function init() {
    if (!EP_SLUG) { window.location.href = '/'; return; }
    try {
        const res  = await fetch(`/api/anime/episode/${EP_SLUG}`);
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Gagal');

        // Support format baru: data.result
        const ep = data.result || data;

        document.title = (ep.title || 'Nonton') + ' — AniStream';
        document.getElementById('ep-title').textContent = ep.title || 'Episode';
        document.getElementById('ep-sub').textContent   = ep.series?.name || (BACK_SLUG ? decodeURIComponent(BACK_SLUG).replace(/-/g,' ') : '');

        // Mirrors → servers. Tambah stream utama juga
        const mirrorServers = (ep.mirrors || []).map(m => ({ name: m.label, url: m.url }));
        if (ep.stream && !mirrorServers.length) mirrorServers.unshift({ name: 'Server 1', url: ep.stream });
        servers = mirrorServers;
        renderServers();

        if (servers.length) playServer(0);

        renderDownloads(ep.downloads || []);

        // Back to detail
        const animeSlug = EP_SLUG.replace(/-episode-.*/i,'').replace(/-subtitle-.*/i,'').replace(/-sub-indo.*/i,'');
        const btnBack = document.getElementById('btn-back');
        if (btnBack) btnBack.onclick = () => window.location.href = `/detail?slug=${animeSlug}`;

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

    document.querySelectorAll('.server-tab').forEach((el, i) => el.classList.toggle('active', i === idx));
    showLoading();

    iframe.src = s.url;
};

window.tryNextServer = function() {
    const next = currentIdx + 1;
    if (next < servers.length) playServer(next);
    else showToast('Tidak ada server lain');
};

window.hideLoading = function() {
    document.getElementById('player-loading').style.display = 'none';
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
    // Group by resolution
    const grouped = {};
    downloads.forEach(d => {
        const res = d.resolution || 'Unknown';
        if (!grouped[res]) grouped[res] = [];
        grouped[res].push(d);
    });
    wrap.innerHTML = Object.entries(grouped).map(([res, links]) => `
        <div style="width:100%">
            <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">${res}</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${links.map(l => `
                    <a href="${l.url}" target="_blank" class="btn-dl">
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7,10 12,15 17,10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        ${l.name || 'Download'}
                    </a>
                `).join('')}
            </div>
        </div>
    `).join('');
}

init();
