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
            // Extract slug dari URL — ambil path terakhir
            const slug = link.replace(/\/$/, '').split('/').pop() || '';
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
        let $;
        let animeUrl;

        // Coba /series/:slug/ dulu (format baru oploverz)
        const tryUrls = [
            `${OPLOVERZ_BASE}/series/${slug}/`,
            `${OPLOVERZ_BASE}/anime/${slug}/`,
        ];

        let loaded = false;
        for (const url of tryUrls) {
            try {
                const tmp = await scrapePage(url);
                const t   = tmp('h1.entry-title, h1').first().text().trim();
                if (t) { $ = tmp; animeUrl = url; loaded = true; break; }
            } catch(e) {}
        }

        // Kalau masih gagal, coba fetch sebagai halaman episode → cari link /series/
        if (!loaded) {
            try {
                const $ep      = await scrapePage(`${OPLOVERZ_BASE}/${slug}/`);
                // "Series <a href="https://oploverz.ch/series/xxx/">"
                const seriesLink = $ep('a[href*="/series/"]').first().attr('href');
                if (seriesLink) {
                    $ = await scrapePage(seriesLink);
                    animeUrl = seriesLink;
                    loaded = true;
                }
            } catch(e) {}
        }

        if (!loaded) return res.status(404).json({ status: false, message: 'Anime tidak ditemukan' });


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

// Episode watch + streams — scrape oploverz.ch
// Ganti fungsi scrapeEpisode yang lama dengan ini

async function scrapeEpisode(slug) {
    const url = `${OPLOVERZ_BASE}/${slug}/`;
    const $   = await scrapePage(url);

    const scriptText = $('script').map((_, el) => $(el).html()).get().join('\n');
    let seriesName = null, seriesThumb = null, episodeNum = null;
    const itemMatch = scriptText.match(/"item":\{"mid":\d+,"cid":\d+,"c":"([^"]+)","s":"([^"]+)","t":"([^"]+)"/);
    if (itemMatch) { episodeNum = itemMatch[1]; seriesName = itemMatch[2]; seriesThumb = itemMatch[3]; }

    const title     = $('h1.entry-title, h1').first().text().trim();
    const date      = $('time[itemprop="datePublished"]').attr('datetime') || null;
    const seriesUrl = $('a[href*="/series/"]').first().attr('href') || null;
    const cover     = $('.thumb img.wp-post-image').first().attr('src') || seriesThumb;
    const stream    = $('.megavid iframe, .embed-responsive iframe').first().attr('src') || null;

    const mirrors = [];
    $('select.mirror option').each((_, el) => {
        const val = $(el).attr('value');
        if (!val) return;
        try {
            const src = Buffer.from(val, 'base64').toString('utf8').match(/src="([^"]+)"/);
            if (src) mirrors.push({ label: $(el).text().trim() || 'Mirror ' + (mirrors.length + 1), url: src[1] });
        } catch(e) {}
    });

    const downloads = [], seen = new Set();
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (/gofile\.io|drive\.google|mega\.nz|streamtape|doodstream/i.test(href) && !seen.has(href)) {
            seen.add(href);
            downloads.push({ label: $(el).text().trim() || href, url: href });
        }
    });

    const prev    = $('.naveps a[rel="prev"]').attr('href') || null;
    const next    = $('.naveps a[rel="next"]').attr('href') || null;
    const all_eps = $('.naveps a[aria-label="All Episodes"]').attr('href') || null;

    // Recommended Series
    const recommended = [];
    $('h3').each((_, h3) => {
        if ($(h3).text().includes('Recommended')) {
            $(h3).closest('.bixbox').find('a[itemprop="url"]').each((_, el) => {
                const href  = $(el).attr('href');
                const label = $(el).attr('title') || $(el).text().trim();
                const img   = $(el).find('img').attr('src') || null;
                if (href && href.includes('/series/')) recommended.push({ title: label, url: href, image: img });
            });
        }
    });

    return {
        title, date,
        series: { name: seriesName, url: seriesUrl, cover },
        episode: episodeNum,
        stream, mirrors, downloads,
        nav: { prev, next, all_eps },
        recommended
    };
}


router.get('/episode/:slug', async (req, res) => {
    try {
        const result = await scrapeEpisode(req.params.slug);
        res.json({ status: true, result });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// Watch (alias)
router.get('/watch/:slug', async (req, res) => {
    try {
        const result = await scrapeEpisode(req.params.slug);
        res.json({ status: true, result });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});


// Proxy Blogger video — bypass CORS
router.get('/proxy/blogger', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ status: false, message: 'Token required' });

        const url = `https://www.blogger.com/video.g?token=${encodeURIComponent(token)}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://oploverz.ch/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 10,
        });

        // Forward headers
        res.setHeader('Content-Type', response.headers['content-type'] || 'text/html');
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        response.data.pipe(res);
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
});

module.exports = router;
