import json
import sqlite3
import struct
from pathlib import Path

SOURCE = Path(r"D:\00_Work\00_Projects\Map\DanDong.gpkg")
TARGET = Path(__file__).with_name("basemap.json")
WEST, SOUTH, EAST, NORTH = 124.15, 39.95, 124.65, 40.35
MAX_SPAN = 1.0
ENVELOPE_DOUBLES = {0: 0, 1: 4, 2: 6, 3: 6, 4: 8}
GEO_TYPES = {1: "Point", 2: "LineString", 3: "Polygon", 4: "MultiPoint", 5: "MultiLineString", 6: "MultiPolygon"}
MAJOR = {"motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"}
ROAD = {"secondary", "secondary_link", "tertiary", "tertiary_link"}
STREET = {"residential", "unclassified", "living_street", "service", "pedestrian"}
PATH = {"footway", "path", "track", "cycleway", "steps"}
GREEN_LAND = {
    "forest",
    "grass",
    "meadow",
    "orchard",
    "farmland",
    "recreation_ground",
    "flowerbed",
    "cemetery",
    "village_green",
    "greenhouse_horticulture",
    "allotments",
}
INDUSTRIAL = {"industrial", "warehouse", "hangar", "storage_tank", "bunker", "construction", "barn", "farm_auxiliary"}


def header(blob):
    if not blob or blob[:2] != b"GP":
        return None
    flags = blob[3]
    if flags & 0x10:
        return None
    indicator = (flags >> 1) & 0x07
    count = ENVELOPE_DOUBLES.get(indicator, 0)
    endian = "<" if flags & 0x01 else ">"
    box = None
    if count >= 4:
        minx, maxx, miny, maxy = struct.unpack_from(endian + "dddd", blob, 8)
        box = (minx, maxx, miny, maxy)
    return box, blob[8 + count * 8 :]


def hits(box):
    if not box:
        return False
    minx, maxx, miny, maxy = box
    if maxx < WEST or minx > EAST or maxy < SOUTH or miny > NORTH:
        return False
    return max(maxx - minx, maxy - miny) <= MAX_SPAN


def read_wkb(data, offset):
    endian = "<" if data[offset] == 1 else ">"
    offset += 1
    kind = struct.unpack_from(endian + "I", data, offset)[0]
    offset += 4
    if kind & 0x20000000:
        offset += 4
    kind = kind & 0xFF
    geometry, offset = read_body(data, endian, offset, kind)
    return GEO_TYPES.get(kind), geometry, offset


def read_body(data, endian, offset, kind):
    if kind == 1:
        x, y = struct.unpack_from(endian + "dd", data, offset)
        return [round(x, 6), round(y, 6)], offset + 16
    if kind == 2:
        count = struct.unpack_from(endian + "I", data, offset)[0]
        offset += 4
        coords = []
        for _ in range(count):
            x, y = struct.unpack_from(endian + "dd", data, offset)
            coords.append([round(x, 6), round(y, 6)])
            offset += 16
        return coords, offset
    if kind == 3:
        rings = struct.unpack_from(endian + "I", data, offset)[0]
        offset += 4
        polygon = []
        for _ in range(rings):
            ring, offset = read_body(data, endian, offset, 2)
            polygon.append(ring)
        return polygon, offset
    if kind in (4, 5, 6, 7):
        count = struct.unpack_from(endian + "I", data, offset)[0]
        offset += 4
        parts = []
        for _ in range(count):
            _, part, offset = read_wkb(data, offset)
            parts.append(part)
        return parts, offset
    raise ValueError(f"unsupported geometry {kind}")


def feature_kind(tags):
    if tags.get("type") in ("route", "boundary", "watershed", "collection", "network"):
        return None
    if tags.get("natural") in ("water", "coastline", "bay", "wetland", "strait") or tags.get("waterway") or tags.get("water"):
        return "water"
    railway = tags.get("railway")
    if railway in ("rail", "subway", "light_rail", "narrow_gauge", "tram"):
        return "rail"
    if railway == "platform":
        return "urban"
    highway = tags.get("highway")
    if highway in MAJOR:
        return "major"
    if highway in ROAD:
        return "road"
    if highway in STREET:
        return "street"
    if highway in PATH:
        return "path"
    building = tags.get("building")
    if building == "greenhouse":
        return "green"
    if building in INDUSTRIAL:
        return "urban"
    if building:
        return "building"
    natural = tags.get("natural")
    landuse = tags.get("landuse")
    leisure = tags.get("leisure")
    if natural in ("wood", "scrub", "grassland", "heath", "tree_row") or landuse in GREEN_LAND or leisure in (
        "park",
        "garden",
        "pitch",
        "nature_reserve",
        "golf_course",
    ):
        return "green"
    if landuse or leisure:
        return "urban"
    return None


def main():
    connection = sqlite3.connect(SOURCE)
    features = []
    for geom, raw_tags in connection.execute("SELECT geom, tags FROM Dandong WHERE osm_type != 'nodes'"):
        parsed = header(geom)
        if not parsed or not hits(parsed[0]):
            continue
        try:
            tags = json.loads(raw_tags or "{}")
        except json.JSONDecodeError:
            continue
        kind = feature_kind(tags)
        if not kind:
            continue
        geo_type, coordinates, _ = read_wkb(parsed[1], 0)
        if not geo_type or geo_type == "Point":
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"kind": kind, "name": tags.get("name") or ""},
                "geometry": {"type": geo_type, "coordinates": coordinates},
            }
        )

    order = {"water": 0, "green": 1, "urban": 2, "building": 3, "path": 4, "street": 5, "road": 6, "major": 7, "rail": 8}
    features.sort(key=lambda feature: order.get(feature["properties"]["kind"], 9))
    TARGET.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"features={len(features)} bytes={TARGET.stat().st_size}")


if __name__ == "__main__":
    main()
