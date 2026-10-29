"use client";

import dynamic from "next/dynamic";
import { PlacesProvider, usePlaces } from "./PlacesProvider";
import { SidePanel } from "./SidePanel";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-fallback">
      <p>Dandong</p>
      <span>丹东</span>
    </div>
  ),
});

function MapChrome() {
  const { online, mode, draft, showCity } = usePlaces();
  return (
    <div className="map-status">
      {!online && <span className="chip chip-off">오프라인</span>}
      {mode === "add" && draft?.latitude == null && <span className="chip">지도를 눌러 위치를 정하십시오</span>}
      <button type="button" className="home-btn" onClick={showCity}>
        단동 중심
      </button>
    </div>
  );
}

export default function App() {
  return (
    <PlacesProvider>
      <div className="app">
        <SidePanel />
        <div className="map-wrap">
          <MapView />
          <MapChrome />
        </div>
      </div>
    </PlacesProvider>
  );
}
