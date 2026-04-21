// ── App Core ──────────────────────────────────────────────────────────────────

function initApp() {
  const now = new Date();
  document.getElementById('todayLabel').textContent =
    now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const today = now.toISOString().slice(0, 10);
  const ci = document.getElementById('checkinDate');
  if (ci && !ci.value) ci.value = today;
  attachCheckinListener();
  autoCheckout();
  updateCaretaker();

  // Render immediately from local cache so UI isn't blank
  renderDashboard();
  renderBookings();
  renderCalendar();

  // Then sync from Firebase and re-render with fresh data
  DB.syncFromFirebase().then(() => {
    renderDashboard();
    renderBookings();
    renderCalendar();
  });

  // Load caretaker credentials into settings form
  if (isAdmin()) {
    const s = DB.getSettings();
    const keys = ['sudhakar', 'mango'];
    const defaults = { sudhakar: 'sudhakar', mango: 'mango' };
    keys.forEach(k => {
      const uel = document.getElementById('ct_' + k + '_user');
      if (uel) uel.value = s['ct_' + k + '_user'] || defaults[k];
    });
  }
}

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));

  const tab    = document.getElementById('tab-'  + name);
  const btn    = document.getElementById('nav-'  + name);
  const bnBtn  = document.getElementById('bn-'   + name);
  if (tab)   tab.classList.remove('hidden');
  if (btn)   btn.classList.add('active');
  if (bnBtn) bnBtn.classList.add('active');

  // Close mobile nav on tab switch
  document.getElementById('mainNav').classList.remove('nav-open');
  const overlay = document.getElementById('navOverlay');
  if (overlay) overlay.classList.remove('active');

  if (name === 'calendar')   renderCalendar();
  if (name === 'bookings')   renderBookings();
  if (name === 'dashboard')  renderDashboard();
  if (name === 'newBooking') {
    setTimeout(() => {
      const today = new Date().toISOString().slice(0, 10);
      const ci = document.getElementById('checkinDate');
      const co = document.getElementById('checkoutDate');
      if (ci && !ci.value) ci.value = today;
      attachCheckinListener();
      autoCheckout();
      updateCaretaker();
    }, 0);
  }
}

