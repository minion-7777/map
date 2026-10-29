const { normalizePlace } = require("./validate");
const { toMysql, fromMysql, rowToJson, withConnection } = require("./db");

function likeTerm(value) {
  return `%${String(value).replace(/[!%_]/g, (char) => `!${char}`)}%`;
}

async function searchLocations(query) {
  const term = String(query || "").trim();
  return withConnection(async (connection) => {
    if (!term) {
      const [rows] = await connection.query(
        `SELECT * FROM locations WHERE deleted_at IS NULL ORDER BY company_number ASC LIMIT 200`
      );
      return rows.map(rowToJson);
    }
    const pattern = likeTerm(term);
    const [rows] = await connection.query(
      `SELECT * FROM locations
       WHERE deleted_at IS NULL
         AND (
           company_name LIKE ? ESCAPE '!'
           OR address LIKE ? ESCAPE '!'
           OR category LIKE ? ESCAPE '!'
           OR CAST(company_number AS CHAR) LIKE ? ESCAPE '!'
           OR CAST(employee_count AS CHAR) LIKE ? ESCAPE '!'
         )
       ORDER BY company_number ASC
       LIMIT 200`,
      [pattern, pattern, pattern, pattern, pattern]
    );
    return rows.map(rowToJson);
  });
}

async function upsertPlace(connection, place, { force }) {
  const [existingRows] = await connection.query(
    `SELECT updated_at FROM locations WHERE id = ?`,
    [place.id]
  );
  const serverUpdated = existingRows[0] ? fromMysql(existingRows[0].updated_at) : null;
  const serverIsNewer = serverUpdated && serverUpdated > place.updatedAt;
  if (!force && serverIsNewer) {
    const [kept] = await connection.query(`SELECT * FROM locations WHERE id = ?`, [place.id]);
    return rowToJson(kept[0]);
  }

  if (!place.deletedAt) {
    const [duplicates] = await connection.query(
      `SELECT id FROM locations WHERE company_number = ? AND deleted_at IS NULL AND id <> ? LIMIT 1`,
      [place.companyNumber, place.id]
    );
    if (duplicates.length) return { error: "That number is already used." };
  }

  await connection.query(
    `INSERT INTO locations
      (id, company_number, category, company_name, employee_count, address, latitude, longitude, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      company_number = VALUES(company_number),
      category = VALUES(category),
      company_name = VALUES(company_name),
      employee_count = VALUES(employee_count),
      address = VALUES(address),
      latitude = VALUES(latitude),
      longitude = VALUES(longitude),
      updated_at = VALUES(updated_at),
      deleted_at = VALUES(deleted_at)`,
    [
      place.id,
      place.companyNumber,
      place.category,
      place.companyName,
      place.employeeCount,
      place.address,
      place.latitude,
      place.longitude,
      toMysql(place.createdAt),
      toMysql(place.updatedAt),
      toMysql(place.deletedAt),
    ]
  );
  const [saved] = await connection.query(`SELECT * FROM locations WHERE id = ?`, [place.id]);
  return rowToJson(saved[0]);
}

async function listSince(connection, since) {
  if (!since) {
    const [rows] = await connection.query(`SELECT * FROM locations ORDER BY updated_at ASC`);
    return rows.map(rowToJson);
  }
  const [rows] = await connection.query(
    `SELECT * FROM locations WHERE updated_at > ? ORDER BY updated_at ASC`,
    [toMysql(since)]
  );
  return rows.map(rowToJson);
}

async function serverNow(connection) {
  const [rows] = await connection.query(`SELECT UTC_TIMESTAMP(3) AS now`);
  return fromMysql(rows[0].now);
}

async function syncLocations({ since, pushed }) {
  return withConnection(async (connection) => {
    await connection.beginTransaction();
    try {
      const accepted = [];
      const rejected = [];
      const resolved = [];
      for (const item of pushed) {
        const parsed = normalizePlace(item);
        if (parsed.error) {
          rejected.push({ id: item && item.id ? String(item.id) : "", error: parsed.error });
          continue;
        }
        const saved = await upsertPlace(connection, parsed.value, { force: false });
        if (saved.error) {
          rejected.push({ id: parsed.value.id, error: saved.error });
          continue;
        }
        accepted.push(parsed.value.id);
        resolved.push(saved);
      }
      const locations = await listSince(connection, since);
      const now = await serverNow(connection);
      await connection.commit();
      return { accepted, rejected, resolved, locations, serverTime: now };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

async function createLocation(input) {
  const parsed = normalizePlace(input);
  if (parsed.error) return parsed;
  const saved = await withConnection((connection) =>
    upsertPlace(connection, parsed.value, { force: true })
  );
  if (saved.error) return saved;
  return { value: saved };
}

async function updateLocation(id, input) {
  const parsed = normalizePlace({ ...input, id });
  if (parsed.error) return parsed;
  const saved = await withConnection((connection) =>
    upsertPlace(connection, parsed.value, { force: true })
  );
  if (saved.error) return saved;
  return { value: saved };
}

async function removeLocation(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return { error: "Missing place id." };
  return withConnection(async (connection) => {
    const [rows] = await connection.query(`SELECT * FROM locations WHERE id = ?`, [id]);
    if (!rows.length) return { error: "Company not found." };
    const now = new Date().toISOString();
    await connection.query(
      `UPDATE locations SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [toMysql(now), toMysql(now), id]
    );
    const [saved] = await connection.query(`SELECT * FROM locations WHERE id = ?`, [id]);
    return { value: rowToJson(saved[0]) };
  });
}

module.exports = {
  searchLocations,
  syncLocations,
  createLocation,
  updateLocation,
  removeLocation,
};
