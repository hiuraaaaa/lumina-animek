// ── HOME PAGE ──
let isLoading = false;
let heroAnime = [];
let heroIndex = 0;
let heroTimer = null;

// ── HERO ──
function renderHero(list) {
    heroAnime = list.slice(0, 8);
    heroIndex = 0;
    const slider = document.getElementById('hero-slides');
    const dots   = document.getElementById('hero-dot-nav');
    if (!slider || !dots) return;

    slider.innerHTML = heroAnime.map((a, i) => {
        const poster = a.poster || a.cover || 'https://placehold.co/480x270/181818/333?text=No+Image';
        return `<div class="hero-slide" onclick="goDetail(${JSON.stringify(a).replace(/'/g, '&#39;')})">
            <img src="${poster}" alt="${a.title}"
                 loading="${i === 0 ? 'eager' : 'lazy'}"
                 decoding="async"
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
    initHeroSwipe(slider);
    initHeroPauseOnHidden();
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

// ── SWIPE SUPPORT ──
function initHeroSwipe(slider) {
    let startX = 0, isDragging = false;
    slider.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        isDragging = true;
    }, { passive: true });
    slider.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) < 40) return; // ignore small swipes
        if (diff > 0) goHero((heroIndex + 1) % heroAnime.length); // swipe left → next
        else          goHero((heroIndex - 1 + heroAnime.length) % heroAnime.length); // swipe right → prev
    }, { passive: true });
}

// ── PAUSE WHEN TAB HIDDEN ──
function initHeroPauseOnHidden() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) clearInterval(heroTimer);
        else startHeroAuto();
    });
}

// ── RENDER GRID ──
function renderGrid(gridId, items) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    if (!items.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg><h3>Tidak ada anime</h3></div>`;
        return;
    }
    const trimmed = items.slice(0, Math.floor(items.length / 3) * 3);
    grid.innerHTML = (trimmed.length ? trimmed : items).map((a, i) => renderCard(a, i)).join('');
}

// ── LOAD HOME ──
async function loadHome() {
    if (isLoading) return;
    isLoading = true;

    const ongoingGrid  = document.getElementById('ongoing-grid');
    const completeGrid = document.getElementById('complete-grid');

    if (ongoingGrid)  ongoingGrid.innerHTML  = renderSkeleton(6);
    if (completeGrid) completeGrid.innerHTML = renderSkeleton(6);

    try {
        const data     = await fetchJSON('/api/anime/home');
        const sections = data.sections || [];

        const ongoingSection  = sections.find(s => s.section?.toLowerCase().includes('on-going') || s.section?.toLowerCase().includes('ongoing'));
        const completeSection = sections.find(s => s.section?.toLowerCase().includes('complete'));

        const ongoingItems  = ongoingSection?.items  || [];
        const completeItems = completeSection?.items || [];

        const heroSource = ongoingItems.length ? ongoingItems : sections.flatMap(s => s.items || []);
        renderHero(heroSource);
        renderGrid('ongoing-grid',  ongoingItems);
        renderGrid('complete-grid', completeItems);

    } catch (err) {
        const errHtml = `<div class="empty-state" style="grid-column:1/-1">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg><h3>Gagal Memuat</h3><p>${err.message}</p></div>`;
        if (ongoingGrid)  ongoingGrid.innerHTML  = errHtml;
        if (completeGrid) completeGrid.innerHTML = errHtml;
        showToast('Gagal memuat. Cek koneksi kamu.');
    } finally {
        isLoading = false;
        window.hideSplash?.();
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
    loadHome();
    initSearch();
    initAnnouncement();
});
