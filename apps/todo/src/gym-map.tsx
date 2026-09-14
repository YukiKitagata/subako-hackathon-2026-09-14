import { useEffect } from "react";
import { latLngBounds } from "leaflet";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { ORIGIN, type GymSearch, type Trip } from "./gym";
import "leaflet/dist/leaflet.css";

/** 検索や経路が変わったときだけ、現在地・候補・経路が収まるように寄せます。 */
function FitBounds({ search, trip }: { search: GymSearch; trip: Trip | null }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = trip
      ? trip.route.coordinates
      : [[search.origin.lat, search.origin.lon], ...search.gyms.map((gym): [number, number] => [gym.lat, gym.lon])];
    if (points.length) map.fitBounds(latLngBounds(points), { padding: [36, 36], maxZoom: 17 });
  }, [map, search, trip]);
  return null;
}

export function GymMap({ search, trip }: { search: GymSearch; trip: Trip | null }) {
  return (
    <MapContainer
      center={[search.origin.lat, search.origin.lon]}
      zoom={15}
      scrollWheelZoom={false}
      className="gym-map-leaflet"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.openstreetmap.org/fixthemap">地図の誤りを報告</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds search={search} trip={trip} />
      {trip && (
        <Polyline
          positions={trip.route.coordinates}
          pathOptions={{ color: "#344d33", weight: 5, opacity: 0.85 }}
        />
      )}
      {search.gyms.map((gym) => {
        const selected = gym.id === trip?.gym.id;
        return (
          <CircleMarker
            key={`${gym.id}-${selected}`}
            center={[gym.lat, gym.lon]}
            radius={selected ? 9 : 6}
            pathOptions={{ color: "#fffefa", weight: 2, fillColor: selected ? "#344d33" : "#829b65", fillOpacity: 1 }}
          >
            <Tooltip permanent={selected} direction="top">{gym.name}</Tooltip>
          </CircleMarker>
        );
      })}
      <CircleMarker
        center={[search.origin.lat, search.origin.lon]}
        radius={7}
        pathOptions={{ color: "#fffefa", weight: 3, fillColor: "#2f6fb0", fillOpacity: 1 }}
      >
        <Tooltip direction="top">現在地（{ORIGIN.name}）</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
