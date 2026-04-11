// ── DB — Firebase Firestore + localStorage fallback ───────────────────────────
//
//  If Firebase config is filled in → data syncs across all devices via cloud.
//  If config is still placeholder   → falls back to localStorage (local only).
// ─────────────────────────────────────────────────────────────────────────────

let _db      = null;   // Firestore instance
let _useFS   = false;  // true once Firebase is ready

function _isConfigured() {
  return FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('PASTE_YOUR');
}

// Called once on page load (from index.html after firebase-config.js loads)
async function initFirebase() {
  if (!_isConfigured()) {
    console.warn('Firebase not configured — using localStorage.');
    return;
  }
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _db    = firebase.firestore();
    _useFS = true;
    console.log('Firebase connected ✓');
  } catch (e) {
    console.error('Firebase init failed, falling back to localStorage:', e);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _col(name) { return _db.collection(name); }

// ── Bookings ──────────────────────────────────────────────────────────────────

const DB = {

  // ── READ all bookings (returns Promise<array> OR array) ──
  async getBookingsAsync() {
    if (_useFS) {
      const snap = await _col('bookings').orderBy('checkinDate').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return JSON.parse(localStorage.getItem('avira_bookings') || '[]');
  },

  // Sync version for code that hasn't been made async yet — uses cached copy
  getBookings() {
    return JSON.parse(localStorage.getItem('avira_bookings') || '[]');
  },

  // ── ADD booking ──
  async addBooking(booking) {
    booking.createdAt = new Date().toISOString();
    if (_useFS) {
      booking.id = 'BK' + Date.now();
      await _col('bookings').doc(booking.id).set(booking);
      // Also update local cache
      const local = this.getBookings();
      local.push(booking);
      localStorage.setItem('avira_bookings', JSON.stringify(local));
      return booking;
    }
    // localStorage path
    const bookings = this.getBookings();
    booking.id = 'BK' + Date.now();
    bookings.push(booking);
    localStorage.setItem('avira_bookings', JSON.stringify(bookings));
    return booking;
  },

  // ── DELETE booking ──
  async deleteBooking(id) {
    if (_useFS) {
      await _col('bookings').doc(id).delete();
    }
    const bookings = this.getBookings().filter(b => b.id !== id);
    localStorage.setItem('avira_bookings', JSON.stringify(bookings));
  },

  // ── SYNC from Firebase → local cache (call on app load) ──
  async syncFromFirebase() {
    if (!_useFS) return;
    try {
      const bookings  = await this.getBookingsAsync();
      localStorage.setItem('avira_bookings', JSON.stringify(bookings));

      const settSnap  = await _col('settings').doc('main').get();
      if (settSnap.exists) {
        localStorage.setItem('avira_settings', JSON.stringify(settSnap.data()));
      }

      const icalSnap  = await _col('settings').doc('ical').get();
      if (icalSnap.exists) {
        localStorage.setItem('avira_ical_links', JSON.stringify(icalSnap.data()));
      }

      const abSnap    = await _col('airbnb_events').get();
      const abEvents  = abSnap.docs.map(d => d.data());
      localStorage.setItem('avira_airbnb_events', JSON.stringify(abEvents));

      console.log('Synced from Firebase ✓');
    } catch (e) {
      console.warn('Firebase sync failed, using local cache:', e);
    }
  },

  // ── Settings ──
  getSettings() {
    return JSON.parse(localStorage.getItem('avira_settings') || '{}');
  },
  async saveSettings(settings) {
    localStorage.setItem('avira_settings', JSON.stringify(settings));
    if (_useFS) await _col('settings').doc('main').set(settings);
  },

  // ── iCal links ──
  getIcalLinks() {
    return JSON.parse(localStorage.getItem('avira_ical_links') || '{}');
  },
  async saveIcalLinks(links) {
    localStorage.setItem('avira_ical_links', JSON.stringify(links));
    if (_useFS) await _col('settings').doc('ical').set(links);
  },

  // ── Airbnb events ──
  getAirbnbEvents() {
    return JSON.parse(localStorage.getItem('avira_airbnb_events') || '[]');
  },
  async saveAirbnbEvents(events) {
    localStorage.setItem('avira_airbnb_events', JSON.stringify(events));
    if (_useFS) {
      const batch = _db.batch();
      // Clear old + write new
      const old = await _col('airbnb_events').get();
      old.docs.forEach(d => batch.delete(d.ref));
      events.forEach((e, i) => {
        batch.set(_col('airbnb_events').doc('ev_' + i), e);
      });
      await batch.commit();
    }
  }
};
