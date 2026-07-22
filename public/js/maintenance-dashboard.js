requireAuth();

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ng15_token');
  location.href = '/login.html';
});

const TIER_LABELS = {
  'Just Hosting': 'Just Hosting',
  'Package 1': 'Package 1 — Standard',
  'Package 2': 'Package 2 — Managed',
  'Package 3': 'Package 3 — Bespoke',
};

const periodPicker = document.getElementById('period-picker');
const tierGroupsEl = document.getElementById('tier-groups');

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

periodPicker.value = currentPeriod();
periodPicker.addEventListener('change', () => loadDashboard());

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadDashboard() {
  const period = periodPicker.value || currentPeriod();
  try {
    const { groups } = await API.get(`/maintenance/dashboard?period=${period}`);
    render(groups, period);
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

function render(groups, period) {
  tierGroupsEl.innerHTML = Object.entries(TIER_LABELS).map(([tier, label]) => {
    const clients = groups[tier] || [];
    const isHosting = tier === 'Just Hosting';

    const rows = clients.length === 0
      ? `<div class="tier-empty">No sites on this level.</div>`
      : clients.map(c => {
          if (isHosting) {
            return `
              <div class="tier-client-row">
                <span class="tier-client-name">${escHtml(c.company)}</span>
                <span class="job-count na">n/a</span>
              </div>`;
          }
          const allDone = c.total > 0 && c.done === c.total;
          const countCls = allDone ? 'all-done' : 'pending';
          return `
            <div class="tier-client-row is-link" data-company="${escHtml(c.company)}">
              <span class="tier-client-name">${escHtml(c.company)}</span>
              <span class="job-count ${countCls}">${c.done}/${c.total}</span>
            </div>`;
        }).join('');

    return `
      <section class="tier-group">
        <div class="tier-header">${escHtml(label)}</div>
        <div class="tier-clients">${rows}</div>
      </section>`;
  }).join('');

  tierGroupsEl.querySelectorAll('.tier-client-row.is-link').forEach(row => {
    row.addEventListener('click', () => {
      const company = row.dataset.company;
      location.href = `/maintenance-client.html?company=${encodeURIComponent(company)}&period=${period}`;
    });
  });
}

function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('alert');
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.hidden = false;
}

loadDashboard();
