const express  = require('express');
const axios    = require('axios');
const cheerio  = require('cheerio');
const router   = express.Router();

const BASE = 'https://otakudesu.blog';
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';
const AJAX_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': BASE + '/'
};

// ── HELPERS ──────────────────────────────────────────────
async function fetchPage(url) {
    if (!SCRAPER_API_KEY) throw new Error('SCRAPER_API_KEY tidak di-set');
    const apiUrl = 'http://api.scraperapi.com?api_key=' + SCRAPER_API_KEY + '&url=' + encodeURIComponent(url);
    const res = await axios.get(apiUrl, { timeout: 60000 });
    if (res.status !== 200) throw new Error('ScraperAPI HTTP ' + res.status);
    return cheerio.load(res.data);
}

async function ajaxPost(params) {
    // Nonce & embed ajax juga lewat ScraperAPI biar bypass CF
    const apiUrl = 'http://api.scraperapi.com?api_key=' + SCRAPER_API_KEY
        + '&url=' + encodeURIComponent(`${BASE}/wp-admin/admin-ajax.php`)
        + '&method=POST&keep_headers=true';
    const res = await axios.post(apiUrl,
        new URLSearchParams(params).toString(),
        { headers: AJAX_HEADERS, timeout: 30000 }
    );
    return res.data;
}

async function getNonce() {
    const raw = await ajaxPost({ action: 'aa1208d27f29ca340c92c66d1926f13f' });
    if (!raw) throw new Error('Nonce response kosong');
    if (typeof raw === 'object' && raw.data) return raw.data;
    if (typeof raw === 'string') {
        try { const j = JSON.parse(raw); if (j.data) return j.data; } catch(_) {}
        if (raw.length > 5 && raw.length < 50) return raw.trim();
    }
    throw new Error('Format nonce tidak dikenal: ' + JSON.stringify(raw).slice(0, 100));
}

async function getEmbedUrl(id, i, q, nonce) {
    const raw = await ajaxPost({ id: String(id), i: String(i), q, nonce, action: '2a3505c93b0035d3f455df82bf976b84' });
    const data = (typeof raw === 'object') ? raw.data : (() => { try { return JSON.parse(raw).data; } catch(_) { return null; } })();
    if (!data) return null;
    const html = Buffer.from(data, 'base64').toString('utf-8');
    const $    = cheerio.load(html);
    return $('iframe').attr('src') || null;
}

async function bypassFiledon(embedUrl) {
    const slug = embedUrl.split('/embed/')[1];
    if (!slug) return null;
    const res = await axios.get(`https://filedon.co/embed/${slug}`, {
        headers: { 'User-Agent': AJAX_HEADERS['User-Agent'], 'Referer': BASE + '/' },
        timeout: 15000
    });
    const raw   = res.data.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\\/g, '');
    const match = raw.match(/"url":"(https:\/\/[^"]+\.mp4[^"]*)"/);
    return match ? match[1] : null;
}

function getPagination($, page) {
    let max = 1;
    $('.page-numbers').each((_, el) => { const n = parseInt($(el).text().trim()); if (!isNaN(n) && n > max) max = n; });
    return { page, total_pages: max, next_page: page < max ? page + 1 : null, prev_page: page > 1 ? page - 1 : null };
}

function parseEpisodeItems($, selector) {
    const items = [];
    $(selector).each((_, li) => {
        const episode = $(li).find('.epz').text().replace(/\s+/g, ' ').trim();
        const meta    = $(li).find('.epztipe').text().replace(/\s+/g, ' ').trim();
        const date    = $(li).find('.newnime').text().trim();
        const a       = $(li).find('.thumb a').first();
        const url     = a.attr('href') || null;
        const title   = $(li).find('.jdlflm').text().trim();
        const cover   = $(li).find('img').first().attr('src') || null;
        const slug    = url ? url.replace(/\/$/, '').split('/').pop() : '';
        if (url && title) items.push({ title, url, cover, episode, meta, date, slug, poster: cover });
    });
    return items;
}

