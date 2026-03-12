// ── WATCH PAGE ──

const params  = new URLSearchParams(window.location.search);
const SLUG    = params.get('slug') || '';
let   streams = [];
let   activeStream = 0;

// ════════════════════════════
//  FETCH
// ════════════════════════════
async function fetchEpisode(slug) {
    const res = await fetch(`/api/anime/episode/${slug}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.streams) throw new Error('Data stream tidak ditemukan');
    return data;
}

// Ekstrak anime slug dari episode slug
function toAnimeSlug(slug) {
    return slug.replace(/-episode-.*/i, '')
               .replace(/-subtitle-.*/i, '')
               .replace(/-sub-indo.*/i, '')
               .replace(/-end$/i, '')
               .replace(/-tamat$/i, '')
               .trim();
}

// ════════════════════════════
//  RENDER PLAYER
// ════════════════════════════
function renderPlayer(data) {
    streams = data.streams || [];

    document.title = `${data.episode_title || 'Watch'} — AniStream`;

    // Title
    setText('watch-title', data.episode_title || '–');

    // Back link ke detail
    const animeSlug = toAnimeSlug(SLUG);
    const backBtn   = document.getElementById('back-btn');
    if (backBtn) backBtn.href = `/detail?slug=${animeSlug}`;

    // Render stream tabs
    renderStreamTabs();

    // Load stream pertama
    if (streams.length > 0) loadStream(0);

    // Render downloads
    renderDownloads(data.downloads || []);
}

// ════════════════════════════
//  STREAM TABS
// ════════════════════════════
function renderStreamTabs() {
    const tabs = document.getElementById('stream-tabs');
    if (!tabs) return;
    tabs.innerHTML = streams.map((s, i) => `
        <button class="stream-tab ${i === 0 ? 'active' : ''}"
                onclick="loadStream(${i})">${s.name || `Server ${i + 1}`}</button>
    `).join('');
}

function loadStream(index) {
    activeStream = index;
    const stream = streams[index];
    if (!stream) return;

    // Update tab active
    document.querySelectorAll('.stream-tab').forEach((t, i) => {
        t.classList.toggle('active', i === index);
    });

    // Update iframe
    const iframe  = document.getElementById('video-iframe');
    const noVideo = document.getElementById('no-video');

    if (!stream.url) {
        if (iframe)  iframe.style.display  = 'none';
        if (noVideo) noVideo.style.display = 'flex';
        return;
    }

    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = stream.url;
    }
    if (noVideo) noVideo.style.display = 'none';
}

// ════════════════════════════
//  DOWNLOADS
// ════════════════════════════
function renderDownloads(downloads) {
    const container = document.getElementById('download-list');
    if (!container || !downloads.length) {
        const section = document.getElementById('download-section');
        if (section) section.style.display = 'none';
        return;
    }

    // Group by resolution
    const grouped = {};
    downloads.forEach(d => {
        if (!grouped[d.resolution]) grouped[d.resolution] = [];
        grouped[d.resolution].push(d);
    });

    const resOrder = ['360p', '480p', '720p', '1080p', '10bit'];
    const sorted   = resOrder.filter(r => grouped[r]).concat(
        Object.keys(grouped).filter(r => !resOrder.includes(r))
    );

    container.innerHTML = sorted.map(res => `
        <div class="dl-group">
            <div class="dl-res">${res}</div>
            <div class="dl-links">
                ${grouped[res].map(d => `
                    <a href="${d.url}" target="_blank" rel="noopener" class="dl-btn">
                        ${d.name}
                    </a>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ════════════════════════════
//  HELPERS
// ════════════════════════════
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ════════════════════════════
//  INIT
// ════════════════════════════
async function init() {
    if (!SLUG) { window.location.href = '/'; return; }

    const loading = document.getElementById('watch-loading');
    const content = document.getElementById('watch-content');

    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';

    try {
        const data = await fetchEpisode(SLUG);
        if (loading) loading.style.display = 'none';
        if (content) content.style.display = 'block';
        renderPlayer(data);
    } catch (err) {
        if (loading) loading.style.display = 'none';
        if (content) {
            content.style.display = 'block';
            content.innerHTML = `
                <div class="empty-state" style="padding:80px 24px">
                    <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3>Gagal Memuat</h3>
                    <p>${err.message}</p>
                    <button onclick="history.back()"
                        style="margin-top:16px;padding:8px 20px;background:var(--accent);color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
                        ← Kembali
                    </button>
                </div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', init);

