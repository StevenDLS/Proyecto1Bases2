const { v4: uuidv4 } = require('uuid');
const { getSession } = require('../config/neo4j');
const mongoose = require('mongoose');
const { logAudit } = require('./logService');

const SectionContent = mongoose.models.SectionContent ||
  mongoose.model('SectionContent', new mongoose.Schema({
    sectionId: { type: String, required: true, unique: true },
    items: { type: Array, default: [] },
    updatedAt: { type: Date, default: Date.now }
  }), 'section_content');

const addRootSection = async (courseId, data, teacherId) => {
  const sectionId = uuidv4();
  const now = new Date().toISOString();
  const session = getSession();
  try {
    // Verificar que el docente es dueño del curso
    const check = await session.run(
      `MATCH (u:User {userId: $teacherId})-[:TEACHES]->(c:Course {courseId: $courseId}) RETURN c`,
      { teacherId, courseId }
    );
    if (check.records.length === 0) {
      const err = new Error('No autorizado');
      err.status = 403;
      throw err;
    }

    await session.run(
      `MATCH (c:Course {courseId: $courseId})
       CREATE (s:Section {sectionId: $sectionId, title: $title, order: $order, createdAt: $now})
       CREATE (c)-[:HAS_SECTION {order: $order}]->(s)`,
      { courseId, sectionId, title: data.title, order: data.order || 0, now }
    );
    await logAudit('Section', teacherId, 'CREATE', sectionId, null, { courseId, title: data.title });
    return { sectionId, title: data.title, order: data.order || 0 };
  } finally {
    await session.close();
  }
};

const addSubsection = async (parentSectionId, data, teacherId) => {
  const sectionId = uuidv4();
  const now = new Date().toISOString();
  const session = getSession();
  try {
    await session.run(
      `MATCH (parent:Section {sectionId: $parentSectionId})
       CREATE (s:Section {sectionId: $sectionId, title: $title, order: $order, createdAt: $now})
       CREATE (parent)-[:HAS_SUBSECTION {order: $order}]->(s)`,
      { parentSectionId, sectionId, title: data.title, order: data.order || 0, now }
    );
    await logAudit('Section', teacherId, 'CREATE', sectionId, null, { parentSectionId, title: data.title });
    return { sectionId, title: data.title, order: data.order || 0 };
  } finally {
    await session.close();
  }
};

const getSectionTree = async (courseId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH path = (c:Course {courseId: $courseId})-[:HAS_SECTION|HAS_SUBSECTION*]->(s:Section)
       RETURN s, length(path) as depth
       ORDER BY depth, s.order`,
      { courseId }
    );
    return result.records.map(r => ({
      ...r.get('s').properties,
      depth: r.get('depth').toNumber ? r.get('depth').toNumber() : r.get('depth')
    }));
  } finally {
    await session.close();
  }
};

const updateSection = async (sectionId, data, teacherId) => {
  const session = getSession();
  try {
    await session.run(
      `MATCH (s:Section {sectionId: $sectionId}) SET s.title = $title, s.order = $order`,
      { sectionId, title: data.title, order: data.order || 0 }
    );
    await logAudit('Section', teacherId, 'UPDATE', sectionId, null, data);
  } finally {
    await session.close();
  }
};

const deleteSection = async (sectionId, teacherId) => {
  const session = getSession();
  try {
    // Obtener todos los IDs de secciones en el subárbol
    const result = await session.run(
      `MATCH (root:Section {sectionId: $sectionId})
       OPTIONAL MATCH (root)-[:HAS_SUBSECTION*0..]->(sub:Section)
       RETURN collect(DISTINCT sub.sectionId) as ids`,
      { sectionId }
    );
    const ids = result.records[0].get('ids');
    if (!ids.includes(sectionId)) ids.push(sectionId);

    // Borrar contenido MongoDB de todas las secciones del subárbol
    for (const id of ids) {
      if (id) await SectionContent.deleteOne({ sectionId: id });
    }

    // Borrar nodos y relaciones en Neo4j
    await session.run(
      `MATCH (root:Section {sectionId: $sectionId})
       OPTIONAL MATCH (root)-[:HAS_SUBSECTION*0..]->(sub:Section)
       DETACH DELETE root, sub`,
      { sectionId }
    );
    await logAudit('Section', teacherId, 'DELETE', sectionId, null, null);
  } finally {
    await session.close();
  }
};

module.exports = { addRootSection, addSubsection, getSectionTree, updateSection, deleteSection };