function parseDetail($) {
    const title    = $('.jdlrx h1').first().text().trim();
    const cover    = $('.fotoanime img').first().attr('src') || null;
    const synopsis = $('.sinopc').text().trim() || null;
    const info = {}, genres = [];

    $('.infozingle p').each((_, p) => {
        const key = $(p).find('b').first().text().replace(':', '').trim();
        if (!key) return;
        if (key === 'Genre') {
            $(p).find('a').each((_, a) => { const g = $(a).text().trim(); if (g) genres.push(g); });
        } else {
            const val = $(p).find('span').first().text().trim();
            if (val) info[key] = val;
        }
    });

    const episode_sections = [];
    $('.episodelist').each((_, section) => {
        const sTitle   = $(section).find('.monktit').text().trim();
        const episodes = [];
        $(section).find('ul li').each((_, li) => {
            const a     = $(li).find('a').first();
            const label = a.text().trim();
            const epUrl = a.attr('href') || '';
            const date  = $(li).find('.zeebr').text().trim();
            const slug  = epUrl ? epUrl.replace(/\/$/, '').split('/').pop() : '';
            if (epUrl) episodes.push({ label, url: epUrl, date, slug });
        });
        if (episodes.length) episode_sections.push({ section: sTitle, episodes });
    });

    const recommendations = [];
    $('#recommend-anime-series .isi-konten').each((_, item) => {
        const a   = $(item).find('.judul-anime a').first();
        const img = $(item).find('img').first().attr('src') || null;
        if (a.attr('href')) recommendations.push({ title: a.text().trim(), url: a.attr('href'), cover: img });
    });

    const episodes = episode_sections.flatMap(s => s.episodes).reverse();

    // Filter info: buang nilai kosong, Unknown, atau tanda tanya
    const SKIP_VALS = ['unknown', '?', '-', ''];
    for (const key of Object.keys(info)) {
        if (SKIP_VALS.includes((info[key] || '').toLowerCase().trim())) delete info[key];
    }

    // Rekomendasi — coba beberapa selector
    const recommendations = [];
    const recSelectors = [
        '#recommend-anime-series .isi-konten',
        '.rekomendasi .isi-konten',
        '.animerekomen .isi-konten',
        '#recommend-anime-series li'
    ];
    for (const sel of recSelectors) {
        const els = $(sel);
        if (els.length) {
            els.each((_, item) => {
                const el   = $(item);
                const a    = el.find('a').first();
                const img  = el.find('img').first().attr('src') || null;
                const href = a.attr('href') || '';
                const name = a.attr('title') || el.find('.judul-anime, .col-anime-title, h2').first().text().trim() || a.text().trim();
                const slug = href ? href.replace(/\/$/, '').split('/').pop() : '';
                if (href && name) recommendations.push({ title: name, url: href, cover: img, slug });
            });
            if (recommendations.length) break;
        }
    }

    return { title, cover, poster: cover, synopsis, info, genres, episode_sections, episodes, total_episodes: episodes.length, recommendations };
}

function parseStream($) {
    const title         = $('.posttl').first().text().trim();
    const cover         = $('.cukder img').first().attr('src') || null;
    const default_embed = $('#pembed iframe').attr('src') || null;
    let series_url = null, next_episode = null, prev_episode = null;

    $('.flir a').each((_, a) => {
        const href = $(a).attr('href') || '';
        const t    = ($(a).attr('title') || $(a).text()).toLowerCase();
        if (href.includes('/anime/')) series_url = href;
        if (t.includes('selanjutnya') || t.includes('next')) next_episode = href;
        if (t.includes('sebelumnya') || t.includes('prev')) prev_episode = href;
    });

    const mirrors = {};
    ['.m360p', '.m480p', '.m720p'].forEach(cls => {
        const quality = cls.replace('.m', '');
        mirrors[quality] = [];
        $(`ul${cls} li a`).each((_, a) => {
            const name    = $(a).text().trim();
            const encoded = $(a).attr('data-content');
            if (encoded) {
                try {
                    const data = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
                    mirrors[quality].push({ name, ...data });
                } catch(_) {}
            }
        });
    });

    const downloads = {};
    $('.download ul li').each((_, li) => {
        const quality = $(li).find('strong').text().trim();
        if (!quality) return;
        const size = $(li).find('i').text().trim();
        const servers = [];
        $(li).find('a').each((_, a) => {
            const name = $(a).text().trim();
            const link = $(a).attr('href');
            if (link && link.startsWith('http')) servers.push({ name, link });
        });
        if (servers.length) downloads[quality] = { size, servers };
    });

    const episode_list = [];
    $('#selectcog option').each((_, opt) => {
        const val  = $(opt).attr('value') || '';
        const text = $(opt).text().trim();
        const slug = val ? val.replace(/\/$/, '').split('/').pop() : '';
        if (val && val !== '0') episode_list.push({ label: text, url: val, slug });
    });

    return { title, cover, series_url, next_episode, prev_episode, default_embed, mirrors, downloads, episode_list };
}

