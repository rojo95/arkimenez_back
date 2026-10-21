require('dotenv').config();

function buildConfig(database) {
  return {
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
    dialectOptions:
      process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  };
}

module.exports = {
  development: buildConfig(process.env.DB_NAME),
  test: buildConfig(process.env.TEST_DB_NAME ?? 'arkimenext_test'),
  production: buildConfig(process.env.DB_NAME),
};
