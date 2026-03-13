const express = require('express');
const axios   = require('axios');
const cheerio = require('cheerio');
const router  = express.Router();

const BASE = 'https://otakudesu.blog';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
    'Referer': BASE + '/'
};

// ── HELPERS ──────────────────────────────────────────────
async function fetchPage(url) {
    const res = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
    if (res.status !== 200) throw new Error('HTTP ' + res.status);
    return cheerio.load(res.data);
}

async function getNonce() {
    const res = await axios.post(`${BASE}/wp-admin/admin-ajax.php`,
        new URLSearchParams({ action: 'aa1208d27f29ca340c92c66d1926f13f' }),
        { headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, timeout: 10000 }
    );
    if (!res.data?.data) throw new Error('Gagal mendapatkan nonce');
    return res.data.data;
}

async function getEmbedUrl(id, i, q, nonce) {
    const res = await axios.post(`${BASE}/wp-admin/admin-ajax.php`,
        new URLSearchParams({ id: String(id), i: String(i), q, nonce, action: '2a3505c93b0035d3f455df82bf976b84' }),
        { headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, timeout: 10000 }
    );
    if (!res.data?.data) return null;
    const html = Buffer.from(res.data.data, 'base64').toString('utf-8');
    const $    = cheerio.load(html);
    return $('iframe').attr('src') || null;
}

async function bypassFiledon(embedUrl) {
    const slug = embedUrl.split('/embed/')[1];
    if (!slug) return null;
    const res = await axios.get(`https://filedon.co/embed/${slug}`, {
        headers: { 'User-Agent': HEADERS['User-Agent'], 'Referer': BASE + '/' },
        timeout: 15000
    });
    const raw   = res.data.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\\/g, '');
    const match = raw.match(/"url":"(https:\/\/[^"]+\.mp4[^"]*)"/);
    return match ? match[1] : null;
}

