// The campus this directory is built around. Everything is described by its
// distance from here, so this is the one place to change if it is ever reused
// for another college.
const CAMPUS = {
    name: "MBM University (MBM Engineering College)",
    shortName: "MBM",
    area: "Ratanada, Jodhpur",
    pincode: "342011",
    // [longitude, latitude] - GeoJSON order. Resolved via OpenStreetMap Nominatim.
    coordinates: [73.0348015, 26.2708162],
};

const EARTH_RADIUS_M = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in metres between two [lng, lat] pairs.
 * Straight-line, not walking distance - close enough to sort by, and honest
 * about it in the UI ("~1.2 km away").
 */
function distanceMetres([lng1, lat1], [lng2, lat2]) {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

    return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
}

/** Distance from campus, or null when a place has no coordinates. */
function distanceFromCampus(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
    return distanceMetres(CAMPUS.coordinates, coordinates);
}

/** "450 m" / "1.2 km" */
function formatDistance(metres) {
    if (metres === null || metres === undefined) return null;
    if (metres < 1000) return `${metres} m`;
    return `${(metres / 1000).toFixed(1)} km`;
}

module.exports = { CAMPUS, distanceMetres, distanceFromCampus, formatDistance };
