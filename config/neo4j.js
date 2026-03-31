const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const getSession = () => driver.session();

const initNeo4j = async () => {
  const session = getSession();
  try {
    await session.run(`CREATE CONSTRAINT user_username IF NOT EXISTS FOR (u:User) REQUIRE u.username IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT user_userid IF NOT EXISTS FOR (u:User) REQUIRE u.userId IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT course_code IF NOT EXISTS FOR (c:Course) REQUIRE c.code IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT course_courseid IF NOT EXISTS FOR (c:Course) REQUIRE c.courseId IS UNIQUE`);
    await session.run(`CREATE INDEX section_id IF NOT EXISTS FOR (s:Section) ON (s.sectionId)`);
    console.log('Neo4j: constraints e índices creados');
  } finally {
    await session.close();
  }
};

module.exports = { driver, getSession, initNeo4j };
