requireAuth();

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ng15_token');
  location.href = '/login.html';
});

const params  = new URLSearchParams(location.search);
const company = params.get('company');
const period  = params.get('period') || currentPeriod();

const TIER_LABELS = {
  'Package 1': 'Package 1 — Standard',
  'Package 2': 'Package 2 — Managed',
  'Package 3': 'Package 3 — Bespoke',
};

const SUPPORT_HOURS_ALLOWANCE = 3;

let siteData = [];

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function load() {
  if (!company) { showAlert('No client specified.', 'error'); return; }
  try {
    const data = await API.get(`/maintenance/client?company=${encodeURIComponent(company)}&period=${period}`);
    siteData = data.sites;
    document.getElementById('client-name').textContent = data.company;
    document.getElementById('period-label').textContent = formatPeriod(period);
    render();
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

function formatPeriod(p) {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function findLog(site, taskType) {
  return site.logs.find(l => l.task_type === taskType) || {};
}

function taskRow(site, task) {
  const log = findLog(site, task.key);
  const checked = log.completed ? 'checked' : '';

  if (task.kind === 'backup') {
    return `
      <div class="task-row" data-site="${site.id}" data-task="${task.key}" data-kind="backup">
        <label class="task-check">
          <input type="checkbox" class="task-completed" ${checked}>
          ${escHtml(task.label)}
        </label>
        <div class="task-detail-box">
          <div class="field-group">
            <label>Backup date/time</label>
            <input type="datetime-local" class="task-completed-at" value="${toDatetimeLocal(log.completed_at)}">
          </div>
          <div class="field-group">
            <label>Backup destination</label>
            <input type="text" class="task-destination" value="${escHtml(log.backup_destination)}" placeholder="e.g. Google Drive, Amazon S3">
          </div>
          <div class="field-group field-group--full">
            <label>Notes</label>
            <input type="text" class="task-notes" value="${escHtml(log.notes)}">
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="task-row" data-site="${site.id}" data-task="${task.key}" data-kind="check">
      <label class="task-check">
        <input type="checkbox" class="task-completed" ${checked}>
        ${escHtml(task.label)}
      </label>
      <div class="task-detail-box" style="grid-template-columns: 1fr;">
        <div class="field-group field-group--full">
          <label>Notes</label>
          <input type="text" class="task-notes" value="${escHtml(log.notes)}">
        </div>
      </div>
    </div>`;
}

function stagingBox(site) {
  const tier = site.maintenance_level;
  if (tier !== 'Package 2' && tier !== 'Package 3') return '';

  const syncLog = tier === 'Package 3' ? findLog(site, 'staging_sync') : null;
  const syncRow = tier === 'Package 3' ? `
    <label class="task-check" style="margin-top:12px;">
      <input type="checkbox" class="staging-sync-completed" data-site="${site.id}" ${syncLog.completed ? 'checked' : ''}>
      Staging Site updated from live
    </label>` : '';

  return `
    <div class="task-row staging-box" data-site="${site.id}">
      <div class="client-site-tier" style="margin-bottom:8px; font-weight:600; color:var(--text);">Staging Site Details</div>
      <div class="task-detail-box" style="background:transparent; border:none; padding:0; margin-left:0;">
        <div class="field-group">
          <label>Staging URL</label>
          <input type="text" class="staging-url" value="${escHtml(site.staging_url)}" placeholder="example.ng15staging.uk">
        </div>
        <div class="field-group">
          <label>Staging Server</label>
          <input type="text" class="staging-server" value="${escHtml(site.staging_server)}">
        </div>
        <div class="field-group">
          <label>Date of staging site version</label>
          <input type="date" class="staging-snapshot-date" value="${escHtml(site.staging_snapshot_date)}">
        </div>
      </div>
      ${syncRow}
    </div>`;
}

function supportHoursBox(site) {
  if (site.maintenance_level !== 'Package 3') return '';
  const used = site.support_hours ? site.support_hours.hours_used : 0;
  const notes = site.support_hours ? site.support_hours.notes : '';
  const remaining = Math.max(0, SUPPORT_HOURS_ALLOWANCE - (used || 0));

  return `
    <div class="task-row support-hours-row" data-site="${site.id}">
      <div class="client-site-tier" style="margin-bottom:8px; font-weight:600; color:var(--text);">Support Time (${SUPPORT_HOURS_ALLOWANCE}hrs/month allowance)</div>
      <div class="support-hours-box">
        <div class="field-group">
          <label>Hours used</label>
          <input type="number" class="support-hours-used" min="0" max="${SUPPORT_HOURS_ALLOWANCE}" step="0.25" value="${used || 0}">
        </div>
        <div class="support-hours-remaining">${remaining.toFixed(2)}hrs remaining</div>
        <div class="field-group" style="flex:1; max-width:none;">
          <label>Notes</label>
          <input type="text" class="support-hours-notes" value="${escHtml(notes)}" placeholder="What the support time was used for…">
        </div>
      </div>
    </div>`;
}

function render() {
  const container = document.getElementById('site-cards');
  container.innerHTML = siteData.map((site, i) => {
    const tasks = site.tasks.filter(t => t.key !== 'staging_sync');
    return `
      <div class="client-site-card">
        <div class="client-site-title">Site ${i + 1}${site.site_url ? ` — ${escHtml(site.site_url)}` : ''}</div>
        <div class="client-site-tier">${escHtml(TIER_LABELS[site.maintenance_level] || site.maintenance_level)} · ${escHtml(site.ref_no)}</div>
        ${tasks.map(t => taskRow(site, t)).join('')}
        ${stagingBox(site)}
        ${supportHoursBox(site)}
      </div>`;
  }).join('');

  attachHandlers();
}

function siteById(id) {
  return siteData.find(s => s.id == id);
}

function attachHandlers() {
  document.querySelectorAll('.task-row[data-task]').forEach(row => {
    const siteId = row.dataset.site;
    const taskType = row.dataset.task;

    const save = () => saveTaskLog(row, siteId, taskType);

    row.querySelector('.task-completed').addEventListener('change', save);
    const at = row.querySelector('.task-completed-at');
    if (at) at.addEventListener('change', save);
    const dest = row.querySelector('.task-destination');
    if (dest) dest.addEventListener('blur', save);
    row.querySelector('.task-notes').addEventListener('blur', save);
  });

  document.querySelectorAll('.staging-box').forEach(box => {
    const siteId = box.dataset.site;
    const save = () => saveStaging(box, siteId);
    box.querySelector('.staging-url').addEventListener('blur', save);
    box.querySelector('.staging-server').addEventListener('blur', save);
    box.querySelector('.staging-snapshot-date').addEventListener('change', save);

    const syncCb = box.querySelector('.staging-sync-completed');
    if (syncCb) {
      syncCb.addEventListener('change', () => {
        saveLog(siteId, 'staging_sync', { completed: syncCb.checked });
      });
    }
  });

  document.querySelectorAll('.support-hours-row').forEach(row => {
    const siteId = row.dataset.site;
    const save = () => saveSupportHours(row, siteId);
    row.querySelector('.support-hours-used').addEventListener('blur', save);
    row.querySelector('.support-hours-notes').addEventListener('blur', save);
  });
}

async function saveTaskLog(row, siteId, taskType) {
  const completed = row.querySelector('.task-completed').checked;
  const at = row.querySelector('.task-completed-at');
  const dest = row.querySelector('.task-destination');
  const notes = row.querySelector('.task-notes').value;

  const payload = { completed, notes };
  if (dest) payload.backup_destination = dest.value;
  if (at && at.value) payload.completed_at = new Date(at.value).toISOString();

  await saveLog(siteId, taskType, payload);

  // Reflect server-assigned completed_at when a task is freshly checked without one set
  if (completed && at && !at.value) {
    at.value = toDatetimeLocal(new Date().toISOString());
  }
}

async function saveLog(siteId, taskType, payload) {
  try {
    await API.put('/maintenance/logs', { site_id: Number(siteId), period, task_type: taskType, ...payload });
    showAlert('Saved.', 'success');
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

async function saveStaging(box, siteId) {
  const staging_url = box.querySelector('.staging-url').value.trim();
  const staging_server = box.querySelector('.staging-server').value.trim();
  const staging_snapshot_date = box.querySelector('.staging-snapshot-date').value || null;

  try {
    await API.put(`/maintenance/staging/${siteId}`, { staging_url, staging_server, staging_snapshot_date });
    const site = siteById(siteId);
    if (site) Object.assign(site, { staging_url, staging_server, staging_snapshot_date });
    showAlert('Saved.', 'success');
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

async function saveSupportHours(row, siteId) {
  const hours_used = parseFloat(row.querySelector('.support-hours-used').value) || 0;
  const notes = row.querySelector('.support-hours-notes').value;

  try {
    await API.put('/maintenance/support-hours', { site_id: Number(siteId), period, hours_used, notes });
    const site = siteById(siteId);
    if (site) site.support_hours = { hours_used, notes };
    row.querySelector('.support-hours-remaining').textContent =
      `${Math.max(0, SUPPORT_HOURS_ALLOWANCE - hours_used).toFixed(2)}hrs remaining`;
    showAlert('Saved.', 'success');
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('alert');
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.hidden = false;
  clearTimeout(showAlert._t);
  showAlert._t = setTimeout(() => { alertEl.hidden = true; }, 2500);
}

load();
