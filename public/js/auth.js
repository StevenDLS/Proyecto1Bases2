// Helpers
const showAlert = (msg, type = 'danger') => {
  const box = document.getElementById('alertBox');
  if (!box) return;
  box.className = `alert alert-${type}`;
  box.textContent = msg;
  box.classList.remove('d-none');
};

const setLoading = (loading) => {
  const btn = document.getElementById('submitBtn');
  const spinner = document.getElementById('btnSpinner');
  const text = document.getElementById('btnText');
  if (!btn) return;
  btn.disabled = loading;
  if (spinner) spinner.classList.toggle('d-none', !loading);
  if (text) text.textContent = loading ? 'Procesando...' : (btn.dataset.label || btn.textContent.trim());
};

// Toggle password visibility
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      eyeIcon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }

  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe')?.checked || false;

      if (!username || !password) {
        showAlert('Completa todos los campos');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, rememberMe })
        });
        const data = await res.json();
        if (res.ok) {
          const role = data.user.role;
          if (role === 'admin') window.location.href = 'dashboard-admin.html';
          else if (role === 'teacher') window.location.href = 'dashboard-teacher.html';
          else window.location.href = 'dashboard-student.html';
        } else {
          showAlert(data.error || 'Error al iniciar sesión');
        }
      } catch {
        showAlert('Error de conexión. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    });
  }

  // Signup form
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const fullName = document.getElementById('fullName').value.trim();
      const birthDate = document.getElementById('birthDate').value;
      const role = document.getElementById('role').value;
      const avatarInput = document.getElementById('avatar');

      if (!username || !email || !password || !fullName || !birthDate) {
        showAlert('Completa todos los campos requeridos');
        return;
      }

      setLoading(true);
      try {
        let avatarFileId = null;

        // Subir avatar si se seleccionó
        if (avatarInput && avatarInput.files[0]) {
          const formData = new FormData();
          formData.append('file', avatarInput.files[0]);
          const uploadRes = await fetch('/api/files/upload', {
            method: 'POST', body: formData
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            avatarFileId = uploadData.fileId;
          }
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password, fullName, birthDate, role, avatarFileId })
        });
        const data = await res.json();
        if (res.ok) {
          showAlert('Cuenta creada exitosamente. Redirigiendo...', 'success');
          setTimeout(() => window.location.href = 'SignIn.html', 1500);
        } else {
          const msg = data.errors ? data.errors.map(e => e.msg).join(', ') : (data.error || 'Error al registrarse');
          showAlert(msg);
        }
      } catch {
        showAlert('Error de conexión. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    });
  }
});
