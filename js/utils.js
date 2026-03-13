// ── SHARED UTILS ──

function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── TYPE ──
const TYPE_KEYWORDS = ['Movie', 'Special', 'Live Action', 'OVA', 'TV'];
function resolveType(a) {
    if (a.type) return a.type;
    const meta = a.meta || '';
    for (const kw of TYPE_KEYWORDS) { if (meta.includes(kw)) return kw; }
    return '';
}

// ── BADGE ──
const BADGE_MAP = { 'TV':'badge-tv', 'Movie':'badge-movie', 'Special':'badge-special', 'Live Action':'badge-live-action', 'OVA':'badge-ova' };
function badgeClass(type) { return BADGE_MAP[type] || 'badge-tv'; }

// ── DAY ──
const DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu','Random'];
function resolveDay(a) {
    if (a.day) return a.day;
    const meta = a.meta || '';
    for (const d of DAYS) { if (meta.includes(d)) return d; }
    return '';
}

// ── DETAIL HREF ──
// Otakudesu pakai URL format: https://otakudesu.blog/anime/:slug/
function buildDetailHref(a) {
    const url = a.url || '';
    if (url.includes('/anime/')) {
        const slug = url.replace(/\/$/, '').split('/').pop();
        return '/detail?slug=' + slug;
    }
    if (url.includes('/episode/')) {
        // Dari halaman episode, redirect ke detail via url param
        return '/detail?url=' + encodeURIComponent(url.replace(/episode\/[^/]+\/?$/, '').replace(/episode\//, ''));
    }
    if (a.slug) return '/detail?slug=' + a.slug;
    return '/';
}

// ── CARD ──
function renderCard(a, i) {
    const type      = resolveType(a);
    const day       = resolveDay(a);
    const poster    = a.poster || a.cover || '';
    const episode   = a.episode || '';
    const date      = a.date   || '';
    const completed = (a.meta || '').toLowerCase().includes('complete');
    const href      = buildDetailHref(a);
    const metaLine  = [day, date].filter(Boolean).join(' • ');

    return `<div class="anime-card" onclick="window.location.href='${href}'">
        <div class="anime-card-poster">
            <img src="${escHtml(poster)}" alt="${escHtml(a.title)}" loading="lazy"
                 onerror="this.src='https://placehold.co/200x300/181818/333?text=No+Image'">
            <div class="anime-card-poster-overlay"></div>
            <div class="anime-card-info">
                <div class="anime-card-title">${escHtml(a.title)}</div>
                ${episode ? `<div class="anime-card-ep">${escHtml(episode)}</div>` : ''}
                ${metaLine ? `<div class="anime-card-meta">${escHtml(metaLine)}</div>` : ''}
            </div>
            ${type ? `<span class="anime-card-badge ${badgeClass(type)}">${type}</span>` : ''}
            <span class="status-dot ${completed ? 'completed' : 'ongoing'}"></span>
        </div>
    </div>`;
}

// ── SKELETON ──
const SKELETON_ITEM = `<div class="skeleton-card">
    <div class="skeleton-poster"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
</div>`;
function renderSkeleton(n = 12) { return SKELETON_ITEM.repeat(n); }

// ── FETCH JSON ──
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}

// ── NAVIGATE ──
function goDetail(anime) {
    if (typeof anime === 'string') { window.location.href = '/detail?slug=' + anime; return; }
    window.location.href = buildDetailHref(anime);
}