// ── HOME ─────────────────────────────────────────────────
router.get('/home', async (req, res) => {
    try {
        const $ = await fetchPage(BASE + '/');
        const sections = [];
        $('.rseries').each((_, section) => {
            const section_title = $(section).find('.rvad h1').text().trim();
            const section_url   = $(section).find('.rapi > a').first().attr('href') || null;
            const items = [];
            $(section).find('.venz ul li').each((_, li) => {
                const episode = $(li).find('.epz').text().replace(/\s+/g, ' ').trim();
                const date    = $(li).find('.newnime').text().trim();
                const a       = $(li).find('.thumb a').first();
                const url     = a.attr('href') || null;
                const title   = $(li).find('.jdlflm').text().trim();
                const cover   = $(li).find('img').first().attr('src') || null;
                const slug    = url ? url.replace(/\/$/, '').split('/').pop() : '';
                if (url && title) items.push({ title, url, cover, episode, date, slug, poster: cover });
            });
            if (items.length) sections.push({ section: section_title, url: section_url, items });
        });
        // Flatten: ambil section pertama (ongoing) sebagai anime_list
        const anime_list = sections.length ? sections[0].items : [];
        res.json({ status: true, anime_list, sections });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── ONGOING ───────────────────────────────────────────────
router.get('/ongoing', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const $    = await fetchPage(`${BASE}/ongoing-anime/page/${page}/`);
        const anime_list = [];
        $('.venz ul li').each((_, li) => {
            const a     = $(li).find('.thumb a').first();
            const url   = a.attr('href') || null;
            const title = $(li).find('.jdlflm').text().trim();
            const cover = $(li).find('img').first().attr('src') || null;
            const ep    = $(li).find('.epz').text().trim();
            const slug  = url ? url.replace(/\/$/, '').split('/').pop() : '';
            if (url && title) anime_list.push({ title, url, cover, episode: ep, slug, poster: cover });
        });
        res.json({ status: true, anime_list });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── COMPLETED ─────────────────────────────────────────────
router.get('/completed', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const $    = await fetchPage(`${BASE}/complete-anime/page/${page}/`);
        const anime_list = [];
        $('.venz ul li').each((_, li) => {
            const a     = $(li).find('.thumb a').first();
            const url   = a.attr('href') || null;
            const title = $(li).find('.jdlflm').text().trim();
            const cover = $(li).find('img').first().attr('src') || null;
            const ep    = $(li).find('.epz').text().trim();
            const slug  = url ? url.replace(/\/$/, '').split('/').pop() : '';
            if (url && title) anime_list.push({ title, url, cover, episode: ep, slug, poster: cover });
        });
        res.json({ status: true, anime_list });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── SEARCH ────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    try {
        const { q = '' } = req.query;
        if (!q.trim()) return res.status(400).json({ status: false, message: 'Query kosong' });
        const $          = await fetchPage(`${BASE}/?s=${encodeURIComponent(q)}`);
        const anime_list = [];
        $('.venz ul li, .chivsrc ul li').each((_, li) => {
            const a     = $(li).find('a').first();
            const url   = a.attr('href') || null;
            const title = $(li).find('h2, .jdlflm').first().text().trim();
            const cover = $(li).find('img').first().attr('src') || null;
            const slug  = url ? url.replace(/\/$/, '').split('/').pop() : '';
            if (url && title) anime_list.push({ title, url, cover, slug, poster: cover });
        });
        res.json({ status: true, anime_list });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── DETAIL ────────────────────────────────────────────────
router.get('/detail', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ status: false, message: 'Parameter url wajib diisi' });

        const $ = await fetchPage(url);
        const title   = $('.jdlrx h1').first().text().trim();
        const cover   = $('.fotoanime img').first().attr('src') || null;
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
            const section_title = $(section).find('.monktit').text().trim();
            const episodes = [];
            $(section).find('ul li').each((_, li) => {
                const a   = $(li).find('a').first();
                const label = a.text().trim();
                const epUrl = a.attr('href') || '';
                const date  = $(li).find('.zeebr').text().trim();
                const slug  = epUrl ? epUrl.replace(/\/$/, '').split('/').pop() : '';
                if (epUrl) episodes.push({ label, url: epUrl, date, slug });
            });
            if (episodes.length) episode_sections.push({ section: section_title, episodes });
        });

        // Flatten episodes
        const episodes = episode_sections.flatMap(s => s.episodes).reverse();

        res.json({ status: true, detail: { title, cover, synopsis, info, genres, episode_sections, episodes, total_episodes: episodes.length } });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── DETAIL BY SLUG ────────────────────────────────────────
router.get('/anime/:slug', async (req, res) => {
    try {
        const url = `${BASE}/anime/${req.params.slug}/`;
        const $   = await fetchPage(url);
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
            const sTitle = $(section).find('.monktit').text().trim();
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

        const episodes = episode_sections.flatMap(s => s.episodes).reverse();
        res.json({ status: true, detail: { title, cover, synopsis, info, genres, episode_sections, episodes, total_episodes: episodes.length } });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── EPISODE STREAM ────────────────────────────────────────
router.get('/episode/:slug', async (req, res) => {
    try {
        const url = `${BASE}/episode/${req.params.slug}/`;
        const $   = await fetchPage(url);

        const title          = $('.posttl').first().text().trim();
        const default_embed  = $('#pembed iframe').attr('src') || null;
        const cover          = $('.cukder img').first().attr('src') || null;

        let series_url = null, next_episode = null, prev_episode = null;
        $('.flir a').each((_, a) => {
            const href  = $(a).attr('href') || '';
            const title = $(a).attr('title') || $(a).text().trim();
            if (href.includes('/anime/')) series_url = href;
            if (/selanjutnya|next/i.test(title)) next_episode = href;
            if (/sebelumnya|prev/i.test(title)) prev_episode = href;
        });

        // Mirror servers
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

        // Downloads
        const downloads = {};
        $('.download ul li').each((_, li) => {
            const quality = $(li).find('strong').text().trim();
            if (!quality) return;
            const size    = $(li).find('i').text().trim();
            const servers = [];
            $(li).find('a').each((__, a) => {
                const name = $(a).text().trim();
                const link = $(a).attr('href');
                if (link && link.startsWith('http')) servers.push({ name, link });
            });
            if (servers.length) downloads[quality] = { size, servers };
        });

        // Episode list dari selectcog
        const episode_list = [];
        $('#selectcog option').each((_, opt) => {
            const val   = $(opt).attr('value') || '';
            const text  = $(opt).text().trim();
            const slug  = val ? val.replace(/\/$/, '').split('/').pop() : '';
            if (val && val !== '0') episode_list.push({ label: text, url: val, slug });
        });

        res.json({ status: true, result: { title, cover, series_url, next_episode, prev_episode, default_embed, mirrors, downloads, episode_list } });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── RESOLVE EMBED ─────────────────────────────────────────
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

// ── FILEDON BYPASS ────────────────────────────────────────
router.get('/filedon', async (req, res) => {
    try {
        const { id, i = '0', q } = req.query;
        if (!id || !q) return res.status(400).json({ status: false, message: 'Parameter id dan q wajib diisi' });
        const nonce    = await getNonce();
        const embedUrl = await getEmbedUrl(id, i, q, nonce);
        if (!embedUrl) return res.status(404).json({ status: false, message: 'Gagal mendapatkan embed URL' });
        if (!embedUrl.includes('filedon.co')) return res.json({ status: false, message: 'Mirror ini bukan filedon', embed_url: embedUrl });
        const mp4Url = await bypassFiledon(embedUrl);
        if (!mp4Url) return res.status(500).json({ status: false, message: 'Gagal extract MP4 dari filedon' });
        res.json({ status: true, result: { id, i, q, embed_url: embedUrl, mp4_url: mp4Url } });
    } catch (e) { res.status(500).json({ status: false, message: e.message }); }
});

// ── SCHEDULE (placeholder) ────────────────────────────────
router.get('/schedule', async (req, res) => {
    res.json({ status: true, schedule: [] });
});

module.exports = router;
