requireAuth();

let allSites = [];
let deleteTargetId = null;

const tbody      = document.getElementById('sites-tbody');
const noResults  = document.getElementById('no-results');
const noText     = document.getElementById('no-results-text');
const siteCount  = document.getElementById('site-count');
const alertEl    = document.getElementById('alert');
const overlay    = document.getElementById('modal-overlay');

// ── Auth ──────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ng15_token');
  location.href = '/login.html';
});

// ── Load sites ────────────────────────────────────────────────────────────
async function loadSites() {
  try {
    allSites = await API.get('/sites');
    renderTable(allSites);
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

// ── Render ────────────────────────────────────────────────────────────────
function statusBadge(status) {
  if (!status) return '';
  const cls = status === 'Complete & Live' ? 'badge-live'
            : status === 'In Development'  ? 'badge-dev' : 'badge-other';
  return `<span class="badge ${cls}">${escHtml(status)}</span>`;
}

function logoCell(logo, name) {
  if (logo) {
    return `<img class="logo-thumb" src="${escHtml(logo)}" alt="${escHtml(name)}">`;
  }
  const initials = (name || '?').slice(0, 2).toUpperCase();
  return `<div class="logo-placeholder">${initials}</div>`;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatShortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTable(sites) {
  siteCount.textContent = `${allSites.length} site${allSites.length !== 1 ? 's' : ''}`;

  if (sites.length === 0) {
    tbody.innerHTML = '';
    noResults.hidden = false;
    noText.textContent = allSites.length === 0
      ? 'No sites yet. Click "Add Site" to get started.'
      : 'No sites match your search.';
    return;
  }

  noResults.hidden = true;
  tbody.innerHTML = sites.map(s => `
    <tr>
      <td class="ref-no">${escHtml(s.ref_no)}</td>
      <td>${logoCell(s.logo, s.client_company_name)}</td>
      <td class="site-name">${escHtml(s.client_company_name)}</td>
      <td class="site-url">${s.site_url ? `<a href="https://${s.site_url.replace(/^https?:\/\//,'')}" target="_blank" rel="noopener">${escHtml(s.site_url)}</a>` : ''}</td>
      <td>${statusBadge(s.site_status)}</td>
      <td>${escHtml(s.live_server)}</td>
      <td>${escHtml(s.site_type)}</td>
      <td>${escHtml(s.site_build)}</td>
      <td class="date-cell">${formatShortDate(s.website_live_date)}</td>
      <td>
        <div class="row-actions">
          <a href="/site.html?id=${s.id}" class="btn btn-ghost">Edit</a>
          <button class="btn btn-danger" data-delete="${s.id}" data-name="${escHtml(s.client_company_name)}">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Search & Filter ───────────────────────────────────────────────────────
function applyFilters() {
  const q       = document.getElementById('search').value.trim().toLowerCase();
  const status  = document.getElementById('filter-status').value;
  const server  = document.getElementById('filter-server').value;
  const type    = document.getElementById('filter-type').value;

  const filtered = allSites.filter(s => {
    const matchQ = !q || [s.ref_no, s.client_company_name, s.site_url, s.site_type, s.live_server, s.notes]
      .some(v => String(v ?? '').toLowerCase().includes(q));
    const matchStatus = !status || s.site_status === status;
    const matchServer = !server || s.live_server === server;
    const matchType   = !type   || s.site_type === type;
    return matchQ && matchStatus && matchServer && matchType;
  });

  renderTable(filtered);
}

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('filter-status').addEventListener('change', applyFilters);
document.getElementById('filter-server').addEventListener('change', applyFilters);
document.getElementById('filter-type').addEventListener('change', applyFilters);

// ── Delete ────────────────────────────────────────────────────────────────
tbody.addEventListener('click', e => {
  const btn = e.target.closest('[data-delete]');
  if (!btn) return;
  deleteTargetId = btn.dataset.delete;
  document.getElementById('modal-text').textContent =
    `Delete "${btn.dataset.name}" (${btn.closest('tr').querySelector('.ref-no').textContent})? This cannot be undone.`;
  overlay.hidden = false;
});

document.getElementById('modal-cancel').addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.hidden = true; });

document.getElementById('modal-confirm').addEventListener('click', async () => {
  overlay.hidden = true;
  try {
    await API.delete(`/sites/${deleteTargetId}`);
    allSites = allSites.filter(s => s.id != deleteTargetId);
    applyFilters();
    showAlert('Site deleted.', 'success');
  } catch (err) {
    showAlert(err.message, 'error');
  }
});

// ── Export CSV ────────────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', async () => {
  const res = await API.get('/sites/export/csv');
  if (!res) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ng15-websites-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Import CSV ────────────────────────────────────────────────────────────
document.getElementById('csv-import').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async ({ data }) => {
      if (!data.length) { showAlert('CSV is empty.', 'error'); return; }
      try {
        const result = await API.post('/sites/import/csv', { rows: data });
        showAlert(`Imported ${result.imported} site(s) successfully.`, 'success');
        await loadSites();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    },
    error: err => showAlert('Failed to parse CSV: ' + err.message, 'error'),
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────
function showAlert(msg, type = 'info') {
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.hidden = false;
  setTimeout(() => { alertEl.hidden = true; }, 5000);
}

loadSites();
