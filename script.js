/* Guest house allocation dashboard
   - parse CSV (upload / paste)
   - allow mapping of Month, Date and 6 room columns
   - build a calendar view for a selected month
   - click a day to edit room assignments (local only)
   - export CSV with updated values
*/

// Utilities
function csvParse(text) {
  // simple robust CSV parser with quoted field support
  const rows = [];
  let i = 0, N = text.length;
  let field = '';
  let row = [];
  let inQuotes = false;
  while (i < N) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < N && text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i++;
      } else {
        field += ch; i++;
      }
    } else {
      if (ch === '"') { inQuotes = true; i++; }
      else if (ch === ',') { row.push(field); field = ''; i++; }
      else if (ch === '\r') { i++; }
      else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; }
      else { field += ch; i++; }
    }
  }
  // push last
  if (inQuotes === false) {
    if (field !== '' || row.length) row.push(field);
    if (row.length) rows.push(row);
  }
  return rows;
}

function arrayUnique(arr){ return [...new Set(arr)]; }

// DOM refs
const fileInput = document.getElementById('file-input');
const csvText = document.getElementById('csv-text');
const parseBtn = document.getElementById('parse-btn');
const previewTable = document.getElementById('preview-table');
const mappingGrid = document.getElementById('mapping-grid');
const buildBtn = document.getElementById('build-btn');
const loadSampleBtn = document.getElementById('load-sample');
const dashboardSection = document.getElementById('dashboard-section');
const monthSelect = document.getElementById('month-select');
const calendarDiv = document.getElementById('calendar');
const availabilityDiv = document.getElementById('availability');
const exportBtn = document.getElementById('export-btn');

// modal
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalRooms = document.getElementById('modal-rooms');
const modalForm = document.getElementById('modal-form');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');

let parsed = null; // parsed CSV array of rows
let headers = []; // header labels (if any)
let mapping = {
  month: 0,
  date: 1,
  rooms: [2,3,4,5,6,7]
};
let dataMap = {}; // keyed by monthName -> {date -> [room1..room6]}
let monthsList = [];

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const txt = await f.text();
  csvText.value = txt;
});

loadSampleBtn.addEventListener('click', () => {
  // small sample to let user try without loading the full CSV
  csvText.value = [
    'Months,Date,Room 01,Room 02,Room 03,Room 04,Room 05,Room 06',
    'JANUARY,1,John Doe,Mary,,Alex,,',
    ',2, ,Mary,Peter,,Anna,',
    ',3,John Doe,,Peter,,Anna,Tom',
    'FEBRUARY,1, , , , , , ',
    ',2,Alice,Bob, , , , '
  ].join('\n');
});

parseBtn.addEventListener('click', () => {
  const txt = csvText.value.trim();
  if (!txt) { alert('Please paste CSV content or upload file first.'); return; }
  parsed = csvParse(txt);
  if (!parsed || parsed.length === 0) { alert('Could not parse CSV'); return; }
  // show preview of first 8 rows
  renderPreview(parsed);
  // prepare header choices
  prepareMapping(parsed);
});

function renderPreview(rows) {
  const previewRows = rows.slice(0, 10);
  let html = '<table><thead><tr>';
  const maxCols = Math.max(...previewRows.map(r => r.length));
  for (let c = 0; c < maxCols; c++) html += `<th>Col ${c}</th>`;
  html += '</tr></thead><tbody>';
  previewRows.forEach((r, idx) => {
    html += '<tr>';
    for (let c = 0; c < maxCols; c++) {
      const v = r[c] === undefined ? '' : escapeHtml(r[c]);
      html += `<td title="${v}">${v}</td>`;
    }
    html += '</tr>';
  });
  html += '</tbody></table>';
  previewTable.innerHTML = html;
}

function prepareMapping(rows) {
  // if first row looks like header (contains non-empty strings), use it
  const first = rows[0] || [];
  const headerCandidates = first.map((h, i) => (h && h.trim()) ? h.trim() : `Col ${i}`);
  headers = headerCandidates;
  mappingGrid.innerHTML = '';
  // Create select widgets for Month, Date, and Room 1..6
  const items = [
    { key: 'month', label: 'Month column' },
    { key: 'date', label: 'Date column' }
  ];
  for (let r = 1; r <= 6; r++) items.push({ key: 'room' + r, label: `Room No. ${String(r).padStart(2,'0')}` });

  items.forEach((it, idx) => {
    const div = document.createElement('div');
    div.className = 'mapping-item';
    const label = document.createElement('label');
    label.textContent = it.label;
    const sel = document.createElement('select');
    sel.dataset.key = it.key;
    // populate
    for (let c = 0; c < headers.length; c++) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = headers[c] || `Col ${c}`;
      sel.appendChild(opt);
    }
    // set defaults:
    if (it.key === 'month') sel.value = 0;
    else if (it.key === 'date') sel.value = 1;
    else {
      // map rooms to subsequent columns by default
      const rnum = parseInt(it.key.replace('room',''));
      sel.value = 1 + rnum; // naive default
    }
    div.appendChild(label);
    div.appendChild(sel);
    mappingGrid.appendChild(div);
  });
}

