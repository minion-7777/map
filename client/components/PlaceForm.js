"use client";

import { useState } from "react";

export function PlaceForm({ draft, error, busy, mode, onChange, onSave, onCancel, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <h2>{mode === "add" ? "New company" : "Edit company"}</h2>
      <label>
        번호
        <input
          type="number"
          min={1}
          step={1}
          required
          value={draft.companyNumber ?? ""}
          onChange={(event) =>
            onChange("companyNumber", event.target.value === "" ? null : Number(event.target.value))
          }
        />
      </label>
      <label>
        업종
        <input
          value={draft.category}
          maxLength={80}
          required
          onChange={(event) => onChange("category", event.target.value)}
        />
      </label>
      <label>
        회사명
        <input
          value={draft.companyName}
          maxLength={160}
          required
          onChange={(event) => onChange("companyName", event.target.value)}
        />
      </label>
      <label>
        종업원수
        <input
          type="number"
          min={0}
          step={1}
          required
          value={draft.employeeCount ?? ""}
          onChange={(event) =>
            onChange("employeeCount", event.target.value === "" ? null : Number(event.target.value))
          }
        />
      </label>
      <label>
        주소
        <input
          value={draft.address}
          maxLength={200}
          required
          onChange={(event) => onChange("address", event.target.value)}
        />
      </label>
      <div className="coord-row">
        <label>
          위치 위도
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={draft.latitude ?? ""}
            onChange={(event) =>
              onChange("latitude", event.target.value === "" ? null : Number(event.target.value))
            }
          />
        </label>
        <label>
          위치 경도
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={draft.longitude ?? ""}
            onChange={(event) =>
              onChange("longitude", event.target.value === "" ? null : Number(event.target.value))
            }
          />
        </label>
      </div>
      {mode === "add" && draft.latitude == null && (
        <p className="hint">Click the map to set the location. You can drag the pin afterward.</p>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        {mode === "edit" && !confirming && (
          <button className="btn danger" type="button" onClick={() => setConfirming(true)} disabled={busy}>
            Delete
          </button>
        )}
        {mode === "edit" && confirming && (
          <>
            <button className="btn danger" type="button" onClick={onDelete} disabled={busy}>
              Delete
            </button>
            <button className="btn secondary" type="button" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        )}
      </div>
    </form>
  );
}
