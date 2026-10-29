"use client";

import { useEffect, useState } from "react";
import { categoryTone } from "../lib/validate";
import { PlaceForm } from "./PlaceForm";
import { usePlaces } from "./PlacesProvider";

export function SidePanel() {
  const {
    ready,
    bootError,
    places,
    filtered,
    statusText,
    lastSync,
    query,
    setQuery,
    category,
    setCategory,
    selected,
    mode,
    draft,
    formError,
    busy,
    tileJob,
    select,
    startAdd,
    startEdit,
    cancelEdit,
    updateDraft,
    saveDraft,
    removeSelected,
    sync,
    saveTiles,
  } = usePlaces();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setConfirming(false);
  }, [selected?.id, mode]);

  return (
    <aside className="side">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <h1>Dandong Map</h1>
          <p className="brand-zh">丹东</p>
        </div>
      </header>

      <p className="status" role="status" title={lastSync ? `Last sync ${lastSync}` : undefined}>
        {bootError || statusText}
      </p>

      <div className="toolbar">
        <label className="sr-only" htmlFor="search">
          Search companies
        </label>
        <input
          id="search"
          className="search"
          placeholder="Search companies"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filtered[0]) select(filtered[0].id);
          }}
        />
        <button className="btn" type="button" onClick={startAdd}>
          Add company
        </button>
      </div>

      <div className="offline-actions">
        <button className="btn secondary" type="button" onClick={saveTiles} disabled={tileJob?.running}>
          {tileJob?.running ? `Saving map ${tileJob.done}/${tileJob.total}` : "Save map for offline"}
        </button>
        <button className="btn secondary" type="button" onClick={sync}>
          Sync
        </button>
      </div>
      <p className="hint">
        {tileJob?.message ||
          "Companies stay in this browser. Map images are stored here after you save them or view them once."}
      </p>

      <div className="side-scroll">
        <div className="chips" role="toolbar" aria-label="Filter by category">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
            All
          </button>
          {[...new Set(places.map((place) => place.category).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "en"))
            .map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
        </div>

        {!ready && !bootError && <p className="hint">Loading companies saved on this device…</p>}

        {mode !== "view" && draft && (
          <PlaceForm
            key={mode === "add" ? "add" : draft.id}
            draft={draft}
            error={formError}
            busy={busy}
            mode={mode}
            onChange={updateDraft}
            onSave={saveDraft}
            onCancel={cancelEdit}
            onDelete={removeSelected}
          />
        )}

        {mode === "view" && selected && (
          <article className="detail">
            <p>번호: {selected.companyNumber}</p>
            <p>업종: {selected.category}</p>
            <p>회사명: {selected.companyName}</p>
            <p>종업원수: {selected.employeeCount.toLocaleString()} 명</p>
            <p>주소: {selected.address}</p>
            <p>위치: {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</p>
            <div className="form-actions">
              <button className="btn" type="button" onClick={startEdit}>
                Edit
              </button>
              {confirming ? (
                <>
                  <button className="btn danger" type="button" onClick={removeSelected} disabled={busy}>
                    Delete
                  </button>
                  <button className="btn secondary" type="button" onClick={() => setConfirming(false)}>
                    Keep
                  </button>
                </>
              ) : (
                <button className="btn danger" type="button" onClick={() => setConfirming(true)}>
                  Delete
                </button>
              )}
            </div>
            {confirming && <p className="hint">Delete this company from the map?</p>}
          </article>
        )}

        <div className="list-head">
          <h2>{query || category !== "all" ? `${filtered.length} of ${places.length}` : `${places.length} companies`}</h2>
        </div>
        <ul className="place-list">
          {filtered.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                className={place.id === selected?.id ? "place-card is-selected" : "place-card"}
                aria-current={place.id === selected?.id ? "true" : undefined}
                onClick={() => select(place.id)}
              >
                <span className={`dot cat-${categoryTone(place.category)}`} aria-hidden="true" />
                <span>
                  <span className="place-name">
                    {place.companyNumber} · {place.companyName}
                  </span>
                  <span className="place-meta">
                    {place.category} · {place.employeeCount.toLocaleString()} 명
                    {place.address ? ` · ${place.address}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {ready && filtered.length === 0 && <p className="hint">No companies match.</p>}
      </div>
    </aside>
  );
}
