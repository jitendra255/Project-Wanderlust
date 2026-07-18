// Single source of truth for place categories.
// Consumed by the Listing schema enum, the Joi request schema, the filter bar,
// and the submit/edit forms - so they can never drift apart.
//
// `priceUnit` is the default unit shown for that category, and `stay` marks the
// categories where accommodation-specific fields (gender, deposit, enquiries)
// are relevant.
// `tint` is used for the placeholder card shown when a place has no photo yet -
// which is most of them, because OpenStreetMap carries no photos for anywhere
// near this campus and we will not attach stock images to real businesses.
// A distinct colour per category makes the grid scannable instead of grey.
const CATEGORIES = [
    { label: "Hostel", icon: "fa-building", priceUnit: "per month", stay: true, tint: "#5B6ABF" },
    { label: "PG", icon: "fa-house-user", priceUnit: "per month", stay: true, tint: "#7A5BBF" },
    { label: "Mess & Tiffin", icon: "fa-utensils", priceUnit: "per month", tint: "#E07A28" },
    { label: "Restaurant", icon: "fa-bowl-food", priceUnit: "for two", tint: "#D6453D" },
    { label: "Cafe & Snacks", icon: "fa-mug-hot", priceUnit: "for two", tint: "#A9713C" },
    { label: "Stationery & Xerox", icon: "fa-print", priceUnit: "", tint: "#3F7FA6" },
    { label: "Grocery", icon: "fa-cart-shopping", priceUnit: "", tint: "#3F8F6B" },
    { label: "Laundry", icon: "fa-shirt", priceUnit: "per month", tint: "#4A8FA8" },
    { label: "Gym", icon: "fa-dumbbell", priceUnit: "per month", tint: "#5A5A5A" },
    { label: "Medical", icon: "fa-kit-medical", priceUnit: "", tint: "#C24C63" },
    { label: "Bank & ATM", icon: "fa-indian-rupee-sign", priceUnit: "", tint: "#2F6E8F" },
];

/** Look up a category's config by label, with a safe fallback. */
function categoryMeta(label) {
    return (
        CATEGORIES.find((category) => category.label === label) ||
        { label: label || "Place", icon: "fa-location-dot", priceUnit: "", tint: "#6c757d" }
    );
}

const CATEGORY_LABELS = CATEGORIES.map((category) => category.label);

// Categories where someone is renting a bed, not buying a meal.
const STAY_CATEGORIES = CATEGORIES.filter((c) => c.stay).map((c) => c.label);

const PRICE_UNITS = ["per month", "per meal", "for two", "per person", "per item", ""];

module.exports = { CATEGORIES, CATEGORY_LABELS, STAY_CATEGORIES, PRICE_UNITS, categoryMeta };
