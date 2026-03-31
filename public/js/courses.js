// Lógica para course-edit.html
(async () => {
  await checkAuth(['teacher', 'admin']);
  const courseId = getQueryParam('id');

  if (courseId) {
    document.getElementById('pageTitle').textContent = 'Editar Curso';
    document.getElementById('sectionsPanel').style.removeProperty('display');
    document.getElementById('publishBtn').classList.remove('d-none');
    document.getElementById('cloneBtn').classList.remove('d-none');
    loadCourse(courseId);
    loadSectionTree(courseId);
    loadEvaluations(courseId);
  }

  // Guardar/crear curso
  document.getElementById('courseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('alertBox');
    alertBox.classList.add('d-none');

    const code = document.getElementById('code').value.trim();
    const name = document.getElementById('name').value.trim();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const description = document.getElementById('description').value.trim();
    const photoInput = document.getElementById('coursePhoto');

    if (!code || !name || !startDate) {
      alertBox.className = 'alert alert-danger'; alertBox.textContent = 'Código, nombre y fecha de inicio son requeridos.'; alertBox.classList.remove('d-none');
      return;
    }

    let photoFileId = null;
    if (photoInput.files[0]) {
      const formData = new FormData();
      formData.append('file', photoInput.files[0]);
      const uploadRes = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (uploadRes.ok) { const d = await uploadRes.json(); photoFileId = d.fileId; }
    }

    const body = { code, name, description, startDate, endDate: endDate || null, photoFileId };
    const url = courseId ? `/api/courses/${courseId}` : '/api/courses';
    const method = courseId ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      showToast(courseId ? 'Curso actualizado' : 'Curso creado', 'success');
      if (!courseId) {
        setTimeout(() => window.location.href = `course-edit.html?id=${data.courseId}`, 1000);
      }
    } else {
      alertBox.className = 'alert alert-danger'; alertBox.textContent = data.error || 'Error al guardar';
      alertBox.classList.remove('d-none');
    }
  });

  // Publicar
  document.getElementById('publishBtn')?.addEventListener('click', async () => {
    const res = await fetch(`/api/courses/${courseId}/publish`, { method: 'POST' });
    if (res.ok) showToast('Curso publicado exitosamente', 'success');
    else showToast('Error al publicar', 'danger');
  });

  // Clonar
  document.getElementById('cloneBtn')?.addEventListener('click', async () => {
    const code = prompt('Código del nuevo curso:');
    const name = prompt('Nombre del nuevo curso:');
    const startDate = prompt('Fecha de inicio (YYYY-MM-DD):');
    if (!code || !name || !startDate) return;
    const res = await fetch(`/api/courses/${courseId}/clone`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, startDate })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Curso clonado', 'success');
      setTimeout(() => window.location.href = `course-edit.html?id=${data.courseId}`, 1000);
    } else {
      showToast(data.error || 'Error al clonar', 'danger');
    }
  });

  // Sección modal
  let addSectionParentId = null;
  const sectionModal = new bootstrap.Modal(document.getElementById('sectionModal'));

  document.getElementById('addRootSectionBtn')?.addEventListener('click', () => {
    addSectionParentId = null;
    document.getElementById('sectionModalLabel').textContent = 'Nueva Sección';
    document.getElementById('sectionTitle').value = '';
    sectionModal.show();
  });

  document.getElementById('saveSectionBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('sectionTitle').value.trim();
    const order = parseInt(document.getElementById('sectionOrder').value) || 0;
    if (!title) return;

    let url, method = 'POST';
    if (addSectionParentId) {
      url = `/api/sections/${addSectionParentId}/subsection`;
    } else {
      url = `/api/sections/${courseId}`;
    }

    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, order })
    });
    if (res.ok) {
      sectionModal.hide();
      loadSectionTree(courseId);
      showToast('Sección creada');
    }
  });

  window.addSubsection = (parentId) => {
    addSectionParentId = parentId;
    document.getElementById('sectionModalLabel').textContent = 'Nueva Subsección';
    document.getElementById('sectionTitle').value = '';
    sectionModal.show();
  };

  window.deleteSection = async (sectionId) => {
    if (!confirm('¿Eliminar esta sección y todas sus subsecciones?')) return;
    const res = await fetch(`/api/sections/${sectionId}`, { method: 'DELETE' });
    if (res.ok) { loadSectionTree(courseId); showToast('Sección eliminada'); }
  };

  // Evaluaciones
  document.getElementById('addEvalBtn')?.addEventListener('click', () => {
    window.location.href = `evaluation.html?courseId=${courseId}&mode=create`;
  });
})();

async function loadCourse(courseId) {
  const res = await fetch(`/api/courses/${courseId}`);
  if (!res.ok) return;
  const c = await res.json();
  document.getElementById('code').value = c.code || '';
  document.getElementById('name').value = c.name || '';
  document.getElementById('description').value = c.description || '';
  document.getElementById('startDate').value = c.startDate ? c.startDate.split('T')[0] : '';
  document.getElementById('endDate').value = c.endDate ? c.endDate.split('T')[0] : '';
}

async function loadSectionTree(courseId) {
  const res = await fetch(`/api/sections/${courseId}/tree`);
  const sections = await res.json();
  const container = document.getElementById('sectionTreeContainer');
  if (!sections.length) {
    container.innerHTML = '<p class="text-muted text-center small p-2">Sin secciones aún.</p>';
    return;
  }
  container.innerHTML = `<ul class="section-tree p-2">
    ${sections.map(s => `
      <li class="${s.depth > 1 ? 'subsection' : ''}">
        <div class="d-flex justify-content-between align-items-center">
          <span>${'—'.repeat(s.depth - 1)} ${s.title}</span>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary btn-sm" onclick="addSubsection('${s.sectionId}')"
              aria-label="Agregar subsección a ${s.title}"><i class="bi bi-plus"></i></button>
            <a href="content-edit.html?sectionId=${s.sectionId}&courseId=${courseId}"
              class="btn btn-outline-primary btn-sm" aria-label="Editar contenido de ${s.title}">
              <i class="bi bi-pencil"></i>
            </a>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteSection('${s.sectionId}')"
              aria-label="Eliminar sección ${s.title}"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </li>`).join('')}
  </ul>`;
}

async function loadEvaluations(courseId) {
  const res = await fetch(`/api/evaluations/${courseId}`);
  const evals = await res.json();
  const container = document.getElementById('evalsList');
  if (!evals.length) {
    container.innerHTML = '<p class="text-muted text-center small p-2">Sin evaluaciones.</p>';
    return;
  }
  container.innerHTML = evals.map(e => `
    <a href="evaluation.html?id=${e.evaluationId}&courseId=${courseId}"
      class="list-group-item list-group-item-action">
      <div class="d-flex justify-content-between">
        <span>${e.title}</span>
        <small class="text-muted">${formatDate(e.startDate)}</small>
      </div>
    </a>`).join('');
}
