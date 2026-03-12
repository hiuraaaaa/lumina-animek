// ── SHARED UTILS ──

// ── TOAST ──
function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

// ── SLUG ──
function extractSlug(item) {
    if (item.oploverz_url) {
        const m = item.oploverz_url.match(/\/anime\/([^\/]+)\/?$/);
        if (m) return m[1];
    }
    return item.slug;
}

function toAnimeSlug(slug) {
    return slug.replace(/-episode-.*/i, '')
               .replace(/-subtitle-.*/i, '')
               .replace(/-sub-indo.*/i, '')
               .replace(/-end$/i, '')
               .replace(/-tamat$/i, '')
               .trim();
}

// ── BADGE ──
const BADGE_MAP = {
    'TV': 'badge-tv', 'Movie': 'badge-movie', 'Special': 'badge-special',
    'Live Action': 'badge-live-action', 'OVA': 'badge-ova'
};
function badgeClass(type) { return BADGE_MAP[type] || 'badge-tv'; }

// ── CARD ──
function renderCard(a, i) {
    const slug      = a.slug || extractSlug(a);
    const completed = a.status === 'Completed' || a.episode === 'Completed';
    return `<div class="anime-card" onclick="window.location.href='/detail?slug=${slug}'">
        <div class="anime-card-poster">
            <img src="${a.poster}" alt="${a.title}" loading="lazy"
                 onerror="this.src='https://placehold.co/200x300/181818/333?text=No+Image'">
            <div class="anime-card-poster-overlay"></div>
            <div class="anime-card-info">
                <div class="anime-card-title">${a.title}</div>
                <div class="anime-card-ep">${a.episode || '–'}</div>
            </div>
            <span class="anime-card-badge ${badgeClass(a.type)}">${a.type}</span>
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── NAVIGATE ──
function toAnimeSlug(slug) {
    return slug
        .replace(/-episode-[^/]*/i, '')
        .replace(/-subtitle-.*/i, '')
        .replace(/-sub-indo.*/i, '')
        .replace(/-end$/i, '')
        .replace(/-tamat$/i, '')
        .replace(/-\d+$/, '')
        .replace(/-+$/, '')
        .trim();
}

function goDetail(anime) {
    if (typeof anime === 'string') {
        window.location.href = '/detail?slug=' + toAnimeSlug(anime);
        return;
    }
    const slug = anime.slug || extractSlug(anime);
    window.location.href = '/detail?slug=' + toAnimeSlug(slug);
}
