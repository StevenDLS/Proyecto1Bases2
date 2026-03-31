const { v4: uuidv4 } = require('uuid');
const { getSession } = require('../config/neo4j');
const mongoose = require('mongoose');
const { logAudit } = require('./logService');

const SectionContent = mongoose.model('SectionContent', new mongoose.Schema({
  sectionId: { type: String, required: true, unique: true },
  items: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
}), 'section_content');

const createCourse = async (data, teacherId) => {
  const courseId = uuidv4();
  const now = new Date().toISOString();
  const session = getSession();
  try {
    await session.run(
      `MATCH (u:User {userId: $teacherId})
       CREATE (c:Course {
         courseId: $courseId, code: $code, name: $name, description: $description,
         startDate: $startDate, endDate: $endDate, photoFileId: $photoFileId,
         published: false, createdAt: $now
       })
       CREATE (u)-[:TEACHES]->(c)`,
      {
        teacherId, courseId, code: data.code, name: data.name,
        description: data.description || '', startDate: data.startDate,
        endDate: data.endDate || null, photoFileId: data.photoFileId || null, now
      }
    );
    await logAudit('Course', teacherId, 'CREATE', courseId, null, { courseId, code: data.code, name: data.name });
    return { courseId, ...data };
  } finally {
    await session.close();
  }
};

const getCoursesByTeacher = async (teacherId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {userId: $teacherId})-[:TEACHES]->(c:Course) RETURN c ORDER BY c.createdAt DESC`,
      { teacherId }
    );
    return result.records.map(r => r.get('c').properties);
  } finally {
    await session.close();
  }
};

const getCourseById = async (courseId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (c:Course {courseId: $courseId})
       OPTIONAL MATCH (t:User)-[:TEACHES]->(c)
       RETURN c, t.userId as teacherId, t.fullName as teacherName`,
      { courseId }
    );
    if (result.records.length === 0) return null;
    const r = result.records[0];
    return {
      ...r.get('c').properties,
      teacherId: r.get('teacherId'),
      teacherName: r.get('teacherName')
    };
  } finally {
    await session.close();
  }
};

const updateCourse = async (courseId, data, teacherId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {userId: $teacherId})-[:TEACHES]->(c:Course {courseId: $courseId})
       SET c.name = $name, c.description = $description, c.startDate = $startDate,
           c.endDate = $endDate, c.photoFileId = $photoFileId
       RETURN c`,
      {
        teacherId, courseId,
        name: data.name, description: data.description || '',
        startDate: data.startDate, endDate: data.endDate || null,
        photoFileId: data.photoFileId || null
      }
    );
    if (result.records.length === 0) {
      const err = new Error('Curso no encontrado o no autorizado');
      err.status = 403;
      throw err;
    }
    await logAudit('Course', teacherId, 'UPDATE', courseId, null, data);
    return result.records[0].get('c').properties;
  } finally {
    await session.close();
  }
};

const publishCourse = async (courseId, teacherId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {userId: $teacherId})-[:TEACHES]->(c:Course {courseId: $courseId})
       SET c.published = true RETURN c`,
      { teacherId, courseId }
    );
    if (result.records.length === 0) {
      const err = new Error('Curso no encontrado o no autorizado');
      err.status = 403;
      throw err;
    }
    await logAudit('Course', teacherId, 'UPDATE', courseId, { published: false }, { published: true });
    return result.records[0].get('c').properties;
  } finally {
    await session.close();
  }
};

