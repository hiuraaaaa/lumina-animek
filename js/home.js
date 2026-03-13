// ── HOME PAGE ──
let currentPage   = 1;
let currentFilter = 'all';
let isLoading     = false;
let hasNext       = false;
let allAnime      = { all: [], ongoing: [], complete: [] };
let heroAnime     = [];
let heroIndex     = 0;
let heroTimer     = null;

// ── HERO ──
function renderHero(list) {
    heroAnime = list.slice(0, 8);
    heroIndex = 0;
    const slider = document.getElementById('hero-slides');
    const dots   = document.getElementById('hero-dot-nav');
    if (!slider || !dots) return;
    slider.innerHTML = heroAnime.map(a => {
        const poster = a.poster || a.cover || 'https://placehold.co/480x270/181818/333?text=No+Image';
        return `<div class="hero-slide" onclick="goDetail(${JSON.stringify(a).replace(/'/g, '&#39;')})">
            <img src="${poster}" alt="${a.title}" loading="lazy"
                 onerror="this.src='https://placehold.co/480x270/181818/333?text=No+Image'">
            <div class="hero-slide-overlay"></div>
            <div class="hero-slide-info">
                <div class="hero-badge">LATEST</div>
                <div class="hero-title">${a.title}</div>
            </div>
        </div>`;
    }).join('');
    dots.innerHTML = heroAnime.map((_, i) =>
        `<div class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHero(${i})"></div>`).join('');
    updateHeroCounter();
    startHeroAuto();
}

function goHero(index) {
    heroIndex = index;
    const slides = document.getElementById('hero-slides');
    if (slides) slides.style.transform = `translateX(-${index * 100}%)`;
    document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === index));
    updateHeroCounter();
    resetHeroAuto();
}

function updateHeroCounter() {
    const el = document.getElementById('hero-counter');
    if (el) el.textContent = `${heroIndex + 1}/${heroAnime.length}`;
}

function startHeroAuto() {
    clearInterval(heroTimer);
    if (heroAnime.length > 1)
        heroTimer = setInterval(() => goHero((heroIndex + 1) % heroAnime.length), 4000);
}
function resetHeroAuto() { clearInterval(heroTimer); startHeroAuto(); }

// ── FILTER ──
function getFilteredList() {
    if (currentFilter === 'ongoing')  return allAnime.ongoing;
    if (currentFilter === 'complete') return allAnime.complete;
    if (currentFilter !== 'all') {
        // Filter by type (TV, Movie, OVA, dll)
        return allAnime.all.filter(a => resolveType(a).toLowerCase() === currentFilter.toLowerCase());
    }
    return allAnime.all;
}

function setFilter(type) {
    currentFilter = type;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === type));
    renderGrid();
}

function renderGrid() {
    const grid     = document.getElementById('anime-grid');
    const filtered = getFilteredList();
    if (!filtered.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg><h3>Tidak ada anime</h3><p>Coba filter lain</p></div>`;
        return;
    }
    // Potong ke kelipatan 3 biar grid rapi
    const trimmed = filtered.slice(0, Math.floor(filtered.length / 3) * 3);
    grid.innerHTML = (trimmed.length ? trimmed : filtered).map((a, i) => renderCard(a, i)).join('');
}

// ── LOAD ──
async function loadPage(page = 1, append = false) {
    if (isLoading) return;
    isLoading = true;
    const grid    = document.getElementById('anime-grid');
    const loadBtn = document.getElementById('load-more');
    if (!append) grid.innerHTML = renderSkeleton();
    if (loadBtn)  loadBtn.textContent = 'Memuat...';
    try {
        const data = await fetchJSON(`/api/anime/home?page=${page}`);
        currentPage = page;
        hasNext     = data.pagination?.hasNext || false;

        // Pisahin ongoing & complete dari sections
        const sections        = data.sections || [];
        const ongoingSection  = sections.find(s => s.section?.toLowerCase().includes('on-going') || s.section?.toLowerCase().includes('ongoing'));
        const completeSection = sections.find(s => s.section?.toLowerCase().includes('complete'));
        const ongoingItems    = ongoingSection?.items  || [];
        const completeItems   = completeSection?.items || [];
        const allItems        = sections.flatMap(s => s.items || []);

        if (!append) {
            allAnime = { all: allItems, ongoing: ongoingItems, complete: completeItems };
            renderHero(allItems);
        } else {
            allAnime = {
                all:      [...allAnime.all,      ...allItems],
                ongoing:  [...allAnime.ongoing,  ...ongoingItems],
                complete: [...allAnime.complete, ...completeItems]
            };
        }

        renderGrid();
        if (loadBtn) loadBtn.style.display = hasNext ? 'block' : 'none';
    } catch (err) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg><h3>Gagal Memuat</h3><p>${err.message}</p></div>`;
        showToast('Gagal memuat. Cek koneksi kamu.');
    } finally {
        isLoading = false;
        if (loadBtn && hasNext) loadBtn.textContent = 'Muat Lebih Banyak';
    }
}

// ── SEARCH ──
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

// ── ANNOUNCEMENT ──
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

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    loadPage(1);
    initSearch();
    initAnnouncement();
    document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => setFilter(c.dataset.filter)));
    document.getElementById('load-more')?.addEventListener('click', () => { if (hasNext) loadPage(currentPage + 1, true); });
});