function toggleMobileNav() {
  const nav = document.getElementById('mainNav');
  const overlay = document.getElementById('navOverlay');
  nav.classList.toggle('nav-open');
  if (overlay) overlay.classList.toggle('active', nav.classList.contains('nav-open'));
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function renderDashboard() {
  const today   = new Date().toISOString().slice(0, 10);
  const allBook = DB.getBookings();
  const airbnb  = DB.getAirbnbEvents();
  const grid    = document.getElementById('todayCards');
  if (!grid) return;

  const visibleProps = isAdmin()
    ? PROPERTIES
    : PROPERTIES.filter(p => caretakerProperty().includes(p));

  let html = '';
  visibleProps.forEach(prop => {
    const ct = CARETAKERS[prop] || {};

    const propBookings = allBook
      .filter(b => b.property === prop)
      .sort((a, b) => a.checkinDate.localeCompare(b.checkinDate));

    // Pick the single most relevant booking to show:
    // 1. Active today  2. Next upcoming  3. Most recent past
    const activeToday = propBookings.filter(b =>
      b.checkinDate <= today && b.checkoutDate >= today
    );
    const upcoming = propBookings.filter(b => b.checkinDate > today);
    const abToday  = airbnb.filter(e =>
      e.property === prop && e.start <= today && e.end >= today
    );

    const featured   = activeToday[0] || upcoming[0] || propBookings[propBookings.length - 1] || null;
    const occupied   = activeToday.length > 0 || abToday.length > 0;
    const totalCount = propBookings.length;

    html += `<div class="prop-card ${occupied ? 'prop-card--occupied' : 'prop-card--vacant'}">
      <div class="prop-card-header">
        <span class="prop-name">${prop}</span>
        <span class="prop-badge ${occupied ? 'badge-occupied' : 'badge-vacant'}">${occupied ? 'OCCUPIED' : 'VACANT'}</span>
      </div>`;

    // ── Single featured booking ──
    if (featured) {
      const gp = guestStr(featured);
      const isActive   = featured.checkinDate <= today && featured.checkoutDate >= today;
      const isUpcoming = featured.checkinDate > today;
      const statusLabel = isActive ? 'TODAY' : isUpcoming ? 'UPCOMING' : 'LAST';
      html += `<div class="prop-booking-detail">
        <div class="booking-row-top">
          <div class="booking-source-tag">${featured.bookingSource || 'DIRECT'}</div>
          <div class="booking-status-tag booking-status-${isActive ? 'active' : isUpcoming ? 'upcoming' : 'past'}">${statusLabel}</div>
        </div>
        <div class="booking-guest-name">${featured.guestName || 'Guest'}</div>
        ${featured.guestPhone ? `<div class="booking-phone">📞 ${featured.guestPhone}</div>` : ''}
        <div class="booking-checkin">↓ ${formatDate(featured.checkinDate)} · ${formatTime(featured.checkinTime)}</div>
        <div class="booking-checkout">↑ ${formatDate(featured.checkoutDate)} · ${formatTime(featured.checkoutTime)}</div>
        ${gp ? `<div class="booking-guests-count">👥 ${gp}</div>` : ''}
        ${isAdmin() ? `<button onclick="showReceipt(${JSON.stringify(featured).replace(/"/g,'&quot;')})" class="btn-view-receipt">View Receipt</button>` : ''}
      </div>`;
    } else if (abToday.length > 0) {
      abToday.slice(0,1).forEach(e => {
        html += `<div class="prop-booking-detail prop-airbnb-block">
          <div class="booking-source-tag airbnb-tag">AIRBNB</div>
          <div class="booking-guest-name">${e.summary}</div>
          <div class="booking-checkin">↓ ${formatDate(e.start)}</div>
          <div class="booking-checkout">↑ ${formatDate(e.end)}</div>
        </div>`;
      });
    } else {
      html += `<div class="prop-empty">
        <div class="prop-house-icon">🏡</div>
        <p>No bookings yet</p>
        ${isAdmin() ? `<button onclick="openNewBookingForPropName('${prop}')" class="btn-add-booking">+ Add Booking</button>` : ''}
      </div>`;
    }

    // ── View All button ──
    html += `<div class="prop-viewall-row">
      <button class="btn-viewall" onclick="openPropertyDetail('${prop}')">
        View All${totalCount > 0 ? ' (' + totalCount + ')' : ''} →
      </button>
    </div>`;

    html += `<div class="prop-card-footer">
      <span class="ct-info">👤 ${ct.name}</span>
      <span class="ct-phone">${ct.phone}</span>
    </div>`;

    html += '</div>';
  });

  grid.innerHTML = html;
  renderUpcoming(allBook, airbnb, today);
}

function guestStr(b) {
  const p = [];
  if (b.adults) p.push(`${b.adults}A`);
  if (b.kids)   p.push(`${b.kids}K`);
  if (b.pets)   p.push(`${b.pets}P`);
  return p.join(' ');
}

// ── Property Detail Page ──────────────────────────────────────────────────────

let _currentDetailProp = null;

function openPropertyDetail(prop) {
  _currentDetailProp = prop;
  document.getElementById('propDetailName').textContent = prop;

  const ct = CARETAKERS[prop] || {};
  document.getElementById('propDetailSub').textContent =
    `Caretaker: ${ct.name}  ${ct.phone}`;

  // Show/hide + Booking button for admin
  const addBtn = document.querySelector('#tab-propertyDetail [data-admin]');
  if (addBtn) addBtn.style.display = isAdmin() ? '' : 'none';

  renderPropertyDetail(prop);

  // Switch to detail tab without touching nav active state
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById('tab-propertyDetail').classList.remove('hidden');
}

function renderPropertyDetail(prop) {
  const today    = new Date().toISOString().slice(0, 10);
  const bookings = DB.getBookings()
    .filter(b => b.property === prop)
    .sort((a, b) => a.checkinDate.localeCompare(b.checkinDate));

  const el = document.getElementById('propDetailContent');
  if (!el) return;

  if (bookings.length === 0) {
    el.innerHTML = `<p class="empty-msg">No bookings for ${prop} yet.</p>`;
    return;
  }

  // Group: Active → Upcoming → Past
  const active   = bookings.filter(b => b.checkinDate <= today && b.checkoutDate >= today);
  const upcoming = bookings.filter(b => b.checkinDate > today);
  const past     = bookings.filter(b => b.checkoutDate < today).reverse();

  let html = '';

  const renderGroup = (label, list, cls) => {
    if (!list.length) return;
    html += `<div class="pd-group-label">${label}</div>`;
    list.forEach(b => {
      const gp      = guestStr(b);
      const balance = (b.totalAmount || 0) - (b.advanceAmount || 0);
      html += `<div class="pd-booking-card pd-${cls}">
        <div class="pd-card-top">
          <div>
            <div class="pd-guest-name">${b.guestName || 'Guest'}</div>
            ${b.guestPhone ? `<div class="pd-phone">📞 ${b.guestPhone}</div>` : ''}
          </div>
          <div class="booking-source-tag">${b.bookingSource || 'DIRECT'}</div>
        </div>
        <div class="pd-dates">
          <span>↓ ${formatDate(b.checkinDate)} ${formatTime(b.checkinTime)}</span>
          <span class="pd-arrow">→</span>
          <span>↑ ${formatDate(b.checkoutDate)} ${formatTime(b.checkoutTime)}</span>
        </div>
        ${gp ? `<div class="pd-guests">👥 ${gp}</div>` : ''}
        <div class="pd-amounts">
          <span>₹${Number(b.totalAmount||0).toLocaleString('en-IN')} total</span>
          <span>· ₹${Number(b.advanceAmount||0).toLocaleString('en-IN')} advance</span>
          <span class="pd-balance">· ₹${Number(balance).toLocaleString('en-IN')} due</span>
        </div>
        ${b.notes ? `<div class="pd-notes">📝 ${b.notes}</div>` : ''}
        <div class="pd-actions">
          <button onclick="showReceipt(${JSON.stringify(b).replace(/"/g,'&quot;')})" class="btn-sm">Receipt</button>
          ${isAdmin() ? `<button onclick="editBooking('${b.id}')" class="btn-sm">Edit</button>` : ''}
          ${isAdmin() ? `<button onclick="deletePropBooking('${b.id}','${prop}')" class="btn-sm btn-danger">Delete</button>` : ''}
        </div>
      </div>`;
    });
  };

  renderGroup('🟢 Active Today', active, 'active');
  renderGroup('📅 Upcoming', upcoming, 'upcoming');
  renderGroup('📁 Past', past, 'past');

  el.innerHTML = html;
}

function deletePropBooking(id, prop) {
  if (!isAdmin()) return;
  if (!confirm('Delete this booking?')) return;
  DB.deleteBooking(id).then(() => {
    renderPropertyDetail(prop);
    renderDashboard();
    renderCalendar();
  });
}

function openNewBookingForProp() {
  if (_currentDetailProp) openNewBookingForPropName(_currentDetailProp);
}

function openNewBookingForPropName(prop) {
  showTab('newBooking');
  const sel = document.getElementById('property');
  if (sel) { sel.value = prop; updateCaretaker(); }
}

function renderUpcoming(bookings, airbnb, today) {
  const el = document.getElementById('upcomingList');
  if (!el) return;
  const d7 = new Date(today + 'T00:00:00');
  d7.setDate(d7.getDate() + 7);
  const end7 = d7.toISOString().slice(0, 10);

  const upcoming = bookings.filter(b =>
    b.checkinDate > today && b.checkinDate <= end7
  ).sort((a, b) => a.checkinDate.localeCompare(b.checkinDate));

  if (upcoming.length === 0) {
    el.innerHTML = '<p class="empty-msg">No upcoming arrivals in the next 7 days.</p>';
    return;
  }

  el.innerHTML = upcoming.map(b => {
    const gp = [];
    if (b.adults) gp.push(`${b.adults}A`);
    if (b.kids)   gp.push(`${b.kids}K`);
    if (b.pets)   gp.push(`${b.pets}P`);
    return `<div class="upcoming-row">
      <span class="upcoming-prop" style="color:${PROP_COLORS[b.property]}">${b.property}</span>
      <span class="upcoming-guest">${b.guestName || 'Guest'}</span>
      <span class="upcoming-date">📅 ${formatDate(b.checkinDate)} ${formatTime(b.checkinTime)}</span>
      <span class="upcoming-guests">👥 ${gp.join(' ') || '—'}</span>
      ${isAdmin() ? `<button onclick="showReceipt(${JSON.stringify(b).replace(/"/g,'&quot;')})" class="btn-sm">Receipt</button>` : ''}
    </div>`;
  }).join('');
}

// ── New Booking Form ──────────────────────────────────────────────────────────

// ── Checkout auto +1 ─────────────────────────────────────────────────────────
// When checkin date is set/changed, checkout = checkin + 1 day automatically.
// User can still manually change checkout after.

function autoCheckout() {
  const ci = document.getElementById('checkinDate');
  const co = document.getElementById('checkoutDate');
  if (!ci || !co || !ci.value) return;
  const d = new Date(ci.value + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  co.value = d.toISOString().slice(0, 10);
}

function attachCheckinListener() {
  const ci = document.getElementById('checkinDate');
  if (!ci || ci._listenerAttached) return;
  ci.addEventListener('change', autoCheckout);
  ci.addEventListener('input',  autoCheckout);
  ci._listenerAttached = true;
}

function updateCaretaker() {
  const prop = document.getElementById('property')?.value;
  const ct   = CARETAKERS[prop];
  const el   = document.getElementById('caretakerInfo');
  if (!el || !ct) return;
  el.innerHTML = `<span>👤 Caretaker: <strong>${ct.name}</strong> &nbsp; ${ct.phone}</span>`;
}

async function saveBooking() {
  if (!isAdmin()) return;

  // Manual validation
  const property    = document.getElementById('property').value;
  const guestName   = document.getElementById('guestName').value.trim();
  const checkinDate = document.getElementById('checkinDate').value;
  const checkoutDate= document.getElementById('checkoutDate').value;
  const totalAmount = document.getElementById('totalAmount').value;

  if (!guestName)    { alert('Please enter guest name.');    return; }
  if (!checkinDate)  { alert('Please select check-in date.'); return; }
  if (!checkoutDate) { alert('Please select check-out date.'); return; }
  if (!totalAmount)  { alert('Please enter total amount.');   return; }

  const booking = {
    property,
    guestName,
    guestPhone:    document.getElementById('guestPhone').value.trim(),
    checkinDate,
    checkinTime:   document.getElementById('checkinTime').value,
    checkoutDate,
    checkoutTime:  document.getElementById('checkoutTime').value,
    adults:        parseInt(document.getElementById('adults').value)        || 0,
    kids:          parseInt(document.getElementById('kids').value)          || 0,
    pets:          parseInt(document.getElementById('pets').value)          || 0,
    totalAmount:   parseFloat(document.getElementById('totalAmount').value) || 0,
    advanceAmount: parseFloat(document.getElementById('advanceAmount').value) || 0,
    bookingSource: document.getElementById('bookingSource').value,
    notes:         document.getElementById('notes').value.trim()
  };

  // Save to DB (Firebase or localStorage)
  const editId = document.getElementById('bookingForm').dataset.editId;
  let saved;
  if (editId) {
    // Update existing booking
    const bookings = DB.getBookings();
    const idx = bookings.findIndex(b => b.id === editId);
    if (idx !== -1) {
      booking.id        = editId;
      booking.createdAt = bookings[idx].createdAt;
      bookings[idx]     = booking;
      localStorage.setItem('avira_bookings', JSON.stringify(bookings));
      if (window._useFS && window._db) {
        await window._db.collection('bookings').doc(editId).set(booking);
      }
      saved = booking;
    }
    delete document.getElementById('bookingForm').dataset.editId;
    const btn = document.querySelector('#bookingForm .btn-primary');
    if (btn) btn.textContent = 'Save Booking';
  } else {
    saved = await DB.addBooking(booking);
  }

  // Re-render views with updated local cache
  renderBookings();
  renderDashboard();
  renderCalendar();

  // Reset form then show receipt
  resetForm();
  showReceipt(saved);
}

function resetForm() {
  document.getElementById('bookingForm').reset();
  delete document.getElementById('bookingForm').dataset.editId;
  const btn = document.querySelector('#bookingForm .btn-primary');
  if (btn) btn.textContent = 'Save Booking';
  const today = new Date().toISOString().slice(0, 10);
  const next  = new Date(today + 'T00:00:00');
  next.setDate(next.getDate() + 1);
  document.getElementById('checkinDate').value  = today;
  document.getElementById('checkoutDate').value = next.toISOString().slice(0, 10);
  document.getElementById('checkinTime').value  = '14:00';
  document.getElementById('checkoutTime').value = '12:00';
  updateCaretaker();
}

// ── Bookings List ─────────────────────────────────────────────────────────────

function renderBookings() {
  const list     = document.getElementById('bookingsList');
  if (!list) return;
  const propFilter  = document.getElementById('filterProperty')?.value || '';
  const monthFilter = document.getElementById('filterMonth')?.value    || '';

  let bookings = DB.getBookings();
  if (!isAdmin()) bookings = bookings.filter(b => caretakerProperty().includes(b.property));
  if (propFilter)  bookings = bookings.filter(b => b.property === propFilter);
  if (monthFilter) bookings = bookings.filter(b => b.checkinDate.startsWith(monthFilter));

  // Sort newest first
  bookings.sort((a, b) => b.checkinDate.localeCompare(a.checkinDate));

  if (bookings.length === 0) {
    list.innerHTML = '<p class="empty-msg">No bookings found.</p>';
    return;
  }

  list.innerHTML = bookings.map(b => {
    const gp = [];
    if (b.adults) gp.push(`${b.adults}A`);
    if (b.kids)   gp.push(`${b.kids}K`);
    if (b.pets)   gp.push(`${b.pets}P`);
    const balance = (b.totalAmount || 0) - (b.advanceAmount || 0);
    return `
    <div class="booking-card" style="border-left:4px solid ${PROP_COLORS[b.property] || '#888'}">
      <div class="bc-top">
        <span class="bc-prop">${b.property}</span>
        <span class="bc-id">${b.id}</span>
        <span class="bc-source">${b.bookingSource || ''}</span>
      </div>
      <div class="bc-guest"><strong>${b.guestName || 'Guest'}</strong> &nbsp; ${b.guestPhone || ''}</div>
      <div class="bc-dates">
        📅 ${formatDate(b.checkinDate)} ${formatTime(b.checkinTime)} → 
           ${formatDate(b.checkoutDate)} ${formatTime(b.checkoutTime)}
      </div>
      <div class="bc-guests">👥 ${gp.join(' ') || '—'}</div>
      <div class="bc-amount">
        ₹${Number(b.totalAmount||0).toLocaleString('en-IN')} total &nbsp;|&nbsp;
        ₹${Number(b.advanceAmount||0).toLocaleString('en-IN')} advance &nbsp;|&nbsp;
        <strong>₹${Number(balance).toLocaleString('en-IN')} due</strong>
      </div>
      ${b.notes ? `<div class="bc-notes">📝 ${b.notes}</div>` : ''}
      <div class="bc-actions">
        <button onclick="showReceipt(${JSON.stringify(b).replace(/"/g,'&quot;')})" class="btn-sm">Receipt</button>
        ${isAdmin() ? `<button onclick="editBooking('${b.id}')" class="btn-sm">Edit</button>` : ''}
        ${isAdmin() ? `<button onclick="deleteBooking('${b.id}')" class="btn-sm btn-danger">Delete</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function deleteBooking(id) {
  if (!isAdmin()) return;
  if (!confirm('Delete this booking?')) return;
  DB.deleteBooking(id).then(() => {
    renderBookings();
    renderDashboard();
    renderCalendar();
  });
}

function editBooking(id) {
  if (!isAdmin()) return;
  const b = DB.getBookings().find(b => b.id === id);
  if (!b) return;

  showTab('newBooking');

  // Store the id being edited so saveBooking knows to update not insert
  document.getElementById('bookingForm').dataset.editId = id;

  setTimeout(() => {
    document.getElementById('property').value      = b.property;
    document.getElementById('guestName').value     = b.guestName || '';
    document.getElementById('guestPhone').value    = b.guestPhone || '';
    document.getElementById('checkinDate').value   = b.checkinDate || '';
    document.getElementById('checkinTime').value   = b.checkinTime || '14:00';
    document.getElementById('checkoutDate').value  = b.checkoutDate || '';
    document.getElementById('checkoutTime').value  = b.checkoutTime || '12:00';
    document.getElementById('adults').value        = b.adults || 0;
    document.getElementById('kids').value          = b.kids || 0;
    document.getElementById('pets').value          = b.pets || 0;
    document.getElementById('totalAmount').value   = b.totalAmount || '';
    document.getElementById('advanceAmount').value = b.advanceAmount || '';
    document.getElementById('bookingSource').value = b.bookingSource || 'Direct';
    document.getElementById('notes').value         = b.notes || '';
    updateCaretaker();

    // Change button label to indicate editing
    const btn = document.querySelector('#bookingForm .btn-primary');
    if (btn) btn.textContent = 'Update Booking';
  }, 0);
}
