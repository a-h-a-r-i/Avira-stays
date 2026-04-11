// ── Receipt Generator ─────────────────────────────────────────────────────────

const CARETAKERS = {
  'Avy Abode':   { name: 'Sudhakar', initials: 'Su', phone: '+91 95730 07450' },
  'Ira Abode':   { name: 'Sudhakar', initials: 'Su', phone: '+91 95730 07450' },
  'MangoGreens': { name: 'Suman',    initials: 'Su', phone: '+91 96529 76524' }
};

const LOCATION_QR = {
  'Avy Abode':   'https://maps.app.goo.gl/LbzULCkPcP1qdaNKA',
  'Ira Abode':   'https://maps.app.goo.gl/LbzULCkPcP1qdaNKA',
  'MangoGreens': 'https://maps.app.goo.gl/LbzULCkPcP1qdaNKA'
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function makeRefNumber(booking) {
  const d = new Date(booking.createdAt || Date.now());
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(2);
  const rand = Math.floor(100 + Math.random()*900);
  return `AVR-${yy}${mm}${dd}-${rand}`;
}

function showReceipt(booking) {
  const ct      = CARETAKERS[booking.property] || { name: '—', initials: '—', phone: '—' };
  const loc     = LOCATION_QR[booking.property] || 'https://maps.google.com';
  const balance = (booking.totalAmount || 0) - (booking.advanceAmount || 0);
  const ref     = booking.ref || makeRefNumber(booking);
  const today   = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const guestParts = [];
  if (booking.adults) guestParts.push(`${booking.adults} Adult${booking.adults > 1 ? 's' : ''}`);
  if (booking.kids)   guestParts.push(`${booking.kids} Kid${booking.kids > 1 ? 's' : ''}`);
  if (booking.pets)   guestParts.push(`${booking.pets} Pet${booking.pets > 1 ? 's' : ''}`);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=56x56&color=ffffff&bgcolor=3b2a1a&data=${encodeURIComponent(loc)}`;

  const html = `
<div class="rcpt">

  <!-- HEADER -->
  <div class="rcpt-header">
    <div class="rcpt-logo-dot"></div>
    <div class="rcpt-logo-circles">
      <div class="rcpt-circle rcpt-circle-l"></div>
      <div class="rcpt-circle rcpt-circle-r"></div>
    </div>
    <h1 class="rcpt-brand">AVIRA STAYS HOSPITALITY</h1>
    <p class="rcpt-brand-sub">FARMSTAY ESCAPES · NATURE RETREATS</p>
  </div>

  <!-- ZIGZAG TOP -->
  <div class="rcpt-zigzag rcpt-zigzag-top"></div>

  <!-- BODY -->
  <div class="rcpt-body">

    <!-- Confirmed badge -->
    <div class="rcpt-confirmed">✓ BOOKING CONFIRMED</div>

    <!-- Ref + Property -->
    <p class="rcpt-ref">Ref: ${ref}</p>
    <h2 class="rcpt-property">${booking.property}</h2>
    <p class="rcpt-guest-line">Receipt: ${today} · ${booking.guestName || 'Guest'}</p>
    ${booking.guestPhone ? `<p class="rcpt-phone">📞 ${booking.guestPhone}</p>` : ''}

    <!-- Check-in / Check-out boxes -->
    <div class="rcpt-dates-row">
      <div class="rcpt-date-box">
        <span class="rcpt-date-label">CHECK-IN</span>
        <span class="rcpt-date-val">${formatDate(booking.checkinDate)}</span>
        <span class="rcpt-time-val">${formatTime(booking.checkinTime)}</span>
      </div>
      <div class="rcpt-date-box">
        <span class="rcpt-date-label">CHECK-OUT</span>
        <span class="rcpt-date-val">${formatDate(booking.checkoutDate)}</span>
        <span class="rcpt-time-val">${formatTime(booking.checkoutTime)}</span>
      </div>
    </div>

    <!-- Guests box -->
    <div class="rcpt-guests-box">
      <span class="rcpt-date-label">GUESTS</span>
      <span class="rcpt-guests-val">${guestParts.join(' · ') || '—'}</span>
    </div>

    <!-- Payment panel -->
    <div class="rcpt-payment">
      <div class="rcpt-pay-row">
        <div class="rcpt-pay-cell">
          <span class="rcpt-pay-label">TOTAL AMOUNT</span>
          <span class="rcpt-pay-amount">₹${Number(booking.totalAmount||0).toLocaleString('en-IN')}</span>
        </div>
        <div class="rcpt-pay-cell">
          <span class="rcpt-pay-label">ADVANCE PAID</span>
          <span class="rcpt-pay-amount">₹${Number(booking.advanceAmount||0).toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div class="rcpt-pay-row rcpt-pay-row-2">
        <div class="rcpt-pay-cell">
          <span class="rcpt-pay-label">BALANCE DUE</span>
          <span class="rcpt-pay-balance">₹${Number(balance).toLocaleString('en-IN')}</span>
        </div>
        <div class="rcpt-pay-cell">
          <span class="rcpt-pay-label">STATUS</span>
          <span class="rcpt-pay-status">${balance > 0 ? 'Pending' : 'Paid'}</span>
        </div>
      </div>
    </div>

    <!-- QR Location -->
    <a class="rcpt-location" href="${loc}" target="_blank">
      <div class="rcpt-qr-box">
        <img src="${qrUrl}" alt="QR" width="56" height="56" />
      </div>
      <div class="rcpt-location-text">
        <span class="rcpt-location-label">TAP TO OPEN LOCATION</span>
        <span class="rcpt-location-name">📍 Google Maps — ${booking.property}</span>
      </div>
    </a>

    <!-- Caretaker -->
    <div class="rcpt-caretaker-section">
      <span class="rcpt-date-label">CARETAKER CONTACT</span>
      <div class="rcpt-caretaker-row">
        <div class="rcpt-ct-avatar">${ct.initials}</div>
        <div class="rcpt-ct-info">
          <span class="rcpt-ct-name">${ct.name}</span>
          <span class="rcpt-ct-phone">${ct.phone}</span>
        </div>
      </div>
    </div>

    <!-- Note -->
    <div class="rcpt-note">
      🌿 Thank you for your booking! Kindly carry extra towels, toiletries and appropriate swimwear etc.
    </div>

  </div>

  <!-- ZIGZAG BOTTOM -->
  <div class="rcpt-zigzag rcpt-zigzag-bottom"></div>

  <!-- FOOTER -->
  <div class="rcpt-footer">
    Avira Stays Hospitality · Farmstay Bookings
  </div>

</div>`;

  document.getElementById('receiptContent').innerHTML = html;
  document.getElementById('receiptModal').classList.remove('hidden');
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeReceipt() {
  document.getElementById('receiptModal').classList.add('hidden');
  document.getElementById('modalOverlay').classList.add('hidden');
}

// ── Share Receipt as PDF ──────────────────────────────────────────────────────
async function shareReceipt() {
  const btn = document.querySelector('.rcpt-share-btn');
  const original = btn.textContent;
  btn.textContent = 'Generating PDF…';
  btn.disabled = true;

  try {
    const node = document.getElementById('receiptContent');

    // Render receipt div to canvas
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;

    // A4-width PDF, height proportional to receipt
    const pdfW = 210; // mm
    const pdfH = Math.round((canvas.height / canvas.width) * pdfW);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfW, pdfH]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);

    const pdfBlob = pdf.output('blob');
    const fileName = `avira-stays-receipt.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Try native share with PDF file (works on Android/iOS)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Avira Stays – Booking Receipt',
        text: 'Your booking confirmation from Avira Stays Hospitality.',
        files: [file]
      });
    } else {
      // Desktop fallback — download the PDF
      pdf.save(fileName);
    }
  } catch (err) {
    console.error('PDF share error:', err);
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

function showShareToast(msg) {
  const t = document.getElementById('shareToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3500);
}