const searchCourses = async (query) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (c:Course) WHERE c.published = true AND (toLower(c.name) CONTAINS toLower($query) OR toLower(c.code) CONTAINS toLower($query) OR toLower(c.description) CONTAINS toLower($query))
       OPTIONAL MATCH (t:User)-[:TEACHES]->(c)
       RETURN c, t.fullName as teacherName ORDER BY c.createdAt DESC`,
      { query: query || '' }
    );
    return result.records.map(r => ({
      ...r.get('c').properties,
      teacherName: r.get('teacherName')
    }));
  } finally {
    await session.close();
  }
};

const cloneCourse = async (courseId, newData, teacherId) => {
  const oldCourse = await getCourseById(courseId);
  if (!oldCourse) {
    const err = new Error('Curso no encontrado');
    err.status = 404;
    throw err;
  }

  const newCourseId = uuidv4();
  const now = new Date().toISOString();
  const session = getSession();

  try {
    // Crear nuevo curso
    await session.run(
      `MATCH (u:User {userId: $teacherId})
       CREATE (c:Course {
         courseId: $newCourseId, code: $code, name: $name, description: $description,
         startDate: $startDate, endDate: $endDate, photoFileId: $photoFileId,
         published: false, createdAt: $now
       })
       CREATE (u)-[:TEACHES]->(c)`,
      {
        teacherId, newCourseId, code: newData.code, name: newData.name,
        description: oldCourse.description,
        startDate: newData.startDate, endDate: newData.endDate || null,
        photoFileId: oldCourse.photoFileId || null, now
      }
    );

    // Obtener secciones de primer nivel del curso original
    const sectionsResult = await session.run(
      `MATCH (c:Course {courseId: $courseId})-[r:HAS_SECTION]->(s:Section)
       RETURN s, r.order as order`,
      { courseId }
    );

    // Clonar árbol de secciones recursivamente
    for (const record of sectionsResult.records) {
      const oldSection = record.get('s').properties;
      const order = record.get('order');
      await _cloneSectionTree(session, oldSection, newCourseId, null, order);
    }

    await logAudit('Course', teacherId, 'CREATE', newCourseId, null, { clonedFrom: courseId, ...newData });
    return { courseId: newCourseId };
  } finally {
    await session.close();
  }
};

const _cloneSectionTree = async (session, oldSection, newCourseId, parentSectionId, order) => {
  const newSectionId = uuidv4();
  const now = new Date().toISOString();

  await session.run(
    `CREATE (s:Section {sectionId: $sectionId, title: $title, order: $order, createdAt: $now})`,
    { sectionId: newSectionId, title: oldSection.title, order: order || oldSection.order, now }
  );

  if (parentSectionId) {
    await session.run(
      `MATCH (parent:Section {sectionId: $parentSectionId}), (s:Section {sectionId: $sectionId})
       CREATE (parent)-[:HAS_SUBSECTION {order: $order}]->(s)`,
      { parentSectionId, sectionId: newSectionId, order: order || oldSection.order }
    );
  } else {
    await session.run(
      `MATCH (c:Course {courseId: $courseId}), (s:Section {sectionId: $sectionId})
       CREATE (c)-[:HAS_SECTION {order: $order}]->(s)`,
      { courseId: newCourseId, sectionId: newSectionId, order: order || oldSection.order }
    );
  }

  // Copiar contenido MongoDB
  const oldContent = await SectionContent.findOne({ sectionId: oldSection.sectionId });
  if (oldContent) {
    await SectionContent.create({
      sectionId: newSectionId,
      items: oldContent.items,
      updatedAt: new Date()
    });
  }

  // Recursar subsecciones
  const subsResult = await session.run(
    `MATCH (s:Section {sectionId: $sectionId})-[r:HAS_SUBSECTION]->(sub:Section)
     RETURN sub, r.order as order`,
    { sectionId: oldSection.sectionId }
  );
  for (const record of subsResult.records) {
    await _cloneSectionTree(session, record.get('sub').properties, newCourseId, newSectionId, record.get('order'));
  }
};

const getCourseStudents = async (courseId, teacherId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (t:User {userId: $teacherId})-[:TEACHES]->(c:Course {courseId: $courseId})
       MATCH (s:User)-[:ENROLLED_IN]->(c)
       RETURN s.userId as userId, s.fullName as fullName, s.username as username`,
      { courseId, teacherId }
    );
    if (result.records.length === 0 && teacherId) {
      const check = await session.run(
        `MATCH (t:User {userId: $teacherId})-[:TEACHES]->(c:Course {courseId: $courseId}) RETURN c`,
        { teacherId, courseId }
      );
      if (check.records.length === 0) {
        const err = new Error('No autorizado');
        err.status = 403;
        throw err;
      }
    }
    return result.records.map(r => ({
      userId: r.get('userId'),
      fullName: r.get('fullName'),
      username: r.get('username')
    }));
  } finally {
    await session.close();
  }
};

module.exports = {
  createCourse, getCoursesByTeacher, getCourseById, updateCourse,
  publishCourse, searchCourses, cloneCourse, getCourseStudents
};
