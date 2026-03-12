// ── SCHEDULE PAGE ──

const DAYS_ID = {
    monday:    'Senin',
    tuesday:   'Selasa',
    wednesday: 'Rabu',
    thursday:  'Kamis',
    friday:    'Jumat',
    saturday:  'Sabtu',
    sunday:    'Minggu',
};

const DAYS_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

// Hari ini dalam bahasa Inggris (lowercase)
function getTodayKey() {
    return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];
}

// Parse episode_info → "Ep 09" atau "at 17:00 (Ep 09)"
function parseEpInfo(info) {
    const match = info.match(/\((\d+)\)/);
    const ep    = match ? `Ep ${match[1]}` : '';
    const time  = info.startsWith('at') ? info.split(' ')[1] : null;
    return { ep, time };
}

// ════════════════════════════
//  FETCH
// ════════════════════════════
async function fetchSchedule() {
    const res = await fetch('/api/anime/schedule');
    if (!res.ok) throw new Error('Gagal memuat jadwal');
    return res.json();
}

// ════════════════════════════
//  RENDER
// ════════════════════════════
function renderSchedule(schedule, activeDay) {
    const container = document.getElementById('schedule-content');
    const list      = schedule[activeDay] || [];
    const todayKey  = getTodayKey();

    if (!list.length) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h3>Tidak ada jadwal</h3>
                <p>Hari ini tidak ada anime yang tayang</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map((anime, i) => {
        const { ep, time } = parseEpInfo(anime.episode_info);
        const isToday      = activeDay === todayKey;
        return `
            <div class="schedule-item" style="animation-delay:${i * 50}ms" onclick="goDetail('${anime.slug}')">
                <div class="schedule-time">
                    ${time
                        ? `<span class="time-badge ${isToday ? 'today' : ''}">${time}</span>`
                        : `<span class="time-badge released">Tayang</span>`
                    }
                </div>
                <div class="schedule-info">
                    <div class="schedule-title">${anime.title}</div>
                    ${ep ? `<div class="schedule-ep">${ep}</div>` : ''}
                </div>
                <div class="schedule-arrow">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <polyline points="9,18 15,12 9,6"/>
                    </svg>
                </div>
            </div>
        `;
    }).join('');
}

function renderDayTabs(schedule, activeDay) {
    const todayKey  = getTodayKey();
    const container = document.getElementById('day-tabs');

    container.innerHTML = DAYS_ORDER.map(day => {
        const count   = schedule[day]?.length || 0;
        const isToday = day === todayKey;
        const isActive = day === activeDay;
        return `
            <button class="day-tab ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}"
                    data-day="${day}" onclick="switchDay('${day}')">
                <span class="day-name">${DAYS_ID[day]}</span>
                ${count ? `<span class="day-count">${count}</span>` : ''}
                ${isToday ? '<span class="today-dot"></span>' : ''}
            </button>
        `;
    }).join('');
}

// ════════════════════════════
//  SWITCH DAY
// ════════════════════════════
let _schedule = null;

function switchDay(day) {
    if (!_schedule) return;
    document.querySelectorAll('.day-tab').forEach(t => t.classList.toggle('active', t.dataset.day === day));
    renderSchedule(_schedule, day);

    // Update header hari
    const todayKey = getTodayKey();
    const label    = document.getElementById('active-day-label');
    if (label) label.textContent = day === todayKey ? `${DAYS_ID[day]} · Hari Ini` : DAYS_ID[day];
}

// ════════════════════════════
//  NAVIGATE
// ════════════════════════════
function goDetail(slug) {
    window.location.href = `/detail?slug=${slug}`;
}

// ════════════════════════════
//  INIT
// ════════════════════════════
async function init() {
    const container = document.getElementById('schedule-content');
    const todayKey  = getTodayKey();

    // Skeleton
    container.innerHTML = Array.from({ length: 4 }, () => `
        <div class="schedule-skeleton">
            <div class="sk-time"></div>
            <div class="sk-body">
                <div class="sk-line"></div>
                <div class="sk-line short"></div>
            </div>
        </div>
    `).join('');

    try {
        const data = await fetchSchedule();
        _schedule  = data.schedule || {};

        renderDayTabs(_schedule, todayKey);
        renderSchedule(_schedule, todayKey);

        const label = document.getElementById('active-day-label');
        if (label) label.textContent = `${DAYS_ID[todayKey]} · Hari Ini`;

    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Gagal Memuat</h3>
                <p>${err.message}</p>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', init);

