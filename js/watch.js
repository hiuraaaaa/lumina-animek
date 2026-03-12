// ── WATCH PAGE — animeinweb API ──

const API_STREAM = 'https://animeinweb.com/api/proxy/3/2';
const AINheaders = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36 OPR/95.0.0.0',
    'Referer': 'https://animeinweb.com'
};

const params   = new URLSearchParams(window.location.search);
const EP_ID    = params.get('id') || '';
const MOVIE_ID = params.get('mid') || '';

let servers    = [];
let currentIdx = 0;
let epData     = null;
let epNext     = null;

async function fetchStream(id) {
    const res  = await fetch(`${API_STREAM}/episode/streamnew/${id}`, { headers: AINheaders });
    const json = await res.json();
    if (!json.data) throw new Error('Data tidak ditemukan');
    return json.data;
}

async function init() {
    if (!EP_ID) { window.location.href = '/'; return; }
    try {
        const data = await fetchStream(EP_ID);
        epData  = data.episode;
        epNext  = data.episode_next;
        servers = data.server || [];

        const movieTitle = params.get('title') ? decodeURIComponent(params.get('title')) : 'Anime';
        document.title = `${epData.title} — AniStream`;
        document.getElementById('ep-title').textContent = movieTitle;
        document.getElementById('ep-sub').textContent   = epData.title + (epData.key_time ? ` • ${epData.key_time}` : '');

        renderServers();

        if (epNext) document.getElementById('btn-next').disabled = false;
        if (params.get('prev')) document.getElementById('btn-prev').disabled = false;

        const directIdx = servers.findIndex(s => s.type === 'direct');
        playServer(directIdx >= 0 ? directIdx : 0);

        renderDownloads();
    } catch (e) {
        document.getElementById('player-loading').style.display = 'none';
        document.getElementById('player-error').style.display   = 'flex';
        document.getElementById('ep-title').textContent = 'Gagal memuat';
        showToast('Error: ' + e.message);
    }
}

function renderServers() {
    const wrap = document.getElementById('server-tabs');
    if (!servers.length) {
        wrap.innerHTML = '<span style="font-size:12px;color:var(--text3)">Tidak ada server</span>';
        return;
    }
    wrap.innerHTML = servers.map((s, i) => `
        <div class="server-tab ${s.type === 'direct' ? 'direct' : ''}" id="stab-${i}" onclick="playServer(${i})">
            <span class="tab-name">${s.name || 'Server ' + (i+1)}</span>
            <span class="tab-quality">${s.quality || ''}</span>
        </div>
    `).join('');
}

window.playServer = function(idx) {
    if (idx < 0 || idx >= servers.length) return;
    currentIdx = idx;
    const s      = servers[idx];
    const video  = document.getElementById('video-player');
    const iframe = document.getElementById('iframe-player');

    document.querySelectorAll('.server-tab').forEach((el, i) => el.classList.toggle('active', i === idx));
    showLoading(); hideError();

    if (s.type === 'direct') {
        iframe.style.display = 'none';
        video.style.display  = 'block';
        video.src = s.link;
        video.load();
        video.play().catch(() => {});
    } else {
        video.style.display  = 'none';
        video.src = '';
        iframe.style.display = 'block';
        iframe.src = s.link;
    }
};

window.tryNextServer = function() {
    const next = currentIdx + 1;
    if (next < servers.length) playServer(next);
    else showToast('Tidak ada server lain');
};

window.onVideoError = function() { hideLoading(); showError(); };
window.hideLoading  = function() { document.getElementById('player-loading').style.display = 'none'; };

function showLoading() {
    document.getElementById('player-loading').style.display = 'flex';
    document.getElementById('player-error').style.display   = 'none';
}
function showError() {
    document.getElementById('player-error').style.display   = 'flex';
    document.getElementById('player-loading').style.display = 'none';
}
function hideError() { document.getElementById('player-error').style.display = 'none'; }

window.goNext = function() {
    if (!epNext) return;
    const title = encodeURIComponent(params.get('title') || '');
    window.location.href = `/watch?id=${epNext.id}&mid=${epNext.id_movie || MOVIE_ID}&title=${title}&prev=${EP_ID}`;
};

window.goPrev = function() {
    const prevId = params.get('prev');
    if (!prevId) return;
    history.back();
};

function renderDownloads() {
    const wrap    = document.getElementById('dl-group');
    const directs = servers.filter(s => s.type === 'direct');
    if (!directs.length) {
        wrap.innerHTML = '<span style="font-size:12px;color:var(--text3)">Tidak ada link download</span>';
        return;
    }
    wrap.innerHTML = directs.map(s => `
        <a href="${s.link}" target="_blank" class="btn-dl">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ${s.name || 'Download'}
            <span class="dl-quality">${s.quality}</span>
            ${s.key_file_size ? `<span class="dl-quality">${parseFloat(s.key_file_size).toFixed(0)}MB</span>` : ''}
        </a>
    `).join('');
}

init();
