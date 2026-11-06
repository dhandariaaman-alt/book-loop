// Location helpers. Exact coordinates stay on the server; other users only
// ever see a neighbourhood name and a rounded distance.

export const RADIUS_OPTIONS_KM = [1, 5, 10, 20] as const;
/** Largest area the home page shows books from. */
export const HOME_RADIUS_KM = 20;

/** Round to 3 decimals (~110 m) before storing, so we never keep a precise fix. */
export function coarsen(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** What other users see, e.g. "< 1 km", "3 km". */
export function formatDistance(km: number): string {
  if (km < 1) return "< 1 km";
  return `${Math.round(km)} km`;
}

/** Bounding box for a quick indexed pre-filter before the exact distance check. */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/** Look up a neighbourhood name with OpenStreetMap's free reverse geocoder. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ neighbourhood: string | null; city: string | null }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BookLoop/0.1 (community book sharing)", "Accept-Language": "en" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { neighbourhood: null, city: null };
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    return {
      neighbourhood: a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district ?? a.village ?? null,
      city: a.city ?? a.town ?? a.county ?? a.state_district ?? null,
    };
  } catch {
    return { neighbourhood: null, city: null };
  }
}
