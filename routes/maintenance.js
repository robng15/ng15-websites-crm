const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const TASK_DEFS = {
  'Package 1': [
    { key: 'updraft_backup', label: 'Monthly manual Updraft Backup', kind: 'backup' },
  ],
  'Package 2': [
    { key: 's3_backup',  label: 'S3 Updraft Backup (Auto)', kind: 'backup' },
    { key: 'wp_core',    label: 'WP Core', kind: 'check' },
    { key: 'wp_plugins', label: 'WP Plugins', kind: 'check' },
    { key: 'wp_themes',  label: 'WP Themes', kind: 'check' },
  ],
  'Package 3': [
    { key: 's3_backup',    label: 'S3 Updraft Backup (Auto)', kind: 'backup' },
    { key: 'wp_core',      label: 'WP Core', kind: 'check' },
    { key: 'wp_plugins',   label: 'WP Plugins', kind: 'check' },
    { key: 'wp_themes',    label: 'WP Themes', kind: 'check' },
    { key: 'plesk_backup', label: 'Plesk Server Backup (Auto)', kind: 'backup' },
    { key: 'staging_sync', label: 'Staging Site updated from live', kind: 'check' },
  ],
};

const TIERS = ['Just Hosting', 'Package 1', 'Package 2', 'Package 3'];

function tasksFor(level) {
  return TASK_DEFS[level] || [];
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// GET dashboard summary for a period, grouped by tier + client company
router.get('/dashboard', (req, res) => {
  const period = req.query.period || currentPeriod();
  const sites = db.prepare(`
    SELECT * FROM sites
    WHERE maintenance_level IS NOT NULL AND maintenance_level != ''
    ORDER BY client_company_name
  `).all();
  const logs = db.prepare('SELECT * FROM maintenance_logs WHERE period = ?').all(period);
  const logMap = new Map(logs.map(l => [`${l.site_id}:${l.task_type}`, l]));

  const byTierClient = {};
  for (const site of sites) {
    const tier = site.maintenance_level;
    if (!TIERS.includes(tier)) continue;
    if (!byTierClient[tier]) byTierClient[tier] = {};
    const company = site.client_company_name || '(no name)';
    if (!byTierClient[tier][company]) byTierClient[tier][company] = [];
    byTierClient[tier][company].push(site);
  }

  const groups = {};
  for (const tier of TIERS) {
    const clients = byTierClient[tier] || {};
    const tasks = tasksFor(tier);
    groups[tier] = Object.entries(clients).map(([company, tierSites]) => {
      let total = 0, done = 0;
      for (const site of tierSites) {
        for (const t of tasks) {
          total++;
          const log = logMap.get(`${site.id}:${t.key}`);
          if (log && log.completed) done++;
        }
      }
      return { company, siteIds: tierSites.map(s => s.id), total, done };
    });
  }

  res.json({ period, groups });
});

// GET a client's sites + this period's logs/support hours
router.get('/client', (req, res) => {
  const { company, period } = req.query;
  if (!company) return res.status(400).json({ error: 'company is required' });
  const p = period || currentPeriod();

  const sites = db.prepare(`
    SELECT * FROM sites
    WHERE client_company_name = ? AND maintenance_level IS NOT NULL AND maintenance_level != ''
    ORDER BY id
  `).all(company);
  if (sites.length === 0) return res.status(404).json({ error: 'Not found' });

  const siteIds = sites.map(s => s.id);
  const placeholders = siteIds.map(() => '?').join(',');
  const logs = db.prepare(`SELECT * FROM maintenance_logs WHERE period = ? AND site_id IN (${placeholders})`).all(p, ...siteIds);
  const hours = db.prepare(`SELECT * FROM support_hours WHERE period = ? AND site_id IN (${placeholders})`).all(p, ...siteIds);

  const data = sites.map(site => ({
    ...site,
    tasks: tasksFor(site.maintenance_level),
    logs: logs.filter(l => l.site_id === site.id),
    support_hours: hours.find(h => h.site_id === site.id) || null,
  }));

  res.json({ company, period: p, sites: data });
});

// PUT upsert a task completion log entry
router.put('/logs', (req, res) => {
  const { site_id, period, task_type, completed, backup_destination, notes } = req.body;
  if (!site_id || !period || !task_type) {
    return res.status(400).json({ error: 'site_id, period and task_type are required' });
  }

  db.prepare(`
    INSERT INTO maintenance_logs (site_id, period, task_type, completed, completed_at, backup_destination, notes)
    VALUES (@site_id, @period, @task_type, @completed, @completed_at, @backup_destination, @notes)
    ON CONFLICT(site_id, period, task_type) DO UPDATE SET
      completed = excluded.completed,
      completed_at = excluded.completed_at,
      backup_destination = excluded.backup_destination,
      notes = excluded.notes
  `).run({
    site_id,
    period,
    task_type,
    completed: completed ? 1 : 0,
    completed_at: completed ? (req.body.completed_at || new Date().toISOString()) : null,
    backup_destination: backup_destination || '',
    notes: notes || '',
  });

  res.json({ ok: true });
});

// PUT update staging fields on the site record (shared with the main site form)
router.put('/staging/:site_id', (req, res) => {
  const { staging_url, staging_server, staging_snapshot_date } = req.body;
  db.prepare(`
    UPDATE sites SET
      staging_url = @staging_url,
      staging_server = @staging_server,
      staging_snapshot_date = @staging_snapshot_date,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: req.params.site_id,
    staging_url: staging_url || '',
    staging_server: staging_server || '',
    staging_snapshot_date: staging_snapshot_date || null,
  });
  res.json({ ok: true });
});

// PUT upsert support hours used for a period (Package 3 only)
router.put('/support-hours', (req, res) => {
  const { site_id, period, hours_used, notes } = req.body;
  if (!site_id || !period) return res.status(400).json({ error: 'site_id and period are required' });

  db.prepare(`
    INSERT INTO support_hours (site_id, period, hours_used, notes)
    VALUES (@site_id, @period, @hours_used, @notes)
    ON CONFLICT(site_id, period) DO UPDATE SET
      hours_used = excluded.hours_used,
      notes = excluded.notes
  `).run({
    site_id,
    period,
    hours_used: hours_used || 0,
    notes: notes || '',
  });

  res.json({ ok: true });
});

module.exports = router;
