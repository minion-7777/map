"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import seedRows from "../data/places.json";
import { enqueue, ensureSeed, getMeta, listAllPlaces, listOutbox, putPlace } from "../lib/db";
import { syncNow } from "../lib/sync";
import { planTileUrls, prefetchTiles } from "../lib/tiles";
import { SEED_TIME, normalizePlace, roundCoord } from "../lib/validate";

const PlacesContext = createContext(null);
const CITY_FOCUS = { lat: 40.12, lng: 124.39, zoom: 13 };

function buildSeed() {
  return seedRows.map((place) => ({
    id: place.id,
    companyNumber: place.companyNumber,
    companyName: place.companyName,
    category: place.category,
    employeeCount: place.employeeCount,
    address: place.address || "",
    latitude: place.latitude,
    longitude: place.longitude,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
    deletedAt: null,
  }));
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function PlacesProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState("");
  const [places, setPlaces] = useState([]);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState("view");
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(null);
  const [tileJob, setTileJob] = useState(null);
  const mounted = useRef(true);
  const syncCount = useRef(0);

  async function refresh() {
    const rows = await listAllPlaces();
    if (!mounted.current) return;
    setPlaces(rows.filter((place) => !place.deletedAt));
    setPending((await listOutbox()).length);
    setLastSync(await getMeta("lastSync"));
  }

  async function sync() {
    syncCount.current += 1;
    setSyncing(true);
    try {
      const result = await syncNow();
      if (!mounted.current) return;
      if (result.ok) {
        setOnline(true);
        setSyncError("");
      } else {
        setOnline(result.reachable !== false);
        setSyncError(result.message || "Can't reach MySQL. Changes stay on this device.");
      }
      await refresh();
    } finally {
      syncCount.current -= 1;
      if (mounted.current && syncCount.current === 0) setSyncing(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        await ensureSeed(buildSeed());
        await refresh();
        if (mounted.current) setReady(true);
        sync();
      } catch (error) {
        if (mounted.current) {
          setBootError(error?.message || "Couldn't open the places saved on this device.");
        }
      }
    })();

    const onOnline = () => {
      sync();
    };
    const onOffline = () => {
      sync();
    };
    const onController = () => {
      if (sessionStorage.getItem("dandong-sw") === "1") return;
      sessionStorage.setItem("dandong-sw", "1");
      window.location.reload();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = window.setInterval(() => {
      sync();
    }, 20000);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onController);
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      mounted.current = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onController);
      }
    };
    // The local store is opened once. Later edits call refresh and sync directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return places
      .filter((place) => (category === "all" ? true : place.category === category))
      .filter((place) => {
        if (!needle) return true;
        return [
          place.companyName,
          place.address,
          place.category,
          String(place.companyNumber),
          String(place.employeeCount),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.companyNumber - b.companyNumber || a.companyName.localeCompare(b.companyName, "en"));
  }, [places, query, category]);

  const selected = places.find((place) => place.id === selectedId) || null;

  const statusText = useMemo(() => {
    if (!online) {
      return pending
        ? `MySQL에 련결되지 않았습니다. ${plural(pending, "change")}는 이 장치에 보관되어 있습니다.`
        : "MySQL에 련결되지 않았습니다.";
    }
    if (syncing && pending) return `Syncing ${plural(pending, "change")}…`;
    if (syncing) return "Syncing…";
    return "Saved on this device.";
  }, [online, pending, syncing, syncError, lastSync]);

  function select(id) {
    const place = places.find((item) => item.id === id);
    if (!place) return;
    setSelectedId(id);
    setMode("view");
    setDraft(null);
    setFormError("");
    setFocus({ lat: place.latitude, lng: place.longitude, zoom: 15, nonce: Date.now() });
  }

  function showCity() {
    setFocus({ ...CITY_FOCUS, nonce: Date.now() });
  }

  function startAdd() {
    setMode("add");
    setSelectedId(null);
    setFormError("");
    const nextNumber = places.reduce((max, place) => Math.max(max, place.companyNumber || 0), 1000) + 1;
    setDraft({
      id: null,
      companyNumber: nextNumber,
      companyName: "",
      category: "",
      employeeCount: "",
      address: "",
      latitude: null,
      longitude: null,
      createdAt: null,
    });
  }

  function startEdit() {
    if (!selected) return;
    setMode("edit");
    setFormError("");
    setDraft({ ...selected });
  }

  function cancelEdit() {
    setMode("view");
    setDraft(null);
    setFormError("");
  }

  function updateDraft(field, value) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setFormError("");
  }

  function setDraftPoint(latitude, longitude) {
    setDraft((current) =>
      current ? { ...current, latitude: roundCoord(latitude), longitude: roundCoord(longitude) } : current
    );
  }

  async function saveDraft() {
    if (!draft || busy) return;
    const now = new Date().toISOString();
    const parsed = normalizePlace({
      ...draft,
      id: draft.id || crypto.randomUUID(),
      createdAt: draft.createdAt || now,
      updatedAt: now,
      deletedAt: null,
    });
    if (parsed.error) {
      setFormError(parsed.error);
      return;
    }
    const rows = await listAllPlaces();
    const duplicate = rows.some(
      (row) => !row.deletedAt && row.id !== parsed.value.id && row.companyNumber === parsed.value.companyNumber
    );
    if (duplicate) {
      setFormError("That number is already used.");
      return;
    }
    setBusy(true);
    try {
      await putPlace(parsed.value);
      await enqueue(parsed.value);
      await refresh();
      setSelectedId(parsed.value.id);
      setMode("view");
      setDraft(null);
      setFormError("");
      setFocus({
        lat: parsed.value.latitude,
        lng: parsed.value.longitude,
        zoom: 15,
        nonce: Date.now(),
      });
      sync();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected || busy) return;
    const now = new Date().toISOString();
    const tombstone = { ...selected, deletedAt: now, updatedAt: now };
    setBusy(true);
    try {
      await putPlace(tombstone);
      await enqueue(tombstone);
      setSelectedId(null);
      setMode("view");
      setDraft(null);
      await refresh();
      sync();
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function movePlace(id, latitude, longitude) {
    if ((mode === "edit" || mode === "add") && draft && (draft.id === id || (mode === "add" && id === "draft"))) {
      setDraftPoint(latitude, longitude);
      return;
    }
    const rows = await listAllPlaces();
    const place = rows.find((item) => item.id === id && !item.deletedAt);
    if (!place) return;
    const next = {
      ...place,
      latitude: roundCoord(latitude),
      longitude: roundCoord(longitude),
      updatedAt: new Date().toISOString(),
    };
    await putPlace(next);
    await enqueue(next);
    await refresh();
    sync();
  }

  async function saveTiles() {
    if (tileJob?.running) return;
    try {
      const urls = planTileUrls();
      setTileJob({ done: 0, total: urls.length, failed: 0, running: true, message: "" });
      const result = await prefetchTiles(urls, (progress) => {
        if (mounted.current) setTileJob({ ...progress, running: true, message: "" });
      });
      if (!mounted.current) return;
      const saved = result.total - result.failed;
      setTileJob({
        done: result.total,
        total: result.total,
        failed: result.failed,
        running: false,
        message: result.failed
          ? `Saved ${saved} of ${result.total} map tiles on this device.`
          : `Saved ${result.total} map tiles on this device.`,
      });
    } catch (error) {
      if (!mounted.current) return;
      setTileJob({
        done: 0,
        total: 0,
        failed: 0,
        running: false,
        message: error.message || "Couldn't save the map.",
      });
    }
  }

  const value = {
    ready,
    bootError,
    places,
    filtered,
    online,
    pending,
    syncing,
    lastSync,
    query,
    setQuery,
    category,
    setCategory,
    selectedId,
    selected,
    mode,
    draft,
    formError,
    busy,
    focus,
    tileJob,
    select,
    showCity,
    startAdd,
    startEdit,
    cancelEdit,
    updateDraft,
    setDraftPoint,
    saveDraft,
    removeSelected,
    movePlace,
    sync,
    saveTiles,
  };

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces() {
  const value = useContext(PlacesContext);
  if (!value) throw new Error("usePlaces must be used inside PlacesProvider");
  return value;
}
