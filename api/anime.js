const express = require('express');
const https   = require('https');
const http    = require('http');
const axios   = require('axios');
const cheerio = require('cheerio');
const router  = express.Router();

const OPLOVERZ_BASE  = 'https://oploverz.ch';
const SCRAPE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
    'Referer': OPLOVERZ_BASE + '/'
};

async function scrapePage(url) {
    const res = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 20000, maxRedirects: 5 });
    if (res.status !== 200) throw new Error('HTTP ' + res.status);
    return cheerio.load(res.data);
}

function parseCards($) {
    const results = [];
    $('article.bs').each((_, el) => {
        const a     = $(el).find('a[itemprop="url"]').first();
        const link  = a.attr('href') || null;
        const title = a.attr('title') || $(el).find('img[itemprop="image"]').attr('title') || '';
        const image = $(el).find('img[itemprop="image"]').attr('src') || null;
        const eps   = $(el).find('.epx').text().trim();
        const type  = $(el).find('.typez').text().trim();
        if (title && link) {
            const m    = link.match(/oploverz\.ch\/(?:anime|series)\/([^\/]+)\/?$/);
            const slug = m ? m[1] : '';
            results.push({ title, poster: image, episode: eps, type, slug, oploverz_url: link });
        }
    });
    return results;
}

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

function extractSlug(item) {
    if (item.oploverz_url) {
        const m = item.oploverz_url.match(/\/anime\/([^\/]+)\/?$/);
        if (m) return m[1];
    }
    return item.slug;
}

function normalizeList(list = []) {
    return list.map(item => ({ ...item, slug: extractSlug(item) }));
}

// Home — scrape oploverz.ch
router.get('/home', async (req, res) => {
    try {
        const $ = await scrapePage(`${OPLOVERZ_BASE}/`);
        const result = parseCards($);
        res.json({ status: true, anime_list: result });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Schedule
router.get('/schedule', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/schedule`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Search — scrape oploverz.ch
router.get('/search', async (req, res) => {
    try {
        const { q = '' } = req.query;
        if (!q.trim()) return res.status(400).json({ status: false, message: 'Query kosong' });
        const $ = await scrapePage(`${OPLOVERZ_BASE}/?s=${encodeURIComponent(q)}`);
        const result = parseCards($);
        res.json({ status: true, anime_list: result });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Ongoing — scrape oploverz.ch
router.get('/ongoing', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const $ = await scrapePage(`${OPLOVERZ_BASE}/series/?status=Ongoing&type=&order=update&page=${page}`);
        const result = parseCards($);
        res.json({ status: true, anime_list: result });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Completed — scrape oploverz.ch
router.get('/completed', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const $ = await scrapePage(`${OPLOVERZ_BASE}/series/?status=Completed&type=&order=update&page=${page}`);
        const result = parseCards($);
        res.json({ status: true, anime_list: result });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// List (genre/filter)
router.get('/list', async (req, res) => {
    try {
        const { genre = '', status = '', type = '', order = '', page = 1 } = req.query;
        const params = new URLSearchParams();
        if (genre)  params.set('genre', genre);
        if (status) params.set('status', status);
        if (type)   params.set('type', type);
        if (order)  params.set('order', order);
        params.set('page', page);
        const data = await apiFetch(`${API_BASE}/list?${params.toString()}`);
        data.anime_list = normalizeList(data.anime_list);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Anime detail — scrape dari oploverz.ch
router.get('/anime/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const url  = `${OPLOVERZ_BASE}/anime/${slug}/`;
        const $    = await scrapePage(url);

        const title    = $('h1.entry-title, h1').first().text().trim();
        const cover    = $('.bigcontent img[itemprop="image"]').first().attr('src') || null;
        const synopsis = $('.entry-content[itemprop="description"]').first().text().trim()
                      || $('.desc .entry-content').first().text().trim();

        const info = {};
        $('.infox .spe span').each((_, el) => {
            const raw = $(el).text().trim();
            const m   = raw.match(/^(.+?):\s*(.+)$/s);
            if (m && m[1].trim().length < 30) info[m[1].trim()] = m[2].trim();
        });

        const genres = [];
        $('.infox .genxed a').each((_, a) => {
            const g = $(a).text().trim();
            if (g) genres.push(g);
        });

        const episodes = [];
        $('.eplister ul li').each((_, li) => {
            const a    = $(li).find('a').first();
            const link = a.attr('href') || null;
            const num  = $(li).find('.epl-num').text().trim();
            const name = $(li).find('.epl-title').text().trim();
            const date = $(li).find('.epl-date').text().trim();
            if (link) {
                // Extract episode slug from oploverz URL
                const m = link.match(/oploverz\.ch\/([^\/]+)\/?$/);
                const epSlug = m ? m[1] : link;
                episodes.push({ num, name, date, link, slug: epSlug });
            }
        });

        res.json({
            status: true,
            detail: {
                title,
                poster: cover,
                synopsis,
                info,
                genres,
                total_episodes: episodes.length,
                episodes
            }
        });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Episode detail (old)
router.get('/detail/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/detail/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Episode watch + streams
router.get('/episode/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/episode/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Watch (alias)
router.get('/watch/:slug', async (req, res) => {
    try {
        const data = await apiFetch(`${API_BASE}/episode/${req.params.slug}`);
        res.json({ status: true, ...data });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

module.exports = router;
