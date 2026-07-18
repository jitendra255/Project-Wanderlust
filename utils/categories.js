// Single source of truth for listing categories.
// Consumed by the Listing schema enum, the Joi request schema, the filter bar,
// and the create/edit forms - so they can never drift apart.
const CATEGORIES = [
    { label: "Trending", icon: "fa-fire" },
    { label: "Rooms", icon: "fa-bed" },
    { label: "Mountain Cities", icon: "fa-mountain" },
    { label: "Iconic Cities", icon: "fa-mountain-city" },
    { label: "Castles", icon: "fa-fort-awesome" },
    { label: "Pools", icon: "fa-person-swimming" },
    { label: "Camping", icon: "fa-campground" },
    { label: "Farms", icon: "fa-cow" },
    { label: "Arctic", icon: "fa-snowflake" },
    { label: "Domes", icon: "fa-landmark-dome" },
    { label: "Boats", icon: "fa-sailboat" },
];

const CATEGORY_LABELS = CATEGORIES.map((category) => category.label);

module.exports = { CATEGORIES, CATEGORY_LABELS };
