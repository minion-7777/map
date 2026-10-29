const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { SEED_TIME } = require("./validate");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS locations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_number INT NOT NULL,
  category VARCHAR(80) NOT NULL,
  company_name VARCHAR(160) NOT NULL,
  employee_count INT NOT NULL,
  address VARCHAR(200) NOT NULL,
  latitude DOUBLE NOT NULL,
  longitude DOUBLE NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL,
  INDEX idx_locations_updated (updated_at),
  INDEX idx_locations_number (company_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let pool = null;
let dbReady = false;
let lastError = null;
let connecting = false;

function readConfig() {
  const database = process.env.MYSQL_DATABASE || "dandong_map";
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error("MYSQL_DATABASE may only contain letters, numbers, and underscores.");
  }
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database,
  };
}

function toMysql(iso) {
  if (!iso) return null;
  return iso.slice(0, 23).replace("T", " ");
}

function fromMysql(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const match = String(value)
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?/);
  if (!match) return null;
  const fraction = `${match[3] || ".000"}000`.slice(0, 4);
  return `${match[1]}T${match[2]}${fraction}Z`;
}

function rowToJson(row) {
  return {
    id: row.id,
    companyNumber: Number(row.company_number),
    category: row.category,
    companyName: row.company_name,
    employeeCount: Number(row.employee_count),
    address: row.address || "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    createdAt: fromMysql(row.created_at),
    updatedAt: fromMysql(row.updated_at),
    deletedAt: fromMysql(row.deleted_at),
  };
}

function isReady() {
  return dbReady && Boolean(pool);
}

function getLastError() {
  return lastError;
}

function mysqlHint() {
  const message = lastError?.message || "";
  if (/access denied/i.test(message)) {
    return "MySQL rejected the username or password in server/.env.";
  }
  if (/ECONNREFUSED/i.test(message)) {
    return "MySQL isn't running. Start the MySQL service, then sync again.";
  }
  return "MySQL isn't connected. Check server/.env and that the MySQL service is running.";
}

async function initDb() {
  const config = readConfig();
  const admin = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    timezone: "Z",
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }

  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
  });

  await ensureSchema(pool);
  await seedPlaces(pool);
  dbReady = true;
  lastError = null;
}

function connect() {
  if (connecting) return;
  connecting = true;
  initDb()
    .then(() => {
      const config = readConfig();
      console.log(`MySQL connected. Database ${config.database} is ready.`);
    })
    .catch((error) => {
      dbReady = false;
      lastError = error;
      console.error("MySQL:", error.message);
      setTimeout(connect, 8000);
    })
    .finally(() => {
      connecting = false;
    });
}

async function ensureSchema(activePool) {
  const [columns] = await activePool.query(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'locations'`
  );
  const names = new Set(columns.map((column) => column.COLUMN_NAME));
  const current =
    names.has("company_number") &&
    names.has("company_name") &&
    names.has("employee_count") &&
    names.has("address") &&
    names.has("latitude") &&
    names.has("longitude");
  if (names.size && !current) {
    await activePool.query("DROP TABLE locations");
  }
  await activePool.query(SCHEMA);
  await activePool.query("ALTER TABLE locations MODIFY category VARCHAR(80) NOT NULL");
}

async function seedPlaces(activePool) {
  const file = path.join(__dirname, "../../client/data/places.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const places = Array.isArray(parsed) ? parsed : [];
  const sql = `INSERT IGNORE INTO locations
    (id, company_number, category, company_name, employee_count, address, latitude, longitude, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`;
  const stamp = toMysql(SEED_TIME);
  for (const place of places) {
    if (!place?.id || place.companyNumber == null || !place.companyName) continue;
    await activePool.query(sql, [
      place.id,
      place.companyNumber,
      place.category,
      place.companyName,
      place.employeeCount,
      place.address,
      place.latitude,
      place.longitude,
      stamp,
      stamp,
    ]);
  }
}

async function withConnection(work) {
  const connection = await pool.getConnection();
  try {
    return await work(connection);
  } finally {
    connection.release();
  }
}

module.exports = {
  connect,
  isReady,
  getLastError,
  mysqlHint,
  toMysql,
  fromMysql,
  rowToJson,
  withConnection,
};
