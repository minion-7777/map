"use client";

import { useEffect, useState } from "react";
import { MapContainer, GeoJSON, Marker, Rectangle, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { usePlaces } from "./PlacesProvider";
import { categoryTone } from "../lib/validate";
import basemap from "../data/basemap.json";

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

function basemapPoint(feature, latlng) {
  return L.circleMarker(latlng, {
    interactive: false,
    radius: 5,
    color: "#8d5a34",
    weight: 1.2,
    fillColor: "#f3d7b0",
    fillOpacity: 1,
  });
}

function basemapStyle(feature) {
  const kind = feature.properties?.kind;
  const line = String(feature.geometry?.type || "").includes("Line");
  const quiet = { interactive: false };
  if (kind === "water") {
    return line
      ? { ...quiet, color: "#3f7f96", weight: 1.8, opacity: 0.95 }
      : { ...quiet, color: "#6eabc2", weight: 0.4, fillColor: "#7eb4c8", fillOpacity: 0.92 };
  }
  if (kind === "green") {
    return { ...quiet, color: "#b7c9aa", weight: 0.4, fillColor: "#c5d6b6", fillOpacity: 0.9 };
  }
  if (kind === "urban") {
    return { ...quiet, color: "#ddd0bc", weight: 0.4, fillColor: "#e6dccb", fillOpacity: 0.75 };
  }
  if (kind === "building" || kind === "landmark") {
    return { ...quiet, color: "#c2b29c", weight: 0.45, fillColor: "#f6f0e6", fillOpacity: 0.95 };
  }
  if (kind === "major") return { ...quiet, color: "#c65b2e", weight: 2.6, opacity: 0.95 };
  if (kind === "road") return { ...quiet, color: "#a67c52", weight: 1.7, opacity: 0.9 };
  if (kind === "rail") return { ...quiet, color: "#4e5d66", weight: 1.3, opacity: 0.75, dashArray: "5 4" };
  if (kind === "path") return { ...quiet, color: "#c4b8a6", weight: 0.7, opacity: 0.75 };
  return { ...quiet, color: "#b7ab9c", weight: 1.05, opacity: 0.9 };
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

const NAME_ZOOM = { major: 12, road: 13, street: 13, water: 13, rail: 14, urban: 14, green: 15, building: 14, path: 16 };
const NAME_RANK = { major: 0, road: 1, water: 1, street: 2, rail: 3, urban: 4, green: 4, building: 4, path: 5 };
const NAME_ICONS = {};

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function lineAnchor(geometry) {
  const lines = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  let best = 0;
  let lat = 0;
  let lng = 0;
  let angle = 0;
  lines.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const dx = line[index][0] - line[index - 1][0];
      const dy = line[index][1] - line[index - 1][1];
      const midLat = (line[index][1] + line[index - 1][1]) / 2;
      const dxm = dx * Math.cos((midLat * Math.PI) / 180);
      const length = Math.hypot(dxm, dy);
      if (length <= best) continue;
      best = length;
      lng = (line[index][0] + line[index - 1][0]) / 2;
      lat = midLat;
      let degrees = (Math.atan2(-dy, dxm) * 180) / Math.PI;
      if (degrees > 90) degrees -= 180;
      if (degrees < -90) degrees += 180;
      angle = degrees;
    }
  });
  if (!best) return null;
  return { lat, lng, angle, length: best };
}

function areaAnchor(geometry) {
  const ring = (geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates[0])[0];
  if (!ring || ring.length < 3) return null;
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const count = closed ? ring.length - 1 : ring.length;
  let lng = 0;
  let lat = 0;
  for (let index = 0; index < count; index += 1) {
    lng += ring[index][0];
    lat += ring[index][1];
  }
  return { lng: lng / count, lat: lat / count, angle: 0, length: 1 };
}

const NAME_LABELS = basemap.features.flatMap((feature, index) => {
  const name = feature.properties?.name;
  const kind = feature.properties?.kind;
  if (!name || NAME_ZOOM[kind] == null) return [];
  const line = String(feature.geometry?.type || "").includes("Line");
  const anchor = line ? lineAnchor(feature.geometry) : areaAnchor(feature.geometry);
  if (!anchor) return [];
  return [{ id: index, name, kind, minZoom: NAME_ZOOM[kind], rank: NAME_RANK[kind], line, ...anchor }];
});

function nameIcon(item) {
  const angle = item.line ? Math.round(item.angle) : 0;
  const key = `${item.kind}:${angle}:${item.name}`;
  if (!NAME_ICONS[key]) {
    NAME_ICONS[key] = L.divIcon({
      className: `map-name map-name-${item.kind}`,
      html: `<span style="transform:translate(-50%,-50%) rotate(${angle}deg)">${escapeHtml(item.name)}</span>`,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    });
  }
  return NAME_ICONS[key];
}

function NameLabels() {
  const map = useMap();
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    if (!map.getPane("names")) {
      const pane = map.createPane("names");
      pane.style.zIndex = "450";
      pane.style.pointerEvents = "none";
    }
    const update = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds().pad(0.2);
      const placed = [];
      const visible = [];
      const candidates = NAME_LABELS.filter((item) => zoom >= item.minZoom && bounds.contains([item.lat, item.lng]));
      candidates.sort((a, b) => {
        if (zoom >= 14 && a.line !== b.line) return a.line ? 1 : -1;
        return a.rank - b.rank || b.length - a.length;
      });
      const pixelsPerDegree = (256 * 2 ** zoom) / 360;
      candidates.forEach((item) => {
        if (item.line && item.length * pixelsPerDegree < 56) return;
        const point = map.latLngToContainerPoint([item.lat, item.lng]);
        const crowded = placed.some((other) => {
          const distance = Math.hypot(other.x - point.x, other.y - point.y);
          if (other.name === item.name) return distance < 110;
          if (!item.line || !other.line) return distance < 16;
          return distance < 48;
        });
        if (crowded || visible.length >= 180) return;
        placed.push({ x: point.x, y: point.y, name: item.name });
        visible.push(item);
      });
      setLabels(visible);
    };
    update();
    map.on("moveend zoomend", update);
    return () => map.off("moveend zoomend", update);
  }, [map]);

  return labels.map((item) => (
    <Marker key={item.id} pane="names" position={[item.lat, item.lng]} icon={nameIcon(item)} interactive={false} />
  ));
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
      <GeoJSON data={basemap} style={basemapStyle} pointToLayer={basemapPoint} />
      <NameLabels />
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
              <Tooltip permanent direction="top" offset={[0, -14]} className="place-tip">
                <span>번호: {place.companyNumber}</span>
                <span>업종: {place.category}</span>
                <span>회사명: {place.companyName}</span>
                <span>종업원수: {place.employeeCount.toLocaleString()} 명</span>
                <span>주소: {place.address}</span>
                <span>
                  위치: {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                </span>
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
