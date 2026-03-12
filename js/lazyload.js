// ── LAZY LOAD UTILITY ──
// Intersection Observer untuk anime cards & images

const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            const el    = entry.target;
            const delay = parseInt(el.dataset.delay || 0);
            setTimeout(() => el.classList.add('visible'), delay);
            cardObserver.unobserve(el);
        }
    });
}, {
    rootMargin: '0px 0px 60px 0px', // trigger 60px sebelum masuk viewport
    threshold: 0.05
});

// Observe semua .anime-card yang ada di DOM sekarang
function observeCards() {
    document.querySelectorAll('.anime-card:not(.visible)').forEach((card, i) => {
        card.dataset.delay = (i % 6) * 50; // stagger max 6 per baris, 50ms gap
        cardObserver.observe(card);
    });
}

// Observe cards baru yang di-append (load more)
function observeNewCards(container) {
    const cards = (container || document).querySelectorAll('.anime-card:not(.visible)');
    cards.forEach((card, i) => {
        card.dataset.delay = (i % 6) * 50;
        cardObserver.observe(card);
    });
}

// Auto-observe setiap kali grid berubah (MutationObserver)
function watchGrid(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const mo = new MutationObserver(() => observeNewCards(grid));
    mo.observe(grid, { childList: true });

    // Observe yang udah ada saat pertama kali
    observeNewCards(grid);
}

// Export global
window.lazyLoad = { observeCards, observeNewCards, watchGrid };

