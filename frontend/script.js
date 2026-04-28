const API = 'http://127.0.0.1:8000/api';

const backgrounds = {
  add:      "url('images/add.jpg')",
  tbr:      "url('images/tbr.jpg')",
  reading:  "url('images/reading.jpg')",
  finished: "url('images/finished.jpg')",
  stats:    "url('images/stats.jpg')",
};

// ─── Token helpers ────────────────────────────────────────────────────────────

function getAccess()  { return localStorage.getItem('access'); }
function getRefresh() { return localStorage.getItem('refresh'); }

function saveTokens(access, refresh) {
  localStorage.setItem('access', access);
  localStorage.setItem('refresh', refresh);
}

function clearTokens() {
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
  localStorage.removeItem('username');
}

async function refreshAccessToken() {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('access', data.access);
    if (data.refresh) localStorage.setItem('refresh', data.refresh);
    return true;
  } catch { return false; }
}

// ─── API fetch wrapper (auto-refreshes token on 401) ─────────────────────────

async function apiFetch(path, options = {}) {
  const doRequest = (token) => fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  let res = await doRequest(getAccess());

  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (!ok) { logout(); return null; }
    res = await doRequest(getAccess());
  }

  return res;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('loginTabBtn').classList.toggle('active',    tab === 'login');
  document.getElementById('registerTabBtn').classList.toggle('active', tab === 'register');
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  try {
    const res = await fetch(`${API}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed.'; return; }
    saveTokens(data.access, data.refresh);
    localStorage.setItem('username', data.username);
    showApp();
  } catch {
    errEl.textContent = 'Could not reach the server.';
  }
}

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl    = document.getElementById('registerError');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Username and password are required.'; return; }

  try {
    const res = await fetch(`${API}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = Object.values(data).flat().join(' ');
      return;
    }
    saveTokens(data.access, data.refresh);
    localStorage.setItem('username', data.username);
    showApp();
  } catch {
    errEl.textContent = 'Could not reach the server.';
  }
}

function logout() {
  clearTokens();
  document.getElementById('appScreen').style.display  = 'none';
  document.getElementById('authScreen').style.display = '';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display  = '';
  document.getElementById('usernameLabel').textContent = `👤 ${localStorage.getItem('username')}`;
  loadAll();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', (e) => showTab(e.currentTarget));
});

function showTab(btn) {
  const tab = btn.dataset.tab;

  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.backgroundImage = 'none';
  });

  const page = document.getElementById(tab);
  page.classList.add('active');
  page.style.backgroundImage = backgrounds[tab] || 'none';

  document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (tab === 'stats') loadStats();
}

// ─── Books ────────────────────────────────────────────────────────────────────

async function loadAll() {
  await Promise.all([
    loadList('TBR',      'tbrList'),
    loadList('Reading',  'readingList'),
    loadList('Finished', 'finishedList'),
  ]);
}

async function loadList(status, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<p class="empty">Loading...</p>';

  const res = await apiFetch(`/books/?status=${status}`);
  if (!res) return;

  const books = await res.json();
  if (!books.length) {
    container.innerHTML = '<p class="empty">No books here yet!</p>';
    return;
  }
  container.innerHTML = books.map(bookCard).join('');
}

function bookCard(book) {
  const stars = '⭐'.repeat(book.rating) || '—';
  const img = book.cover
    ? `<img src="images/${book.cover}" alt="${book.title} cover" onerror="this.style.display='none'">`
    : `<div class="no-cover">📖</div>`;

  return `
    <div class="book" id="book-${book.id}">
      ${img}
      <div class="book-info">
        <h3>${escHtml(book.title)}</h3>
        <p><em>${escHtml(book.author)}</em></p>
        <p class="rating">${stars}</p>
        ${book.notes ? `<p>${escHtml(book.notes)}</p>` : ''}
        <div class="book-actions">
          <select onchange="changeStatus(${book.id}, this.value)">
            <option value="TBR"      ${book.status === 'TBR'      ? 'selected' : ''}>TBR</option>
            <option value="Reading"  ${book.status === 'Reading'  ? 'selected' : ''}>Reading</option>
            <option value="Finished" ${book.status === 'Finished' ? 'selected' : ''}>Finished</option>
          </select>
          <button class="delete-btn" onclick="deleteBook(${book.id})">🗑 Delete</button>
        </div>
      </div>
    </div>`;
}

