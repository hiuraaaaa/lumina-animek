// ── HOME PAGE ──
let currentPage   = 1;
let currentFilter = 'all';
let isLoading     = false;
let hasNext       = false;
let allAnime      = [];
let heroAnime     = [];
let heroIndex     = 0;
let heroTimer     = null;

// ════════════════════════════
//  FETCH
// ════════════════════════════
async function fetchHome(page = 1) {
    const res = await fetch(`/api/anime/home?page=${page}`);
    if (!res.ok) throw new Error('Gagal memuat data');
    return res.json();
}

// ════════════════════════════
//  HERO SLIDER
// ════════════════════════════
function renderHero(list) {
    heroAnime = list.slice(0, 8);
    heroIndex  = 0;

    const slider = document.getElementById('hero-slides');
    const dots   = document.getElementById('hero-dot-nav');
    if (!slider || !dots) return;

    slider.innerHTML = heroAnime.map(a => `
        <div class="hero-slide" onclick="goDetail('${a.slug}')">
            <img src="${a.poster}" alt="${a.title}" loading="lazy"
                 onerror="this.src='https://placehold.co/480x270/181818/333?text=No+Image'">
            <div class="hero-slide-overlay"></div>
            <div class="hero-slide-info">
                <div class="hero-badge">LATEST</div>
                <div class="hero-title">${a.title}</div>
            </div>
        </div>
    `).join('');

    dots.innerHTML = heroAnime.map((_, i) =>
        `<div class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHero(${i})"></div>`
    ).join('');

    updateHeroCounter();
    startHeroAuto();
}

function goHero(index) {
    heroIndex = index;
    const slides = document.getElementById('hero-slides');
    if (slides) slides.style.transform = `translateX(-${index * 100}%)`;

    document.querySelectorAll('.hero-dot').forEach((d, i) => {
        d.classList.toggle('active', i === index);
    });
    updateHeroCounter();
    resetHeroAuto();
}

function updateHeroCounter() {
    const counter = document.getElementById('hero-counter');
    if (counter) counter.textContent = `${heroIndex + 1}/${heroAnime.length}`;
}

function startHeroAuto() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => {
        goHero((heroIndex + 1) % heroAnime.length);
    }, 4000);
}

function resetHeroAuto() {
    clearInterval(heroTimer);
    startHeroAuto();
}

// ════════════════════════════
//  RENDER CARDS
// ════════════════════════════
function badgeClass(type) {
    const map = { 'TV': 'badge-tv', 'Movie': 'badge-movie', 'Special': 'badge-special', 'Live Action': 'badge-live-action', 'OVA': 'badge-ova' };
    return map[type] || 'badge-tv';
}

function renderCard(a, i) {
    const completed = a.status === 'Completed' || a.episode === 'Completed';
    return `
        <div class="anime-card" style="animation-delay:${(i % 12) * 40}ms" onclick="goDetail('${a.slug}')">
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
        </div>
    `;
}

function renderSkeleton(n = 12) {
    return Array.from({ length: n }, () => `
        <div class="skeleton-card">
            <div class="skeleton-poster"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        </div>
    `).join('');
}

// ════════════════════════════
//  FILTER
// ════════════════════════════
function applyFilter(list) {
    if (currentFilter === 'all') return list;
    return list.filter(a => a.type?.toLowerCase() === currentFilter.toLowerCase());
}

function setFilter(type) {
    currentFilter = type;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === type));
    renderGrid();
}

function renderGrid() {
    const grid    = document.getElementById('anime-grid');
    const filtered = applyFilter(allAnime);

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <h3>Tidak ada anime</h3>
                <p>Coba filter lain</p>
            </div>`;
        return;
    }

    grid.innerHTML = filtered.map((a, i) => renderCard(a, i)).join('');
}

// ════════════════════════════
//  LOAD PAGE
// ════════════════════════════
async function loadPage(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;

    const grid    = document.getElementById('anime-grid');
    const loadBtn = document.getElementById('load-more');

    if (!append) grid.innerHTML = renderSkeleton();
    if (loadBtn)  loadBtn.textContent = 'Memuat...';

    try {
        const data = await fetchHome(page);
        currentPage = page;
        hasNext     = data.pagination?.hasNext || false;

        const list = data.anime_list || [];

        if (!append) {
            allAnime = list;
            renderHero(list);
        } else {
            allAnime = [...allAnime, ...list];
        }

        renderGrid();

        // Show/hide load more
        if (loadBtn) loadBtn.style.display = hasNext ? 'block' : 'none';

    } catch (err) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h3>Gagal Memuat</h3>
                <p>${err.message}</p>
            </div>`;
        showToast('Gagal memuat. Cek koneksi kamu.');
    } finally {
        isLoading = false;
        if (loadBtn && hasNext) loadBtn.textContent = 'Muat Lebih Banyak';
    }
}

// ════════════════════════════
//  NAVIGATE
// ════════════════════════════
function goDetail(slug) {
    window.location.href = `/detail?slug=${slug}`;
}

// ════════════════════════════
//  TOAST
// ════════════════════════════
function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

// ════════════════════════════
//  SEARCH
// ════════════════════════════
function initSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let t;
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const q = input.value.trim();
            if (q) window.location.href = `/search?q=${encodeURIComponent(q)}`;
        }
    });
    input.addEventListener('input', () => {
        clearTimeout(t);
        const q = input.value.trim();
        if (q.length > 2) t = setTimeout(() => { window.location.href = `/search?q=${encodeURIComponent(q)}`; }, 700);
    });
}

// ════════════════════════════
//  ANNOUNCEMENT
// ════════════════════════════
function initAnnouncement() {
    const btn = document.getElementById('close-announce');
    const el  = document.getElementById('announcement');
    if (btn && el) {
        btn.addEventListener('click', () => {
            el.style.display = 'none';
            sessionStorage.setItem('announce_closed', '1');
        });
        if (sessionStorage.getItem('announce_closed')) el.style.display = 'none';
    }
}

// ════════════════════════════
//  INIT
// ════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadPage(1);
    initSearch();
    initAnnouncement();

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => setFilter(chip.dataset.filter));
    });

    document.getElementById('load-more')?.addEventListener('click', () => {
        if (hasNext) loadPage(currentPage + 1, true);
    });
});
