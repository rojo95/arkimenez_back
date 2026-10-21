'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Sequelize } = require('sequelize');

dotenv.config();

/**
 * Recrea la base de datos de integración y aplica las migraciones.
 *
 * Es destructivo y por eso solo actúa si TEST_DB_NAME termina en `_test`.
 */
module.exports = async function globalSetup() {
  const testDbName = process.env.TEST_DB_NAME || 'arkimenext_test';

  if (!testDbName.endsWith('_test')) {
    throw new Error(
      'TEST_DB_NAME debe terminar en "_test" para evitar borrar la base de datos de desarrollo',
    );
  }

  const options = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    dialect: 'postgres',
    logging: false,
    dialectOptions:
      process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  };

  const admin = new Sequelize('postgres', process.env.DB_USER, process.env.DB_PASSWORD ?? '', options);

  try {
    await admin.query(`DROP DATABASE IF EXISTS "${testDbName}" WITH (FORCE)`);
  } catch {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDbName}'`,
    );
    await admin.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
  }
  await admin.query(`CREATE DATABASE "${testDbName}"`);
  await admin.close();

  const database = new Sequelize(testDbName, process.env.DB_USER, process.env.DB_PASSWORD ?? '', options);
  const queryInterface = database.getQueryInterface();
  const migrationsDir = path.resolve(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js'))
    .sort();

  for (const file of files) {
    const migration = require(path.join(migrationsDir, file));
    await migration.up(queryInterface, Sequelize);
  }

  await database.close();
};
