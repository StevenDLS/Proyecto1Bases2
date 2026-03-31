const cassandra = require('cassandra-driver');
require('dotenv').config();

let cassandraClient;

const initCassandra = async () => {
  const systemClient = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_CONTACT_POINTS],
    localDataCenter: process.env.CASSANDRA_DATACENTER
  });
  await systemClient.connect();

  await systemClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS tec_digitalito
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
  `);

  await systemClient.execute(`
    CREATE TABLE IF NOT EXISTS tec_digitalito.session_logs (
      user_id     TEXT,
      log_date    DATE,
      log_time    TIMESTAMP,
      event_type  TEXT,
      ip          TEXT,
      device      TEXT,
      details     TEXT,
      PRIMARY KEY ((user_id, log_date), log_time)
    ) WITH CLUSTERING ORDER BY (log_time DESC)
  `);

  await systemClient.execute(`
    CREATE TABLE IF NOT EXISTS tec_digitalito.system_logs (
      log_date    DATE,
      log_time    TIMESTAMP,
      user_id     TEXT,
      username    TEXT,
      event_type  TEXT,
      ip          TEXT,
      device      TEXT,
      details     TEXT,
      PRIMARY KEY (log_date, log_time, user_id)
    ) WITH CLUSTERING ORDER BY (log_time DESC)
  `);

  await systemClient.execute(`
    CREATE TABLE IF NOT EXISTS tec_digitalito.audit_trail (
      entity_type    TEXT,
      operation_date DATE,
      operation_time TIMESTAMP,
      user_id        TEXT,
      operation      TEXT,
      entity_id      TEXT,
      old_value      TEXT,
      new_value      TEXT,
      PRIMARY KEY ((entity_type, operation_date), operation_time, entity_id)
    ) WITH CLUSTERING ORDER BY (operation_time DESC)
  `);

  await systemClient.shutdown();

  cassandraClient = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_CONTACT_POINTS],
    localDataCenter: process.env.CASSANDRA_DATACENTER,
    keyspace: process.env.CASSANDRA_KEYSPACE
  });
  await cassandraClient.connect();
  console.log('Cassandra: conectado y keyspace inicializado');
};

const getClient = () => cassandraClient;

module.exports = { initCassandra, getClient };
