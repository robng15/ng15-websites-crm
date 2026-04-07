const API = {
  get token() { return localStorage.getItem('ng15_token'); },

  headers(isJson = true) {
    const h = { Authorization: `Bearer ${this.token}` };
    if (isJson) h['Content-Type'] = 'application/json';
    return h;
  },

  async request(method, path, body) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      localStorage.removeItem('ng15_token');
      location.href = '/login.html';
      return;
    }

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/csv')) return res;

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  async uploadLogo(file) {
    const form = new FormData();
    form.append('logo', file);
    const res = await fetch('/api/upload/logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    if (res.status === 401) { localStorage.removeItem('ng15_token'); location.href = '/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  get(path)         { return this.request('GET', path); },
  post(path, body)  { return this.request('POST', path, body); },
  put(path, body)   { return this.request('PUT', path, body); },
  delete(path)      { return this.request('DELETE', path); },
};

function requireAuth() {
  if (!API.token) { location.href = '/login.html'; }
}
