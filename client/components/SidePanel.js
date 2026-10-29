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

  const filtering = Boolean(query) || category !== "all";

  return (
    <aside className="side">
      <header className="side-head">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1>Dandong Map</h1>
            <p className="brand-zh">丹东</p>
          </div>
        </div>

        <div className="toolbar">
          <label className="sr-only" htmlFor="search">
            회사검색
          </label>
          <input
            id="search"
            className="search"
            placeholder="회사검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filtered[0]) select(filtered[0].id);
            }}
          />
          <button className="btn" type="button" onClick={startAdd}>
            회사등록
          </button>
        </div>

        <div className="offline-actions">
          <button className="btn secondary" type="button" onClick={saveTiles} disabled={tileJob?.running}>
            {tileJob?.running ? `지도보관중 ${tileJob.done}/${tileJob.total}` : "지도보관"}
          </button>
        </div>
      </header>
      <div className="side-stage">
        <div className="chips" role="toolbar" aria-label="업종">
          <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
            전체
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
                <span className={`dot cat-${categoryTone(item)}`} aria-hidden="true" />
                {item}
              </button>
            ))}
        </div>

        {!ready && !bootError && <p className="hint">회사를 불러오는중입니다…</p>}

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
            <dl className="facts">
              <div>
                <dt>번호</dt>
                <dd>{selected.companyNumber}</dd>
              </div>
              <div>
                <dt>업종</dt>
                <dd>
                  <span className="pill">
                    <span className={`dot cat-${categoryTone(selected.category)}`} aria-hidden="true" />
                    {selected.category}
                  </span>
                </dd>
              </div>
              <div className="wide">
                <dt>회사명</dt>
                <dd className="fact-title">{selected.companyName}</dd>
              </div>
              <div className="wide">
                <dt>종업원수</dt>
                <dd>{selected.employeeCount.toLocaleString()} 명</dd>
              </div>
              <div className="wide">
                <dt>주소</dt>
                <dd>{selected.address}</dd>
              </div>
              <div className="wide">
                <dt>위치</dt>
                <dd className="coords">
                  {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                </dd>
              </div>
            </dl>
            <div className="form-actions">
              <button className="btn" type="button" onClick={startEdit}>
                편집
              </button>
              {confirming ? (
                <>
                  <button className="btn danger" type="button" onClick={removeSelected} disabled={busy}>
                    삭제
                  </button>
                  <button className="btn secondary" type="button" onClick={() => setConfirming(false)}>
                    취소
                  </button>
                </>
              ) : (
                <button className="btn danger" type="button" onClick={() => setConfirming(true)}>
                  삭제
                </button>
              )}
            </div>
            {confirming && <p className="confirm-note">회사를 지도에서 삭제하시겠습니까?</p>}
          </article>
        )}
      </div>
      <div className="side-scroll">
        <div className="list-head">
          <h2>회사목록</h2>
          <p className="list-count">
            {filtering ? `${filtered.length} / ${places.length}` : places.length}
            <span> 회사</span>
          </p>
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
                <span className={`swatch cat-${categoryTone(place.category)}`} aria-hidden="true" />
                <span className="place-body">
                  <span className="place-line">
                    <span className="place-no">{place.companyNumber}</span>
                    <span className="place-name">{place.companyName}</span>
                  </span>
                  <span className="place-meta">
                    <span>{place.category}</span>
                    <span>{place.employeeCount.toLocaleString()} 명</span>
                  </span>
                  {place.address ? <span className="place-address">{place.address}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {ready && filtered.length === 0 && <p className="hint">회사가 없습니다.</p>}
      </div>
    </aside>
  );
}
