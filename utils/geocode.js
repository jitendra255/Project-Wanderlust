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

module.exports = { geocode };
