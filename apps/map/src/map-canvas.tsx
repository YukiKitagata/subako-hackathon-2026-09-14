import { useEffect, useMemo, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { SHIBUYA_STATION, type MapItem } from "./domain";
import type { MapApp } from "./use-map-app";
import "leaflet/dist/leaflet.css";

function FollowSelection({
  items,
  selectedId,
}: {
  items: MapItem[];
  selectedId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    const selected = items.find((item) => item.id === selectedId);
    if (selected)
      map.flyTo(
        [selected.position.lat, selected.position.lng],
        Math.max(map.getZoom(), 16),
        { duration: 0.5 },
      );
    else if (items.length)
      map.fitBounds(
        latLngBounds(
          items.map((item) => [item.position.lat, item.position.lng]),
        ),
        { padding: [50, 50], maxZoom: 15 },
      );
  }, [map, items, selectedId]);
  return null;
}

function OfflineMap({ app }: { app: MapApp }) {
  const items = app.state.items;
  const points = [SHIBUYA_STATION, ...items.map((item) => item.position)];
  const minLat = Math.min(...points.map((point) => point.lat));
  const maxLat = Math.max(...points.map((point) => point.lat));
  const minLng = Math.min(...points.map((point) => point.lng));
  const maxLng = Math.max(...points.map((point) => point.lng));
  const xy = (point: MapItem["position"]) => [
    60 + ((point.lng - minLng) / Math.max(maxLng - minLng, 0.008)) * 520,
    320 - ((point.lat - minLat) / Math.max(maxLat - minLat, 0.008)) * 260,
  ];
  const visits = app.state.visitIds.flatMap(
    (id) => items.find((item) => item.id === id) ?? [],
  );
  const line = [SHIBUYA_STATION, ...visits.map((item) => item.position)]
    .map((point) => xy(point).join(","))
    .join(" ");
  return (
    <div className="map-offline">
      <svg
        viewBox="0 0 640 390"
        role="img"
        aria-label="地点の位置関係。道路のない概略図です。"
      >
        <defs>
          <pattern
            id="map-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#dce2d6"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="640" height="390" fill="url(#map-grid)" />
        {visits.length > 0 && (
          <polyline
            points={line}
            fill="none"
            stroke="#547763"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
        )}
        {items.map((item, index) => {
          const [cx, cy] = xy(item.position);
          return (
            <g key={item.id}>
              <circle
                cx={cx}
                cy={cy}
                r="17"
                fill={
                  app.state.candidateIds.includes(item.id)
                    ? "#b86c38"
                    : "#244d3d"
                }
              />
              <text
                x={cx}
                y={cy + 5}
                textAnchor="middle"
                fill="white"
                fontSize="13"
              >
                {index + 1}
              </text>
            </g>
          );
        })}
        <text x="20" y="375" fill="#566554" fontSize="12">
          位置関係のみ・地理的な縮尺は一定ではありません
        </text>
      </svg>
      <p>地図画像を使わずに表示中です。地点は一覧から選べます。</p>
    </div>
  );
}

export function MapCanvas({ app }: { app: MapApp }) {
  const [offline, setOffline] = useState(false);
  const [tileError, setTileError] = useState(false);
  const icons = useMemo(
    () =>
      app.state.items.map((item, index) =>
        divIcon({
          className: "map-pin-shell",
          html: `<span class="map-pin${app.state.candidateIds.includes(item.id) ? " is-candidate" : ""}${app.state.selectedId === item.id ? " is-active" : ""}">${index + 1}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      ),
    [app.state.items, app.state.candidateIds, app.state.selectedId],
  );
  const visitItems = app.state.visitIds.flatMap(
    (id) => app.state.items.find((item) => item.id === id) ?? [],
  );
  const segments = app.getVisitSummary().segments;
  return (
    <section className="map-canvas" aria-label="地点の地図">
      <div className="map-mode">
        <span>{offline ? "概略図" : "渋谷から、ひと歩き。"}</span>
        <button type="button" onClick={() => setOffline(!offline)}>
          {offline ? "地図を表示" : "概略図に切替"}
        </button>
      </div>
      {offline ? (
        <OfflineMap app={app} />
      ) : (
        <MapContainer
          center={[SHIBUYA_STATION.lat, SHIBUYA_STATION.lng]}
          zoom={15}
          scrollWheelZoom={false}
          className="map-leaflet"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <FollowSelection
            items={app.state.items}
            selectedId={app.state.selectedId}
          />
          <Marker
            position={[SHIBUYA_STATION.lat, SHIBUYA_STATION.lng]}
            icon={divIcon({
              className: "map-station",
              html: "<span>渋谷駅</span>",
              iconSize: [56, 25],
              iconAnchor: [28, 12],
            })}
          >
            <Tooltip>出発地点：渋谷駅（概算）</Tooltip>
          </Marker>
          {app.state.items.map((item, index) => (
            <Marker
              key={item.id}
              position={[item.position.lat, item.position.lng]}
              icon={icons[index]}
              eventHandlers={{ click: () => app.selectItem(item.id) }}
            >
              <Tooltip>{item.name}</Tooltip>
            </Marker>
          ))}
          {segments.map((segment, index) => (
            <Polyline
              key={`${index}-${segment.from}-${segment.to}`}
              positions={segment.coordinates.map(
                ([lng, lat]): [number, number] => [lat!, lng!],
              )}
              pathOptions={{
                color: "#416753",
                weight: 4,
                dashArray: "7 9",
              }}
            />
          ))}
        </MapContainer>
      )}
      {tileError && !offline && (
        <div className="map-tile-notice">
          地図画像を取得できない場合は「概略図に切替」を使えます。
        </div>
      )}
      {visitItems.length > 0 && (
        <div className="map-legend">
          <span />{" "}
          点線は訪問順です。徒歩経路ではありません。
        </div>
      )}
    </section>
  );
}