function buildMappingFromUI() {
  const selects = mappingGrid.querySelectorAll('select');
  const mm = { rooms: [] };
  selects.forEach(s => {
    const key = s.dataset.key;
    const val = parseInt(s.value);
    if (key === 'month') mm.month = val;
    else if (key === 'date') mm.date = val;
    else {
      mm.rooms.push(val);
    }
  });
  // validate: 6 rooms
  if (!mm.month && mm.month !== 0) { alert('Please select Month column'); return null; }
  if (!mm.date && mm.date !== 0) { alert('Please select Date column'); return null; }
  if (mm.rooms.length !== 6) { alert('Please select six room columns'); return null; }
  return mm;
}

buildBtn.addEventListener('click', () => {
  if (!parsed) { alert('Parse CSV first'); return; }
  const mm = buildMappingFromUI();
  if (!mm) return;
  mapping = mm;
  buildDataMap();
  populateMonthSelect();
  dashboardSection.classList.remove('hidden');
  monthSelect.dispatchEvent(new Event('change'));
});

function buildDataMap() {
  dataMap = {};
  let currentMonth = null;
  const monthCol = mapping.month;
  const dateCol = mapping.date;
  const roomsCols = mapping.rooms;
  for (let r = 0; r < parsed.length; r++) {
    const row = parsed[r];
    const mc = (row[monthCol] || '').trim();
    // If a row defines the month (non-empty and looks like a month word), set currentMonth
    if (mc) currentMonth = mc.trim();
    // read date
    const dateVal = (row[dateCol] || '').trim();
    if (!currentMonth) continue;
    if (!dataMap[currentMonth]) dataMap[currentMonth] = {};
    if (dateVal === '') continue; // skip rows without date
    const dateKey = dateVal.replace(/^0+/, '') || dateVal; // keep literal
    // gather rooms
    const rooms = roomsCols.map(ci => {
      const val = row[ci] === undefined ? '' : (row[ci] || '').trim();
      return val === '' ? '' : val;
    });
    // if date already exists, we may want to merge: prefer non-empty cells per room
    if (!dataMap[currentMonth][dateKey]) dataMap[currentMonth][dateKey] = rooms.slice();
    else {
      // merge to keep any non-empty value
      const existing = dataMap[currentMonth][dateKey];
      for (let i=0;i<6;i++) if ((!existing[i] || existing[i]==='') && rooms[i] && rooms[i]!=='') existing[i] = rooms[i];
    }
  }
  monthsList = arrayUnique(Object.keys(dataMap));
}

function populateMonthSelect() {
  monthSelect.innerHTML = '';
  // use monthsList in parsed order; fallback to sorted
  const months = monthsList.length ? monthsList : arrayUnique(parsed.map(r => (r[mapping.month]||'').trim()).filter(Boolean));
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });
}

// when month changed, render calendar and availability
monthSelect.addEventListener('change', () => {
  const month = monthSelect.value;
  renderCalendar(month);
  renderAvailability(month);
});

function renderCalendar(month) {
  calendarDiv.innerHTML = '';
  if (!month) return;
  const days = dataMap[month] || {};
  // find max day number (treat date keys that can be numbers)
  const dayKeys = Object.keys(days).sort((a,b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na-nb;
    return a.localeCompare(b);
  });
  // if no days found, show message
  if (dayKeys.length === 0) {
    calendarDiv.innerHTML = `<div class="day">No day rows found for ${escapeHtml(month)}. Check column mapping or CSV format.</div>`;
    return;
  }
  dayKeys.forEach(dk => {
    const rooms = days[dk] || ['', '', '', '', '', ''];
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    dayEl.dataset.month = month;
    dayEl.dataset.date = dk;
    dayEl.innerHTML = `<h4>Day ${escapeHtml(dk)}</h4>`;
    const roomList = document.createElement('div');
    roomList.className = 'room-list';
    rooms.forEach((rname, idx) => {
      const item = document.createElement('div');
      item.className = 'room-item';
      const roomLabel = document.createElement('div');
      roomLabel.textContent = `Room ${String(idx+1).padStart(2,'0')}`;
      const nameLabel = document.createElement('div');
      nameLabel.textContent = rname || 'Available';
      nameLabel.className = rname ? '' : 'room-empty';
      item.appendChild(roomLabel);
      item.appendChild(nameLabel);
      roomList.appendChild(item);
    });
    dayEl.appendChild(roomList);
    // click handler to edit
    dayEl.addEventListener('click', () => openModalEdit(month, dk));
    calendarDiv.appendChild(dayEl);
  });
}

