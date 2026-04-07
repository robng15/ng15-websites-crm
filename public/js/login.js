if (localStorage.getItem('ng15_token')) {
  location.href = '/';
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('error');
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Login failed';
      errorEl.className = 'alert alert-error';
      errorEl.hidden = false;
      return;
    }

    localStorage.setItem('ng15_token', data.token);
    location.href = '/';
  } catch {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.className = 'alert alert-error';
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});