async function addBook() {
  const title  = document.getElementById('title').value.trim();
  const author = document.getElementById('author').value.trim();
  const notes  = document.getElementById('notes').value.trim();
  const status = document.getElementById('status').value;
  const rating = +document.getElementById('rating').value;
  const cover  = document.getElementById('cover').value.trim();
  const errEl  = document.getElementById('addError');
  const btn    = document.getElementById('addBtn');

  errEl.textContent = '';
  if (!title || !author) { errEl.textContent = 'Title and author are required.'; return; }

  btn.disabled = true;
  btn.textContent = 'Adding...';

  const res = await apiFetch('/books/', {
    method: 'POST',
    body: JSON.stringify({ title, author, notes, status, rating, cover }),
  });

  btn.disabled = false;
  btn.textContent = 'Add Book';

  if (!res || !res.ok) {
    errEl.textContent = 'Failed to add book. Please try again.';
    return;
  }

  // Clear form
  ['title', 'author', 'notes', 'cover'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('rating').value = '0';
  document.getElementById('status').value = 'TBR';

  await loadAll();
}

async function deleteBook(id) {
  if (!confirm('Delete this book?')) return;
  const res = await apiFetch(`/books/${id}/`, { method: 'DELETE' });
  if (res && (res.ok || res.status === 204)) {
    await loadAll();
  }
}

async function changeStatus(id, newStatus) {
  await apiFetch(`/books/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus }),
  });
  await loadAll();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function loadStats() {
  const box = document.getElementById('statsBox');
  box.innerHTML = '<p class="empty">Loading stats...</p>';

  const res = await apiFetch('/stats/');
  if (!res || !res.ok) { box.innerHTML = '<p class="empty">Could not load stats.</p>'; return; }

  const s = await res.json();
  const avgStars = s.avg_rating ? '⭐'.repeat(Math.round(s.avg_rating)) + ` (${s.avg_rating})` : '—';

  const topRatedHtml = s.top_rated.length
    ? s.top_rated.map(b => `<li>${escHtml(b.title)} — ${'⭐'.repeat(b.rating)}</li>`).join('')
    : '<li>None yet</li>';

  const recentHtml = s.recent.length
    ? s.recent.map(b => `<li>${escHtml(b.title)} <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span></li>`).join('')
    : '<li>None yet</li>';

  box.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-num">${s.total}</div><div class="stat-label">Total Books</div></div>
      <div class="stat-card"><div class="stat-num">${s.tbr_count}</div><div class="stat-label">To Be Read</div></div>
      <div class="stat-card"><div class="stat-num">${s.reading_count}</div><div class="stat-label">Reading</div></div>
      <div class="stat-card"><div class="stat-num">${s.finished_count}</div><div class="stat-label">Finished</div></div>
    </div>
    <div class="stats-grid" style="margin-top:12px;">
      <div class="stat-card"><div class="stat-num">${avgStars}</div><div class="stat-label">Avg Rating</div></div>
      <div class="stat-card"><div class="stat-num">${s.rated_count}</div><div class="stat-label">Rated Books</div></div>
    </div>
    <div class="stats-section">
      <h3>⭐ Top Rated</h3>
      <ul>${topRatedHtml}</ul>
    </div>
    <div class="stats-section">
      <h3>🕐 Recently Added</h3>
      <ul>${recentHtml}</ul>
    </div>`;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (getAccess()) {
  showApp();
}