function renderAvailability(month) {
  availabilityDiv.innerHTML = '';
  const days = dataMap[month] || {};
  const counts = { totalDays:0, perRoom: [0,0,0,0,0,0] };
  const dayKeys = Object.keys(days);
  counts.totalDays = dayKeys.length;
  dayKeys.forEach(dk => {
    const rooms = days[dk] || [];
    rooms.forEach((r, idx) => {
      if (r && r.trim() !== '') counts.perRoom[idx]++;
    });
  });
  // render summary: for each room show occupied days vs total
  for (let i=0;i<6;i++) {
    const c = counts.perRoom[i];
    const card = document.createElement('div');
    card.className = 'avail-card';
    card.innerHTML = `<strong>Room ${String(i+1).padStart(2,'0')}</strong><div>${c} occupied / ${counts.totalDays} days</div>`;
    availabilityDiv.appendChild(card);
  }
  // overall totals
  const freeTotal = counts.totalDays * 6 - counts.perRoom.reduce((a,b)=>a+b,0);
  const overall = document.createElement('div');
  overall.className = 'avail-card';
  overall.innerHTML = `<strong>Overall</strong><div>Free slots this month: <span class="${freeTotal>0?'avail-ok':''}">${freeTotal}</span></div>`;
  availabilityDiv.appendChild(overall);
}

function openModalEdit(month, date) {
  const rooms = dataMap[month][date] || ['', '', '', '', '', ''];
  modalTitle.textContent = `Edit allotments — ${month} ${date}`;
  modalRooms.innerHTML = '';
  rooms.forEach((r, idx) => {
    const div = document.createElement('div');
    div.className = 'room-edit';
    const label = document.createElement('label');
    label.textContent = `Room ${String(idx+1).padStart(2,'0')}`;
    label.style.minWidth = '90px';
    const input = document.createElement('input');
    input.value = r || '';
    input.dataset.roomIdx = idx;
    input.placeholder = 'Guest name (leave empty to free)';
    div.appendChild(label);
    div.appendChild(input);
    modalRooms.appendChild(div);
  });
  modal.dataset.month = month;
  modal.dataset.date = date;
  modal.classList.remove('hidden');
  modal.querySelector('input')?.focus();
}

modalClose.addEventListener('click', () => closeModal());
modalCancel.addEventListener('click', () => closeModal());
modalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const month = modal.dataset.month;
  const date = modal.dataset.date;
  const inputs = modalForm.querySelectorAll('input[data-room-idx]');
  const newRooms = [];
  inputs.forEach(inp => { newRooms.push(inp.value.trim()); });
  // Save back to dataMap and rerender calendar/availability
  dataMap[month][date] = newRooms;
  renderCalendar(month);
  renderAvailability(month);
  closeModal();
});

function closeModal() {
  modal.classList.add('hidden');
}

// export CSV from current dataMap (builds a flattened CSV with Month and Date)
exportBtn.addEventListener('click', () => {
  if (!dataMap || Object.keys(dataMap).length === 0) { alert('No data to export. Build first.'); return; }
  // build rows: header and then month/date/rooms
  const outRows = [];
  const header = [];
  header.push('Months', 'Date');
  for (let r=1;r<=6;r++) header.push(`Room ${String(r).padStart(2,'0')}`);
  outRows.push(header);
  // keep month order as in monthSelect
  const months = Array.from(monthSelect.options).map(o => o.value);
  months.forEach(m => {
    const days = dataMap[m] || {};
    const dayKeys = Object.keys(days).sort((a,b)=> {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na-nb;
      return a.localeCompare(b);
    });
    // For each day, first row may include month label; subsequent day rows keep month blank (like original)
    let first = true;
    dayKeys.forEach(dk => {
      const rooms = days[dk] || ['', '', '', '', '', ''];
      const row = [];
      row.push(first ? m : '');
      row.push(dk);
      rooms.forEach(x => row.push(x || ''));
      outRows.push(row);
      first = false;
    });
  });
  const csv = outRows.map(r => r.map(cell => {
    if (cell === null || cell === undefined) cell = '';
    if (cell.toString().includes(',') || cell.toString().includes('"') || cell.toString().includes('\n')) {
      return `"${cell.toString().replace(/"/g,'""')}"`;
    }
    return cell;
  }).join(',')).join('\n');
  // download
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'esic_guesthouse_export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// small helper
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* If user loads the big CSV content from the original message, they can paste it here and parse. 
   This script is intentionally robust to let you pick the columns because the provided CSV is irregular.
*/

/* Optional: auto-parse if csvText is pre-populated by server (not used here). */
