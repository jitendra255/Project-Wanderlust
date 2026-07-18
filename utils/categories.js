// Single source of truth for place categories.
// Consumed by the Listing schema enum, the Joi request schema, the filter bar,
// and the submit/edit forms - so they can never drift apart.
//
// `priceUnit` is the default unit shown for that category, and `stay` marks the
// categories where accommodation-specific fields (gender, deposit, enquiries)
// are relevant.
const CATEGORIES = [
    { label: "Hostel", icon: "fa-building", priceUnit: "per month", stay: true },
    { label: "PG", icon: "fa-house-user", priceUnit: "per month", stay: true },
    { label: "Mess & Tiffin", icon: "fa-utensils", priceUnit: "per month" },
    { label: "Restaurant", icon: "fa-bowl-food", priceUnit: "for two" },
    { label: "Cafe & Snacks", icon: "fa-mug-hot", priceUnit: "for two" },
    { label: "Stationery & Xerox", icon: "fa-print", priceUnit: "" },
    { label: "Grocery", icon: "fa-cart-shopping", priceUnit: "" },
    { label: "Laundry", icon: "fa-shirt", priceUnit: "per month" },
    { label: "Gym", icon: "fa-dumbbell", priceUnit: "per month" },
    { label: "Medical", icon: "fa-kit-medical", priceUnit: "" },
    { label: "Bank & ATM", icon: "fa-indian-rupee-sign", priceUnit: "" },
];

const CATEGORY_LABELS = CATEGORIES.map((category) => category.label);

// Categories where someone is renting a bed, not buying a meal.
const STAY_CATEGORIES = CATEGORIES.filter((c) => c.stay).map((c) => c.label);

const PRICE_UNITS = ["per month", "per meal", "for two", "per person", "per item", ""];

module.exports = { CATEGORIES, CATEGORY_LABELS, STAY_CATEGORIES, PRICE_UNITS };
