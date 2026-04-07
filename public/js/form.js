requireAuth();

const params = new URLSearchParams(location.search);
const siteId = params.get('id');
const isEdit = !!siteId;

document.getElementById('page-title').textContent = isEdit ? 'Edit Site' : 'Add Site';
document.getElementById('submit-btn').textContent = isEdit ? 'Save Changes' : 'Save Site';

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ng15_token');
  location.href = '/login.html';
});

// ── Radio "Other" notes toggles ───────────────────────────────────────────
const radioNotes = {
  live_server:  'live_server_notes',
  site_status:  'site_status_notes',
  site_type:    'site_type_notes',
  dns_details:  'dns_details_notes',
  site_build:   'site_build_notes',
};

Object.entries(radioNotes).forEach(([radioName, notesId]) => {
  document.querySelectorAll(`[name="${radioName}"]`).forEach(radio => {
    radio.addEventListener('change', () => toggleNotes(radioName, notesId));
  });
});

function toggleNotes(radioName, notesId) {
  const selected = document.querySelector(`[name="${radioName}"]:checked`);
  const notesEl = document.getElementById(notesId);
  const showOther = selected && (selected.value === 'Other' || selected.value === 'external contact');
  notesEl.hidden = !showOther;
  if (!showOther) notesEl.value = '';
}

// ── Plugins "Other" toggle ────────────────────────────────────────────────
document.getElementById('plugins-other-check').addEventListener('change', e => {
  const notesEl = document.getElementById('plugins_other');
  notesEl.hidden = !e.target.checked;
  if (!e.target.checked) notesEl.value = '';
});

// ── Logo upload ───────────────────────────────────────────────────────────
const logoFile   = document.getElementById('logo-file');
const logoInput  = document.getElementById('logo');
const logoPreview = document.getElementById('logo-preview');
const logoImg    = document.getElementById('logo-img');
const logoStatus = document.getElementById('logo-upload-status');
const logoLabel  = document.getElementById('logo-label');

logoFile.addEventListener('change', async () => {
  const file = logoFile.files[0];
  if (!file) return;

  logoStatus.textContent = 'Uploading…';
  logoLabel.style.pointerEvents = 'none';

  try {
    const result = await API.uploadLogo(file);
    logoInput.value = result.path;
    logoImg.src = result.path;
    logoPreview.hidden = false;
    logoLabel.querySelector('svg + text, svg ~ *:not(input)');
    logoStatus.textContent = '';
  } catch (err) {
    logoStatus.textContent = 'Upload failed: ' + err.message;
  } finally {
    logoLabel.style.pointerEvents = '';
    logoFile.value = '';
  }
});

document.getElementById('logo-remove').addEventListener('click', () => {
  logoInput.value = '';
  logoImg.src = '';
  logoPreview.hidden = true;
});

// ── Populate form (edit mode) ─────────────────────────────────────────────
async function loadSite() {
  try {
    const site = await API.get(`/sites/${siteId}`);

    document.getElementById('ref_no').value = site.ref_no;
    document.getElementById('client_company_name').value = site.client_company_name || '';
    document.getElementById('site_url').value = site.site_url || '';
    document.getElementById('contact_names').value = site.contact_names || '';
    document.getElementById('contact_emails').value = site.contact_emails || '';
    document.getElementById('staging_url').value = site.staging_url || '';
    document.getElementById('other_site_config').value = site.other_site_config || '';
    document.getElementById('notes').value = site.notes || '';
    document.getElementById('site_build_notes').value = site.site_build_notes || '';
    document.getElementById('project_start_date').value = site.project_start_date || '';
    document.getElementById('website_live_date').value = site.website_live_date || '';
    document.getElementById('created_at').value = site.created_at ? formatDate(site.created_at) : '';
    document.getElementById('updated_at').value = site.updated_at ? formatDate(site.updated_at) : '';

    // Logo
    if (site.logo) {
      logoInput.value = site.logo;
      logoImg.src = site.logo;
      logoPreview.hidden = false;
    }

    // Radio fields
    const radios = ['live_server', 'site_status', 'site_type', 'data_type', 'staging_server', 'dns_location', 'dns_details', 'site_build'];
    radios.forEach(name => {
      const el = document.querySelector(`[name="${name}"][value="${CSS.escape(site[name] || '')}"]`);
      if (el) el.checked = true;
    });

    // Show notes fields if "Other" / "external contact" selected
    Object.entries(radioNotes).forEach(([radioName, notesId]) => {
      const notesEl = document.getElementById(notesId);
      const val = site[notesId] || '';
      if (val) {
        notesEl.value = val;
        notesEl.hidden = false;
      }
    });

    // Plugins checkboxes
    const plugins = Array.isArray(site.plugins) ? site.plugins : [];
    plugins.forEach(p => {
      if (p === 'Other') {
        document.getElementById('plugins-other-check').checked = true;
        const otherField = document.getElementById('plugins_other');
        otherField.value = site.plugins_other || '';
        otherField.hidden = false;
      } else {
        const cb = document.querySelector(`[name="plugins"][value="${CSS.escape(p)}"]`);
        if (cb) cb.checked = true;
      }
    });

    // If plugins_other has value but "Other" wasn't in plugins array
    if (site.plugins_other && !plugins.includes('Other')) {
      document.getElementById('plugins-other-check').checked = true;
      const otherField = document.getElementById('plugins_other');
      otherField.value = site.plugins_other;
      otherField.hidden = false;
    }

  } catch (err) {
    showAlert(err.message, 'error');
  }
}

