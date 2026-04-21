// ── Calendar & iCal ───────────────────────────────────────────────────────────

const PROPERTIES = ['Avy Abode', 'Ira Abode', 'MangoGreens'];
const PROP_COLORS = {
  'Avy Abode':   '#7a9a6a',
  'Ira Abode':   '#c8a84a',
  'MangoGreens': '#6a9a8a'
};

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const bookings      = DB.getBookings();
  const airbnbEvents  = DB.getAirbnbEvents();

  // Build a map: "YYYY-MM-DD" -> [{label, color, source}]
  const dayMap = {};

  function markRange(startDate, endDate, label, color, source) {
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate   + 'T00:00:00');
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push({ label, color, source });
      cur.setDate(cur.getDate() + 1);
    }
  }

  bookings.forEach(b => {
    markRange(b.checkinDate, b.checkoutDate,
      `${b.property}: ${b.guestName || 'Guest'}`,
      PROP_COLORS[b.property] || '#888', 'local');
  });

  airbnbEvents.forEach(e => {
    markRange(e.start, e.end, `${e.property} (Airbnb)`,
      '#ff5a5f', 'airbnb');
  });

  // Render 3-month view (prev, current, next)
  let html = '<div class="cal-months">';
  for (let mo = calMonth - 1; mo <= calMonth + 1; mo++) {
    let y = calYear, m = mo;
    if (m < 0)  { m += 12; y--; }
    if (m > 11) { m -= 12; y++; }
    html += renderMonth(y, m, dayMap);
  }
  html += '</div>';
  html += `<div class="cal-nav">
    <button onclick="calNav(-1)" class="btn-secondary">← Prev</button>
    <button onclick="calNav(0)"  class="btn-secondary">Today</button>
    <button onclick="calNav(1)"  class="btn-secondary">Next →</button>
  </div>`;

  // Legend
  html += '<div class="cal-legend">';
  PROPERTIES.forEach(p => {
    html += `<span class="legend-dot" style="background:${PROP_COLORS[p]}"></span>${p} &nbsp;`;
  });
  html += `<span class="legend-dot" style="background:#ff5a5f"></span>Airbnb`;
  html += '</div>';

  grid.innerHTML = html;

  // Load saved ical links into inputs
  const links = DB.getIcalLinks();
  PROPERTIES.forEach(p => {
    const el = document.getElementById('ical_' + p);
    if (el && links[p]) el.value = links[p];
  });
}

function renderMonth(year, month, dayMap) {
  const monthName = new Date(year, month, 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMo  = new Date(year, month + 1, 0).getDate();
  const today     = new Date().toISOString().slice(0, 10);

  let html = `<div class="cal-month">
    <div class="cal-month-title">${monthName}</div>
    <div class="cal-week-header">
      <span>Su</span><span>Mo</span><span>Tu</span><span>We</span>
      <span>Th</span><span>Fr</span><span>Sa</span>
    </div>
    <div class="cal-days">`;

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

  for (let d = 1; d <= daysInMo; d++) {
    const key    = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const events = dayMap[key] || [];
    const isToday = key === today;
    const dots   = events.map(e =>
      `<span class="cal-dot" style="background:${e.color}" title="${e.label}"></span>`
    ).join('');
    html += `<div class="cal-day${isToday ? ' today' : ''}${events.length ? ' has-event' : ''}">
      <span class="cal-day-num">${d}</span>
      <div class="cal-dots">${dots}</div>
    </div>`;
  }

  html += '</div></div>';
  return html;
}

function calNav(dir) {
  if (dir === 0) {
    calYear  = new Date().getFullYear();
    calMonth = new Date().getMonth();
  } else {
    calMonth += dir;
    if (calMonth < 0)  { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0;  calYear++; }
  }
  renderCalendar();
}

function saveIcalLinks() {
  const links = {};
  PROPERTIES.forEach(p => {
    const el = document.getElementById('ical_' + p);
    if (el && el.value.trim()) links[p] = el.value.trim();
  });
  DB.saveIcalLinks(links);
  document.getElementById('syncStatus').textContent = 'iCal links saved.';
  setTimeout(() => document.getElementById('syncStatus').textContent = '', 2000);
}

async function syncAirbnb() {
  const links  = DB.getIcalLinks();
  const status = document.getElementById('syncStatus');
  status.textContent = 'Syncing...';

  const events = [];
  const PROXY  = 'https://api.allorigins.win/raw?url=';

  for (const [property, url] of Object.entries(links)) {
    try {
      const res  = await fetch(PROXY + encodeURIComponent(url));
      const text = await res.text();
      const parsed = parseIcal(text, property);
      events.push(...parsed);
    } catch (e) {
      console.warn('iCal fetch failed for', property, e);
    }
  }

  DB.saveAirbnbEvents(events);
  renderCalendar();
  status.textContent = `Synced ${events.length} Airbnb event(s).`;
  setTimeout(() => status.textContent = '', 3000);
}

function parseIcal(text, property) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  blocks.slice(1).forEach(block => {
    const dtstart = (block.match(/DTSTART[^:]*:(\d{8})/) || [])[1];
    const dtend   = (block.match(/DTEND[^:]*:(\d{8})/)   || [])[1];
    const summary = (block.match(/SUMMARY:(.+)/)          || [])[1] || 'Airbnb Block';
    if (dtstart && dtend) {
      events.push({
        property,
        start:   `${dtstart.slice(0,4)}-${dtstart.slice(4,6)}-${dtstart.slice(6,8)}`,
        end:     `${dtend.slice(0,4)}-${dtend.slice(4,6)}-${dtend.slice(6,8)}`,
        summary: summary.trim()
      });
    }
  });
  return events;
}

// Export iCal for a property (to upload to Airbnb to block dates)
function exportIcal(property) {
  const bookings = DB.getBookings().filter(b => b.property === property);
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Avira Stays//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  bookings.forEach(b => {
    const uid   = b.id + '@avira-stays';
    const start = b.checkinDate.replace(/-/g, '');
    const end   = b.checkoutDate.replace(/-/g, '');
    const note  = `Guest: ${b.guestName || 'Guest'} | ${b.adults || 0}A ${b.kids || 0}K ${b.pets || 0}P | ${b.notes || ''}`.trim();
    ical.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:Avira Stays – ${property} – ${b.guestName || 'Booked'}`,
      `DESCRIPTION:${note}`,
      'END:VEVENT'
    );
  });

  ical.push('END:VCALENDAR');

  const blob = new Blob([ical.join('\r\n')], { type: 'text/calendar' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `avira-${property.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
}

function toggleIcal() {
  const body  = document.getElementById('icalBody');
  const arrow = document.getElementById('icalArrow');
  if (!body) return;
  const open = body.classList.toggle('hidden');
  arrow.innerHTML = open ? '&#9660;' : '&#9650;';
}
