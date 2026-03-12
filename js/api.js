// ============================================
// API HANDLER - Ganti BASE_URL sesuai API kamu
// ============================================

const API_BASE = 'https://www.sankavollerei.com/anime/oploverz';

const API = {
  // GET: Home / Anime List
  // Response: { status, anime_list, pagination }
  getHome: async (page = 1) => {
    const res = await fetch(`${API_BASE}/home?page=${page}`);
    if (!res.ok) throw new Error('Gagal fetch data');
    return res.json();
  },

  // GET: Search Anime
  // Response: { status, anime_list, pagination }
  search: async (query, page = 1) => {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&page=${page}`);
    if (!res.ok) throw new Error('Gagal fetch data');
    return res.json();
  },

  // GET: Detail Anime
  // Response: { status, detail }
  getDetail: async (slug) => {
    const res = await fetch(`${API_BASE}/detail/${slug}`);
    if (!res.ok) throw new Error('Gagal fetch data');
    return res.json();
  },

  // GET: Watch Episode
  // Response: { status, video_url, ... }
  watch: async (slug) => {
    const res = await fetch(`${API_BASE}/watch/${slug}`);
    if (!res.ok) throw new Error('Gagal fetch data');
    return res.json();
  },
};

export default API;

