"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Polygon, Rectangle, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { usePlaces } from "./PlacesProvider";
import { categoryTone } from "../lib/validate";

const CENTERLINE = [
  [40.23, 124.52],
  [40.18, 124.45],
  [40.145, 124.41],
  [40.12, 124.398],
  [40.11, 124.385],
  [40.09, 124.36],
  [40.05, 124.34],
  [40.02, 124.3],
];

const ICONS = {};
const LABELS = {};

function pinIcon(category, selected) {
  const tone = categoryTone(category);
  const key = `${tone}-${selected ? "on" : "off"}`;
  if (!ICONS[key]) {
    ICONS[key] = L.divIcon({
      className: "pin-wrap",
      html: `<span class="pin pin-${tone}${selected ? " is-selected" : ""}"></span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }
  return ICONS[key];
}

function cityLabel(title, subtitle) {
  const key = `${title}:${subtitle}`;
  if (!LABELS[key]) {
    LABELS[key] = L.divIcon({
      className: "city-label",
      html: `<strong>${title}</strong><em>${subtitle}</em>`,
      iconSize: [120, 34],
      iconAnchor: [60, 17],
    });
  }
  return LABELS[key];
}

function bufferLine(points, half) {
  const left = [];
  const right = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[1] - previous[1];
    const dy = next[0] - previous[0];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    left.push([points[index][0] + nx * half, points[index][1] + ny * half]);
    right.push([points[index][0] - nx * half, points[index][1] - ny * half]);
  }
  return [...left, ...right.reverse()];
}

function Schematic() {
  const map = useMap();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!map.getPane("schematic")) {
      const pane = map.createPane("schematic");
      pane.style.zIndex = "150";
      pane.style.pointerEvents = "none";
    }
    setReady(true);
  }, [map]);
  if (!ready) return null;
  return (
    <>
      <Rectangle
        pane="schematic"
        bounds={[
          [39.95, 124.18],
          [40.32, 124.62],
        ]}
        pathOptions={{ stroke: false, fillColor: "#d5e1cc", fillOpacity: 1 }}
      />
      <Polygon
        pane="schematic"
        positions={bufferLine(CENTERLINE, 0.007)}
        pathOptions={{ stroke: false, fillColor: "#7eafc4", fillOpacity: 1 }}
      />
      <Marker pane="schematic" position={[40.155, 124.34]} icon={cityLabel("Dandong", "丹东")} interactive={false} />
      <Marker pane="schematic" position={[40.1, 124.43]} icon={cityLabel("Sinuiju", "신의주")} interactive={false} />
    </>
  );
}

function Focus({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: reduce ? 0 : 0.7 });
  }, [focus, map]);
  return null;
}

function ClickCatcher() {
  const { mode, setDraftPoint } = usePlaces();
  useMapEvents({
    click(event) {
      if (mode !== "add" && mode !== "edit") return;
      setDraftPoint(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function MapView() {
  const { places, selectedId, mode, draft, focus, select, movePlace } = usePlaces();

  return (
    <MapContainer
      center={[40.12, 124.39]}
      zoom={13}
      minZoom={11}
      maxZoom={18}
      zoomControl={false}
      className="dandong-map"
    >
      <ZoomControl position="topright" />
      <Schematic />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        crossOrigin="anonymous"
        errorTileUrl="/tile-empty.png"
        maxZoom={19}
      />
      <Focus focus={focus} />
      <ClickCatcher />
      {places.map((place) => {
        const editing = mode === "edit" && draft?.id === place.id;
        const latitude = editing ? Number(draft.latitude) : place.latitude;
        const longitude = editing ? Number(draft.longitude) : place.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        const selected = place.id === selectedId;
        return (
          <Marker
            key={place.id}
            position={[latitude, longitude]}
            icon={pinIcon(editing ? draft.category : place.category, selected || editing)}
            draggable={selected || editing}
            title={place.companyName}
            eventHandlers={{
              click: () => {
                if (mode === "add") return;
                select(place.id);
              },
              dragend: (event) => {
                const point = event.target.getLatLng();
                movePlace(place.id, point.lat, point.lng);
              },
            }}
          >
            {selected && mode === "view" && (
              <Tooltip permanent direction="top" offset={[0, -12]} className="place-tip">
                <span className="tip-title">{place.companyName}</span>
                <span className="tip-zh">No. {place.companyNumber}</span>
              </Tooltip>
            )}
          </Marker>
        );
      })}
      {mode === "add" && Number.isFinite(Number(draft?.latitude)) && Number.isFinite(Number(draft?.longitude)) && (
        <Marker
          position={[Number(draft.latitude), Number(draft.longitude)]}
          icon={pinIcon(draft.category, true)}
          draggable
          zIndexOffset={500}
          eventHandlers={{
            dragend: (event) => {
              const point = event.target.getLatLng();
              movePlace("draft", point.lat, point.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
