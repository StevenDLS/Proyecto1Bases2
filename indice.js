require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initNeo4j } = require('./config/neo4j');
const { connectMongoDB } = require('./config/mongodb');
const { connectRedis } = require('./config/redis');
const { initCassandra } = require('./config/cassandra');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const sectionRoutes = require('./routes/sections');
const contentRoutes = require('./routes/content');
const evaluationRoutes = require('./routes/evaluations');
const enrollmentRoutes = require('./routes/enrollment');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

const start = async () => {
  await connectRedis();
  await connectMongoDB();

  initNeo4j().catch(err =>
    console.warn('Neo4j no disponible (configura NEO4J_URI en .env):', err.message)
  );
  initCassandra().catch(err =>
    console.warn('Cassandra no disponible (configura CASSANDRA_CONTACT_POINTS en .env):', err.message)
  );

  app.listen(process.env.PORT || 3000, () => {
    console.log(`TEC Digitalito corriendo en puerto ${process.env.PORT || 3000}`);
  });
};

start();
