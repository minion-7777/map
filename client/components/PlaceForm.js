"use client";

export function PlaceForm({ draft, error, busy, mode, onChange, onSave, onCancel, onDelete }) {
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="form-title">
        <h2 id="company-form-title">{mode === "add" ? "회사등록" : "회사편집"}</h2>
        <button className="modal-close" type="button" onClick={onCancel} aria-label="닫기">
          ×
        </button>
      </div>
      <div className="field-grid">
        <label>
          번호
          <input
            type="number"
            min={1}
            step={1}
            required
            autoFocus
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
        <label className="wide">
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
        <label className="wide">
          주소
          <input
            value={draft.address}
            maxLength={200}
            required
            onChange={(event) => onChange("address", event.target.value)}
          />
        </label>
      </div>
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
        <p className="hint">지도를 눌러 위치를 정하십시오. 핀은 끌어 옮길수 있습니다.</p>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "보관중…" : "보관"}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>
          취소
        </button>
        {mode === "edit" && (
          <button className="btn danger" type="button" onClick={onDelete} disabled={busy}>
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
