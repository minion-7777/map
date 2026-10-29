const DB_NAME = "dandong-map";
const DB_VERSION = 2;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
  });
}

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      if (!db.objectStoreNames.contains("locations")) {
        db.createObjectStore("locations", { keyPath: "id" });
      } else if (event.oldVersion > 0 && event.oldVersion < 2) {
        transaction.objectStore("locations").clear();
      }
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "id" });
      } else if (event.oldVersion > 0 && event.oldVersion < 2) {
        transaction.objectStore("outbox").clear();
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      } else if (event.oldVersion > 0 && event.oldVersion < 2) {
        const meta = transaction.objectStore("meta");
        meta.delete("seeded");
        meta.delete("lastSync");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

export async function getMeta(key) {
  const db = await openDb();
  const transaction = db.transaction("meta", "readonly");
  const value = await requestToPromise(transaction.objectStore("meta").get(key));
  await transactionDone(transaction);
  return value ? value.value : null;
}

export async function setMeta(key, value) {
  const db = await openDb();
  const transaction = db.transaction("meta", "readwrite");
  transaction.objectStore("meta").put({ key, value });
  await transactionDone(transaction);
}

export async function listAllPlaces() {
  const db = await openDb();
  const transaction = db.transaction("locations", "readonly");
  const rows = await requestToPromise(transaction.objectStore("locations").getAll());
  await transactionDone(transaction);
  return rows;
}

export async function putPlace(place) {
  const db = await openDb();
  const transaction = db.transaction("locations", "readwrite");
  transaction.objectStore("locations").put(place);
  await transactionDone(transaction);
}

export async function ensureSeed(rows) {
  if ((await getMeta("seeded")) === "1") return;
  const existing = await listAllPlaces();
  if (existing.length === 0) {
    const db = await openDb();
    const transaction = db.transaction("locations", "readwrite");
    const store = transaction.objectStore("locations");
    for (const row of rows) store.put(row);
    await transactionDone(transaction);
  }
  await setMeta("seeded", "1");
}

export async function listOutbox() {
  const db = await openDb();
  const transaction = db.transaction("outbox", "readonly");
  const rows = await requestToPromise(transaction.objectStore("outbox").getAll());
  await transactionDone(transaction);
  return rows;
}

export async function enqueue(place) {
  const db = await openDb();
  const transaction = db.transaction("outbox", "readwrite");
  transaction.objectStore("outbox").put({ id: place.id, updatedAt: place.updatedAt });
  await transactionDone(transaction);
}

export async function deleteOutboxIds(ids) {
  if (!ids.length) return;
  const db = await openDb();
  const transaction = db.transaction("outbox", "readwrite");
  const store = transaction.objectStore("outbox");
  for (const id of ids) store.delete(id);
  await transactionDone(transaction);
}
