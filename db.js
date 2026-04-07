const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_no TEXT UNIQUE NOT NULL,
    client_company_name TEXT,
    logo TEXT,
    site_url TEXT,
    contact_names TEXT,
    contact_emails TEXT,
    live_server TEXT,
    live_server_notes TEXT,
    site_status TEXT,
    site_status_notes TEXT,
    site_type TEXT,
    site_type_notes TEXT,
    data_type TEXT,
    staging_url TEXT,
    staging_server TEXT,
    dns_location TEXT,
    dns_details TEXT,
    dns_details_notes TEXT,
    site_build TEXT,
    plugins TEXT,
    plugins_other TEXT,
    other_site_config TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

module.exports = db;