// ── Form submit ───────────────────────────────────────────────────────────
document.getElementById('site-form').addEventListener('submit', async e => {
  e.preventDefault();

  const companyName = document.getElementById('client_company_name').value.trim();
  if (!companyName) {
    showAlert('Client company name is required.', 'error');
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  // Collect plugins
  const plugins = [...document.querySelectorAll('[name="plugins"]:checked')].map(cb => cb.value);
  const pluginsOtherChecked = document.getElementById('plugins-other-check').checked;
  if (pluginsOtherChecked && !plugins.includes('Other')) plugins.push('Other');

  const data = {
    client_company_name: companyName,
    logo:               document.getElementById('logo').value,
    site_url:           document.getElementById('site_url').value.trim(),
    contact_names:      document.getElementById('contact_names').value.trim(),
    contact_emails:     document.getElementById('contact_emails').value.trim(),
    live_server:        getRadio('live_server'),
    live_server_notes:  document.getElementById('live_server_notes').hidden ? '' : document.getElementById('live_server_notes').value,
    site_status:        getRadio('site_status'),
    site_status_notes:  document.getElementById('site_status_notes').hidden ? '' : document.getElementById('site_status_notes').value,
    site_type:          getRadio('site_type'),
    site_type_notes:    document.getElementById('site_type_notes').hidden ? '' : document.getElementById('site_type_notes').value,
    data_type:          getRadio('data_type'),
    staging_url:        document.getElementById('staging_url').value.trim(),
    staging_server:     getRadio('staging_server'),
    dns_location:       getRadio('dns_location'),
    dns_details:        getRadio('dns_details'),
    dns_details_notes:  document.getElementById('dns_details_notes').hidden ? '' : document.getElementById('dns_details_notes').value,
    site_build:         getRadio('site_build'),
    site_build_notes:   document.getElementById('site_build_notes').hidden ? '' : document.getElementById('site_build_notes').value,
    plugins,
    plugins_other:      document.getElementById('plugins_other').hidden ? '' : document.getElementById('plugins_other').value,
    other_site_config:  document.getElementById('other_site_config').value.trim(),
    notes:              document.getElementById('notes').value.trim(),
    project_start_date: document.getElementById('project_start_date').value || null,
    website_live_date:  document.getElementById('website_live_date').value || null,
  };

  try {
    if (isEdit) {
      await API.put(`/sites/${siteId}`, data);
    } else {
      await API.post('/sites', data);
    }
    location.href = '/';
  } catch (err) {
    showAlert(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isEdit ? 'Save Changes' : 'Save Site';
  }
});

function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt.includes('T') ? dt : dt + 'Z');
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getRadio(name) {
  const el = document.querySelector(`[name="${name}"]:checked`);
  return el ? el.value : '';
}

function showAlert(msg, type = 'info') {
  const alertEl = document.getElementById('alert');
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

if (isEdit) loadSite();
