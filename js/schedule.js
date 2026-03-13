// ── SCHEDULE PAGE ──

const DAYS_ID = {
    'Senin':'Senin', 'Selasa':'Selasa', 'Rabu':'Rabu', 'Kamis':'Kamis',
    'Jumat':'Jumat', 'Sabtu':'Sabtu', 'Minggu':'Minggu'
};
const DAYS_ORDER = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

function getTodayKey() {
    const idx = new Date().getDay(); // 0=Sun
    return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][idx];
}

async function fetchSchedule() {
    const res = await fetch('/api/anime/schedule');
    if (!res.ok) throw new Error('Gagal memuat jadwal');
    return res.json();
}

// Convert array dari scraper → object { Senin: [{title,url}], ... }
function normalizeSchedule(raw) {
    const result = {};
    (raw || []).forEach(({ day, items }) => { if (day && items) result[day] = items; });
    return result;
}

function renderSchedule(schedule, activeDay) {
    const container = document.getElementById('schedule-content');
    const list      = schedule[activeDay] || [];
    const todayKey  = getTodayKey();

    if (!list.length) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h3>Tidak ada jadwal</h3>
                <p>Tidak ada anime yang tayang hari ini</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map((anime, i) => {
        const isToday = activeDay === todayKey;
        const slug    = anime.url ? anime.url.replace(/\/$/, '').split('/').pop() : '';
        const href    = anime.url && anime.url.includes('/anime/')
            ? `/detail?slug=${slug}`
            : `/detail?url=${encodeURIComponent(anime.url || '')}`;
        return `
        <div class="schedule-item" style="animation-delay:${i * 40}ms" onclick="window.location.href='${href}'">
            <div class="schedule-time">
                <span class="time-badge ${isToday ? 'today' : 'released'}">
                    ${isToday ? 'Hari Ini' : activeDay.slice(0,3)}
                </span>
            </div>
            <div class="schedule-info">
                <div class="schedule-title">${escHtml(anime.title)}</div>
            </div>
            <div class="schedule-arrow">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <polyline points="9,18 15,12 9,6"/>
                </svg>
            </div>
        </div>`;
    }).join('');
}

function renderDayTabs(schedule, activeDay) {
    const todayKey  = getTodayKey();
    const container = document.getElementById('day-tabs');
    container.innerHTML = DAYS_ORDER.map(day => {
        const count    = schedule[day]?.length || 0;
        const isToday  = day === todayKey;
        const isActive = day === activeDay;
        return `
        <button class="day-tab ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}"
                data-day="${day}" onclick="switchDay('${day}')">
            <span class="day-name">${day}</span>
            ${count ? `<span class="day-count">${count}</span>` : ''}
            ${isToday ? '<span class="today-dot"></span>' : ''}
        </button>`;
    }).join('');
}

let _schedule = null;

function switchDay(day) {
    if (!_schedule) return;
    document.querySelectorAll('.day-tab').forEach(t => t.classList.toggle('active', t.dataset.day === day));
    renderSchedule(_schedule, day);
    const label = document.getElementById('active-day-label');
    if (label) label.textContent = day === getTodayKey() ? `${day} · Hari Ini` : day;
}

function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function init() {
    const container = document.getElementById('schedule-content');
    const todayKey  = getTodayKey();

    container.innerHTML = Array.from({ length: 5 }, () => `
        <div class="schedule-skeleton">
            <div class="sk-time"></div>
            <div class="sk-body">
                <div class="sk-line"></div>
                <div class="sk-line short"></div>
            </div>
        </div>`).join('');

    try {
        const data = await fetchSchedule();
        _schedule  = normalizeSchedule(data.schedule);

        renderDayTabs(_schedule, todayKey);
        renderSchedule(_schedule, todayKey);

        const label = document.getElementById('active-day-label');
        if (label) label.textContent = `${todayKey} · Hari Ini`;

    } catch(err) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Gagal Memuat</h3>
                <p>${err.message}</p>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', init);