// ── ROUTES ───────────────────────────────────────────────

router.get('/home', async (req, res) => {
    try {
        const $ = await fetchPage(BASE + '/');
        const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu','Random'];
        const ongoing  = { section: 'On-going Anime', url: `${BASE}/ongoing-anime/`,  items: [] };
        const complete = { section: 'Complete Anime', url: `${BASE}/complete-anime/`, items: [] };

        $('.rseries .venz ul li').each((_, li) => {
            const episode = $(li).find('.epz').text().replace(/\s+/g, ' ').trim();
            const meta    = $(li).find('.epztipe').text().replace(/\s+/g, ' ').trim();
            const date    = $(li).find('.newnime').text().trim();
            const a       = $(li).find('.thumb a').first();
            const url     = a.attr('href') || null;
            const title   = $(li).find('.jdlflm').text().trim();
            const cover   = $(li).find('img').first().attr('src') || null;
            const slug    = url ? url.replace(/\/$/, '').split('/').pop() : '';
            if (!url || !title) return;
            const item = { title, url, cover, episode, meta, date, slug, poster: cover };
            days.some(d => meta.includes(d)) ? ongoing.items.push(item) : complete.items.push(item);
        });

        const sections   = [];
        if (ongoing.items.length)  sections.push(ongoing);
        if (complete.items.length) sections.push(complete);
        const anime_list = sections.length ? sections[0].items : [];
        res.json({ status: true, anime_list, sections });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/ongoing', async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1');
        const url  = page > 1 ? `${BASE}/ongoing-anime/page/${page}/` : `${BASE}/ongoing-anime/`;
        const $    = await fetchPage(url);
        res.json({ status: true, anime_list: parseEpisodeItems($, '.rseries .venz ul li'), ...getPagination($, page) });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/completed', async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1');
        const url  = page > 1 ? `${BASE}/complete-anime/page/${page}/` : `${BASE}/complete-anime/`;
        const $    = await fetchPage(url);
        res.json({ status: true, anime_list: parseEpisodeItems($, '.rseries .venz ul li'), ...getPagination($, page) });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/search', async (req, res) => {
    try {
        const kw = req.query.q || req.query.keyword || '';
        if (!kw.trim()) return res.status(400).json({ status: false, message: 'Query kosong' });
        const $  = await fetchPage(`${BASE}/?s=${encodeURIComponent(kw)}&post_type=anime`);
        const anime_list = [];
        $('ul.chivsrc li').each((_, li) => {
            const a     = $(li).find('h2 a').first();
            const title = a.text().trim();
            const url   = a.attr('href') || null;
            const cover = $(li).find('img').first().attr('src') || null;
            const slug  = url ? url.replace(/\/$/, '').split('/').pop() : '';
            const genres = [];
            $(li).find('.set').each((_, set) => {
                if ($(set).text().trim().startsWith('Genres'))
                    $(set).find('a').each((_, a) => { const g = $(a).text().trim(); if (g) genres.push(g); });
            });
            if (url && title) anime_list.push({ title, url, cover, slug, poster: cover, genres });
        });
        res.json({ status: true, anime_list });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/detail', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).json({ status: false, message: 'Parameter url wajib diisi' });
        const $ = await fetchPage(url);
        res.json({ status: true, detail: parseDetail($) });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/anime/:slug', async (req, res) => {
    try {
        const $ = await fetchPage(`${BASE}/anime/${req.params.slug}/`);
        res.json({ status: true, detail: parseDetail($) });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/episode/:slug', async (req, res) => {
    try {
        const $ = await fetchPage(`${BASE}/episode/${req.params.slug}/`);
        res.json({ status: true, result: parseStream($) });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/resolve', async (req, res) => {
    try {
        const { id, i = '0', q } = req.query;
        if (!id || !q) return res.status(400).json({ status: false, message: 'Parameter id dan q wajib diisi' });
        const nonce    = await getNonce();
        const embedUrl = await getEmbedUrl(id, i, q, nonce);
        if (!embedUrl) return res.status(404).json({ status: false, message: 'Gagal mendapatkan embed URL' });
        res.json({ status: true, result: { id, i, q, embed_url: embedUrl } });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/filedon', async (req, res) => {
    try {
        const { id, i = '0', q } = req.query;
        if (!id || !q) return res.status(400).json({ status: false, message: 'Parameter id dan q wajib diisi' });
        const nonce    = await getNonce();
        const embedUrl = await getEmbedUrl(id, i, q, nonce);
        if (!embedUrl) return res.status(404).json({ status: false, message: 'Gagal mendapatkan embed URL' });
        if (!embedUrl.includes('filedon.co')) return res.json({ status: false, message: 'Bukan filedon', embed_url: embedUrl });
        const mp4Url = await bypassFiledon(embedUrl);
        if (!mp4Url) return res.status(500).json({ status: false, message: 'Gagal extract MP4' });
        res.json({ status: true, result: { id, i, q, embed_url: embedUrl, mp4_url: mp4Url } });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/schedule', async (req, res) => {
    try {
        const $ = await fetchPage(`${BASE}/jadwal-rilis/`);
        const schedule = [];
        $('.kglist321').each((_, el) => {
            const day   = $(el).find('h2').text().trim();
            const items = [];
            $(el).find('ul li a').each((_, a) => {
                const title = $(a).text().trim();
                const url   = $(a).attr('href') || null;
                if (title && url) items.push({ title, url });
            });
            if (day && items.length) schedule.push({ day, items });
        });
        res.json({ status: true, schedule });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/genres', async (req, res) => {
    try {
        const $ = await fetchPage(`${BASE}/genre-list/`);
        const genres = [];
        $('ul.genres li a').each((_, a) => {
            const name = $(a).text().trim();
            const href = $(a).attr('href') || '';
            const slug = href.split('/genres/')[1]?.replace('/', '') || null;
            if (name) genres.push({ name, slug, url: href });
        });
        res.json({ status: true, genres });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/genre/:slug', async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1');
        const url  = page > 1 ? `${BASE}/genres/${req.params.slug}/page/${page}/` : `${BASE}/genres/${req.params.slug}/`;
        const $    = await fetchPage(url);
        const items = [];
        $('.col-anime-con').each((_, el) => {
            const title = $(el).find('.col-anime-title a').text().trim();
            const href  = $(el).find('.col-anime-title a').attr('href') || null;
            const cover = $(el).find('.col-anime-cover img').attr('src') || null;
            const slug  = href ? href.replace(/\/$/, '').split('/').pop() : '';
            if (href && title) items.push({ title, url: href, cover, slug, poster: cover });
        });
        res.json({ status: true, anime_list: items, ...getPagination($, page) });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});


// ── ANIME LIST (A-Z) ──────────────────────────────────────
router.get('/anime-list', async (req, res) => {
    try {
        const letter = (req.query.letter || '').toUpperCase();
        const $      = await fetchPage(`${BASE}/anime-list/`);
        const alphabet = [];
        $('a.abjtext').each((_, a) => {
            const char = $(a).text().trim();
            const href = $(a).attr('href') || '';
            if (char) alphabet.push({ char, anchor: href });
        });
        let items = [];
        $('.jdlbar ul li').each((_, li) => {
            const a      = $(li).find('a.hodebgst').first();
            const url    = a.attr('href') || null;
            const title  = (a.attr('title') || a.text())
                .replace(/ \(Episode.*?\) Subtitle Indonesia/, '')
                .replace(/ Sub Indo$/, '')
                .trim();
            const status = $(li).find('span[style*="53eb53"]').text().trim() || null;
            const slug   = url ? url.replace(/\/$/, '').split('/').pop() : '';
            if (url && title) items.push({ title, url, slug, status: status || null });
        });
        if (letter) items = items.filter(i => i.title.toUpperCase().startsWith(letter));
        res.json({ status: true, total: items.length, filter: letter || 'all', alphabet, anime_list: items });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

router.get('/list', async (req, res) => {
    try {
        const { genre, status, page = 1 } = req.query;
        let url;
        if (genre) url = `${BASE}/genres/${genre}/` + (page > 1 ? `page/${page}/` : '');
        else if (status === 'Ongoing') url = `${BASE}/ongoing-anime/` + (page > 1 ? `page/${page}/` : '');
        else if (status === 'Completed') url = `${BASE}/complete-anime/` + (page > 1 ? `page/${page}/` : '');
        else url = BASE + '/';
        const $ = await fetchPage(url);
        res.json({ status: true, anime_list: parseEpisodeItems($, '.venz ul li') });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

module.exports = router;
