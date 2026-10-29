import { deleteOutboxIds, getMeta, listAllPlaces, listOutbox, putPlace, setMeta } from "./db";

let chain = Promise.resolve();

export function syncNow() {
  const run = chain.then(syncOnce, syncOnce);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function syncOnce() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, offline: true };
  }

  try {
    let followUp = false;
    let serverTime = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const outcome = await pushAndPull();
      if (!outcome.ok) return outcome;
      serverTime = outcome.serverTime || serverTime;
      if (!outcome.followUp) {
        return { ok: true, serverTime };
      }
      followUp = true;
    }
    return { ok: true, serverTime, followUp };
  } catch {
    return { ok: false, message: "Can't reach the server. Changes stay on this device." };
  }
}

async function pushAndPull() {
  const since = await getMeta("lastSync");
  const entries = await listOutbox();
  const all = await listAllPlaces();
  const byId = new Map(all.map((place) => [place.id, place]));
  const pushed = entries.map((entry) => byId.get(entry.id)).filter(Boolean);

  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ since, pushed }),
  });

  if (!response.ok) {
    return { ok: false, message: await readError(response) };
  }

  const data = await response.json();
  const latestEntries = await listOutbox();
  const clearIds = [];
  for (const id of data.accepted || []) {
    const latest = latestEntries.find((entry) => entry.id === id);
    const sent = pushed.find((place) => place.id === id);
    if (latest && sent && latest.updatedAt === sent.updatedAt) clearIds.push(id);
  }
  await deleteOutboxIds(clearIds);

  const pending = new Set((await listOutbox()).map((entry) => entry.id));
  const local = new Map((await listAllPlaces()).map((place) => [place.id, place]));
  const incoming = [...(data.resolved || []), ...(data.locations || [])];
  const seen = new Set();
  for (const remote of incoming) {
    if (!remote?.id || seen.has(`${remote.id}:${remote.updatedAt}`)) continue;
    seen.add(`${remote.id}:${remote.updatedAt}`);
    const current = local.get(remote.id);
    const blocked = pending.has(remote.id) && current && current.updatedAt > remote.updatedAt;
    if (blocked) continue;
    await putPlace(remote);
    local.set(remote.id, remote);
  }

  if (data.serverTime) await setMeta("lastSync", data.serverTime);
  if (data.rejected?.length) {
    return { ok: false, message: data.rejected[0].error || "A place could not be synced." };
  }
  const stillPending = await listOutbox();
  const followUp = stillPending.some((entry) => {
    const sent = pushed.find((place) => place.id === entry.id);
    return !sent || sent.updatedAt !== entry.updatedAt;
  });
  return { ok: true, serverTime: data.serverTime, followUp };
}

async function readError(response) {
  try {
    const data = await response.json();
    if (typeof data.message === "string" && data.message) return data.message;
    if (typeof data.error === "string" && data.error) return data.error;
  } catch {
    // The body was not JSON.
  }
  return "Can't reach the server. Changes stay on this device.";
}
