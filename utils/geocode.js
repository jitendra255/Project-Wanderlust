// Forward geocoding via OpenStreetMap Nominatim - free, no API key, no account.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
// We only call it when a listing is created or its location changes, which
// stays well inside the 1 request/second guidance.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Wanderlust/1.0 (accommodation listing demo app)";
const TIMEOUT_MS = 5000;

/**
 * Resolve "location, country" to a GeoJSON Point.
 * Returns null on any failure - geocoding is best-effort, and a listing
 * without coordinates simply renders without a map.
 */
async function geocode(location, country) {
    // Keep the suite hermetic and fast; no test should depend on a third party.
    if (process.env.NODE_ENV === "test") return null;

    const query = [location, country].filter(Boolean).join(", ").trim();
    if (!query) return null;

    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
            signal: controller.signal,
        });
        if (!response.ok) return null;

        const results = await response.json();
        if (!Array.isArray(results) || results.length === 0) return null;

        const lat = Number.parseFloat(results[0].lat);
        const lon = Number.parseFloat(results[0].lon);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

        return { type: "Point", coordinates: [lon, lat] };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Geocode a place from its landmark + area, trying progressively less specific
 * queries. Small local landmarks ("Bhaskar Circle") often are not in Nominatim
 * even when the surrounding area ("Ratanada") is, and falling back to the area
 * still puts the place on the map within a few hundred metres.
 *
 * Deliberately stops before falling back to the city itself: a pin on the wrong
 * side of Jodhpur is worse than no pin, because the distance-from-campus figure
 * would look precise and be wrong.
 */
async function geocodePlace({ landmark, location, city = "Jodhpur", region = "Rajasthan, India" }) {
    const suffix = [city, region].filter(Boolean).join(", ");

    const candidates = [
        [landmark, location].filter(Boolean).join(", "),
        location,
        landmark,
    ].filter((query) => query && query.trim());

    for (const query of candidates) {
        const point = await geocode(query, suffix);
        if (point) return point;
    }

    return null;
}

module.exports = { geocode, geocodePlace };
