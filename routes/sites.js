const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const COLUMNS = [
  'ref_no', 'client_company_name', 'logo', 'site_url', 'contact_names', 'contact_emails',
  'live_server', 'live_server_notes', 'site_status', 'site_status_notes',
  'site_type', 'site_type_notes', 'data_type', 'staging_url', 'staging_server',
  'dns_location', 'dns_details', 'dns_details_notes', 'site_build',
  'plugins', 'plugins_other', 'other_site_config', 'notes', 'created_at', 'updated_at'
];

function nextRefNo() {
  const row = db.prepare('SELECT ref_no FROM sites ORDER BY id DESC LIMIT 1').get();
  if (!row) return 'NG-001';
  const n = parseInt(row.ref_no.replace('NG-', ''), 10);
  return `NG-${String(n + 1).padStart(3, '0')}`;
}

function parseSite(site) {
  if (site && typeof site.plugins === 'string') {
    try { site.plugins = JSON.parse(site.plugins); } catch { site.plugins = []; }
  }
  return site;
}

function siteParams(d, ref_no) {
  return {
    ref_no: ref_no ?? d.ref_no ?? '',
    client_company_name: d.client_company_name || '',
    logo: d.logo || '',
    site_url: d.site_url || '',
    contact_names: d.contact_names || '',
    contact_emails: d.contact_emails || '',
    live_server: d.live_server || '',
    live_server_notes: d.live_server_notes || '',
    site_status: d.site_status || '',
    site_status_notes: d.site_status_notes || '',
    site_type: d.site_type || '',
    site_type_notes: d.site_type_notes || '',
    data_type: d.data_type || '',
    staging_url: d.staging_url || '',
    staging_server: d.staging_server || '',
    dns_location: d.dns_location || '',
    dns_details: d.dns_details || '',
    dns_details_notes: d.dns_details_notes || '',
    site_build: d.site_build || '',
    plugins: JSON.stringify(Array.isArray(d.plugins) ? d.plugins : []),
    plugins_other: d.plugins_other || '',
    other_site_config: d.other_site_config || '',
    notes: d.notes || '',
  };
}

// GET all — must be before /:id
router.get('/', (req, res) => {
  const sites = db.prepare('SELECT * FROM sites ORDER BY id DESC').all();
  res.json(sites.map(parseSite));
});

// GET export CSV — must be before /:id
router.get('/export/csv', (req, res) => {
  const sites = db.prepare('SELECT * FROM sites ORDER BY ref_no').all();

  const escape = v => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [COLUMNS.join(',')];
  for (const site of sites) {
    lines.push(COLUMNS.map(c => escape(site[c])).join(','));
  }

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ng15-websites-${date}.csv"`);
  res.send('\uFEFF' + lines.join('\r\n'));
});

// POST import CSV
router.post('/import/csv', (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided' });
  }

  const insert = db.prepare(`
    INSERT OR REPLACE INTO sites (
      ref_no, client_company_name, logo, site_url, contact_names, contact_emails,
      live_server, live_server_notes, site_status, site_status_notes,
      site_type, site_type_notes, data_type, staging_url, staging_server,
      dns_location, dns_details, dns_details_notes, site_build,
      plugins, plugins_other, other_site_config, notes
    ) VALUES (
      @ref_no, @client_company_name, @logo, @site_url, @contact_names, @contact_emails,
      @live_server, @live_server_notes, @site_status, @site_status_notes,
      @site_type, @site_type_notes, @data_type, @staging_url, @staging_server,
      @dns_location, @dns_details, @dns_details_notes, @site_build,
      @plugins, @plugins_other, @other_site_config, @notes
    )
  `);

  const importAll = db.transaction(rows => {
    for (const row of rows) insert.run(siteParams(row));
  });

  importAll(rows);
  res.json({ imported: rows.length });
});

// GET single
router.get('/:id', (req, res) => {
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Not found' });
  res.json(parseSite(site));
});

// POST create
router.post('/', (req, res) => {
  const ref_no = nextRefNo();
  const result = db.prepare(`
    INSERT INTO sites (
      ref_no, client_company_name, logo, site_url, contact_names, contact_emails,
      live_server, live_server_notes, site_status, site_status_notes,
      site_type, site_type_notes, data_type, staging_url, staging_server,
      dns_location, dns_details, dns_details_notes, site_build,
      plugins, plugins_other, other_site_config, notes
    ) VALUES (
      @ref_no, @client_company_name, @logo, @site_url, @contact_names, @contact_emails,
      @live_server, @live_server_notes, @site_status, @site_status_notes,
      @site_type, @site_type_notes, @data_type, @staging_url, @staging_server,
      @dns_location, @dns_details, @dns_details_notes, @site_build,
      @plugins, @plugins_other, @other_site_config, @notes
    )
  `).run(siteParams(req.body, ref_no));

  res.json({ id: result.lastInsertRowid, ref_no });
});

// PUT update
router.put('/:id', (req, res) => {
  const p = siteParams(req.body);
  db.prepare(`
    UPDATE sites SET
      client_company_name = @client_company_name,
      logo = @logo,
      site_url = @site_url,
      contact_names = @contact_names,
      contact_emails = @contact_emails,
      live_server = @live_server,
      live_server_notes = @live_server_notes,
      site_status = @site_status,
      site_status_notes = @site_status_notes,
      site_type = @site_type,
      site_type_notes = @site_type_notes,
      data_type = @data_type,
      staging_url = @staging_url,
      staging_server = @staging_server,
      dns_location = @dns_location,
      dns_details = @dns_details,
      dns_details_notes = @dns_details_notes,
      site_build = @site_build,
      plugins = @plugins,
      plugins_other = @plugins_other,
      other_site_config = @other_site_config,
      notes = @notes,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...p, id: req.params.id });

  res.json({ ok: true });
});

// DELETE
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
