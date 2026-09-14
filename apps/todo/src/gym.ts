/**
 * 出発地と、開発サーバーの /__osm/* をつなぐブラウザー側の入口。
 */
import type { Gym, LatLon, Route } from "../osm-dev-api";

export type { Gym, LatLon, Route };
export type GymSearch = { origin: LatLon; gyms: Gym[] };
export type Trip = { gym: Gym; route: Route };

/**
 * ハッカソンのデモ用に固定した出発地。GPSの代わりに使います。
 * 座標はOpenStreetMapの「渋谷道玄坂東急ビル」（node 11436145575）です。
 */
export const ORIGIN = {
  name: "渋谷道玄坂東急ビル 1F",
  address: "東京都渋谷区道玄坂1-10-8",
  lat: 35.65718,
  lon: 139.698687,
};

async function getJson<T>(path: string, params: Record<string, number>): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`${path}?${query}`, { signal: AbortSignal.timeout(60_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "OpenStreetMapの情報を取得できませんでした。");
  return body as T;
}

export function searchGyms(origin: LatLon) {
  return getJson<{ gyms: Gym[] }>("/__osm/gyms", { lat: origin.lat, lon: origin.lon });
}

export function fetchRoute(origin: LatLon, gym: Gym) {
  return getJson<Route>("/__osm/route", {
    fromLat: origin.lat,
    fromLon: origin.lon,
    toLat: gym.lat,
    toLon: gym.lon,
  });
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}
