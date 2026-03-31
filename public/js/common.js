// Verificar autenticación y redirigir si es necesario
async function checkAuth(allowedRoles) {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/SignIn.html';
      return null;
    }
    const data = await res.json();
    const user = data.user;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Redirigir al dashboard correspondiente
      if (user.role === 'admin') window.location.href = '/dashboard-admin.html';
      else if (user.role === 'teacher') window.location.href = '/dashboard-teacher.html';
      else window.location.href = '/dashboard-student.html';
      return null;
    }
    return user;
  } catch {
    window.location.href = '/SignIn.html';
    return null;
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/SignIn.html';
  }
}

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const id = 'toast-' + Date.now();
  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `toast align-items-center text-bg-${type} border-0`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  container.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 3500 });
  bsToast.show();
  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CR');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-CR');
}
