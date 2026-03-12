const express = require('express');
const https   = require('https');
const http    = require('http');
const router  = express.Router();

const API_BASE = process.env.API_BASE || 'https://www.sankavollerei.com/anime/oploverz';

function apiFetch(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) return reject(new Error(`Upstream ${res.statusCode}`));
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error('Invalid JSON')); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

// Ekstrak slug dari oploverz_url
// "https://oploverz.men/anime/one-piece/" → "one-piece"
// "https://oploverz.men/one-piece-episode-1155-.../" → "one-piece-episode-1155-..."
function extractSlug(item) {
    if (item.oploverz_url) {
        const match = item.oploverz_url.match(/\/anime\/([^\/]+)\/?$/) ||
                      item.oploverz_url.match(/\/([^\/]+)\/?$/);
        if (match) return match[1];
    }
    return item.slug;
}

// Normalize anime list — fix slug dari oploverz_url
function normalizeList(list = []) {
    return list.map(item => ({
        ...item,
        slug: extractSlug(item),
        // isAnime = slug dari /anime/ path (bukan episode)
        isAnime: /\/anime\/[^\/]+\/?$/.test(item.oploverz_url || '')
    }));
}

router.get('/home', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const data = await apiFetch(`${API_BASE}/home?page=${page}`);
        data.anime_list = normalizeList(data.anime_list);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/schedule', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/schedule`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/search', async (req, res) => {
    try {
        const { q = '', page = 1 } = req.query;
        if (!q.trim()) return res.status(400).json({ status: false, message: 'Query kosong' });
        const data = await apiFetch(`${API_BASE}/search/${encodeURIComponent(q)}?page=${page}`);
        data.anime_list = normalizeList(data.anime_list);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/anime/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/anime/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/detail/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/detail/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/watch/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/watch/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

module.exports = router;
