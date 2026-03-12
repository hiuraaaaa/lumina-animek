// ============================================
// HOME PAGE LOGIC
// ============================================

const API_BASE = 'https://www.sankavollerei.com/anime/oploverz';

let currentPage = 1;
let currentFilter = 'all';
let isLoading = false;

// ---- FETCH DATA ----
async function fetchAnime(page = 1) {
  const res = await fetch(`${API_BASE}/home?page=${page}`);
  if (!res.ok) throw new Error('Gagal fetch data');
  return res.json();
}

// ---- RENDER CARDS ----
function getBadgeClass(type) {
  const map = {
    'TV': 'badge-tv',
    'Movie': 'badge-movie',
    'Special': 'badge-special',
    'Live Action': 'badge-live-action',
    'OVA': 'badge-ova',
  };
  return map[type] || 'badge-tv';
}

function renderCard(anime, index) {
  const isCompleted = anime.status === 'Completed' || anime.episode === 'Completed';
  const isOngoing = !isCompleted && anime.status !== 'Completed';
  const delay = (index % 20) * 40;

  return `
    <div class="anime-card" style="animation-delay:${delay}ms" onclick="goToDetail('${anime.slug}')">
      <div class="anime-card-poster">
        <img src="${anime.poster}" alt="${anime.title}" loading="lazy" 
             onerror="this.src='https://via.placeholder.com/200x300/16161f/555?text=No+Image'">
        <div class="anime-card-overlay">
          <div class="play-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          </div>
        </div>
        <span class="anime-card-badge ${getBadgeClass(anime.type)}">${anime.type}</span>
        ${isCompleted ? `<span class="anime-card-status status-completed">Tamat</span>` : ''}
        ${isOngoing && anime.episode && anime.episode !== 'Ongoing' ? `<span class="anime-card-status status-ongoing">Ongoing</span>` : ''}
      </div>
      <div class="anime-card-info">
        <div class="anime-card-title">${anime.title}</div>
        <div class="anime-card-episode">${anime.episode || '–'}</div>
      </div>
    </div>
  `;
}

function renderSkeleton(count = 20) {
  return Array.from({ length: count }, () => `
    <div class="skeleton">
      <div class="skeleton-poster"></div>
      <div class="skeleton-info">
        <div class="skeleton-text"></div>
        <div class="skeleton-text"></div>
      </div>
    </div>
  `).join('');
}

// ---- RENDER PAGINATION ----
function renderPagination(pagination) {
  const { currentPage, hasNext, hasPrev } = pagination;
  const container = document.getElementById('pagination');
  if (!container) return;

  let pages = [];
  const range = 2;
  for (let i = Math.max(1, currentPage - range); i <= currentPage + range; i++) {
    pages.push(i);
  }

  container.innerHTML = `
    <button class="page-btn" onclick="changePage(${currentPage - 1})" ${!hasPrev ? 'disabled' : ''}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15,18 9,12 15,6"/>
      </svg>
    </button>
    ${pages.map(p => `
      <button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="changePage(${p})">${p}</button>
    `).join('')}
    <button class="page-btn" onclick="changePage(${currentPage + 1})" ${!hasNext ? 'disabled' : ''}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9,18 15,12 9,6"/>
      </svg>
    </button>
  `;
}

// ---- FILTER ----
function filterAnime(list) {
  if (currentFilter === 'all') return list;
  return list.filter(a => a.type?.toLowerCase() === currentFilter.toLowerCase());
}

// ---- HERO ----
function renderHero(anime) {
  if (!anime) return;
  const el = document.getElementById('hero');
  if (!el) return;

  el.innerHTML = `
    <img class="hero-image" src="${anime.poster}" alt="${anime.title}">
    <div class="hero-bg"></div>
    <div class="hero-content">
      <div class="hero-badge">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
        ${anime.status === 'Completed' ? 'Tamat' : 'Sedang Tayang'}
      </div>
      <h1 class="hero-title">${anime.title}</h1>
      <div class="hero-meta">
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          ${anime.type}
        </span>
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
          ${anime.episode}
        </span>
        <span>Oploverz</span>
      </div>
      <div class="hero-buttons">
        <a href="watch.html?slug=${anime.slug}" class="btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          Tonton Sekarang
        </a>
        <a href="detail.html?slug=${anime.slug}" class="btn-secondary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Detail
        </a>
      </div>
    </div>
  `;
}

// ---- LOAD PAGE ----
async function loadPage(page = 1) {
  if (isLoading) return;
  isLoading = true;

  const grid = document.getElementById('anime-grid');
  const pagination = document.getElementById('pagination');

  if (grid) grid.innerHTML = renderSkeleton();
  if (pagination) pagination.innerHTML = '';

  try {
    const data = await fetchAnime(page);
    currentPage = page;

    const filtered = filterAnime(data.anime_list || []);

    // Hero: pakai anime pertama yang ada poster
    renderHero(data.anime_list?.[0]);

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3>Tidak ada anime</h3>
          <p>Coba filter lain atau muat ulang halaman</p>
        </div>
      `;
    } else {
      grid.innerHTML = filtered.map((a, i) => renderCard(a, i)).join('');
    }

    renderPagination(data.pagination);
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    if (grid) grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3>Gagal Memuat</h3>
        <p>${err.message}</p>
      </div>
    `;
    showToast('Gagal memuat data. Cek koneksi kamu.');
  } finally {
    isLoading = false;
  }
}

// ---- CHANGE PAGE ----
function changePage(page) {
  if (page < 1 || isLoading) return;
  loadPage(page);
}

// ---- FILTER TAB ----
function setFilter(type) {
  currentFilter = type;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === type);
  });
  loadPage(1);
}

// ---- NAVIGATE ----
function goToDetail(slug) {
  window.location.href = `detail.html?slug=${slug}`;
}

// ---- TOAST ----
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---- SEARCH ----
function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = input.value.trim();
    if (!q) { loadPage(1); return; }
    timeout = setTimeout(() => {
      window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }, 500);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
  });
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadPage(1);
  initSearch();

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });
});

