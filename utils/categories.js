// Single source of truth for place categories.
// Consumed by the Listing schema enum, the Joi request schema, the filter bar,
// and the submit/edit forms - so they can never drift apart.
//
// `priceUnit` is the default unit shown for that category, and `stay` marks the
// categories where accommodation-specific fields (gender, deposit, enquiries)
// are relevant.
//
// `stockImage` is a generic, freely-licensed picture of the *category* - never
// of any particular shop. It is always labelled as such in the UI, because a
// stock photo passed off as a real place misleads people the same way an
// invented phone number would. A real uploaded photo always beats it, and
// `tint` is the final fallback if the image itself fails to load.
//
// All stock images come from Wikimedia Commons under the licence recorded
// alongside them; attribution is rendered on the page.
const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/thumb";

const CATEGORIES = [
    {
        label: "Hostel",
        icon: "fa-building",
        priceUnit: "per month",
        stay: true,
        tint: "#5B6ABF",
        stockImage: `${COMMONS}/e/ef/Banff_Avenue%2C_Banff_%287889960184%29.jpg/960px-Banff_Avenue%2C_Banff_%287889960184%29.jpg`,
        stockLicence: "CC BY-SA 2.0",
    },
    {
        label: "PG",
        icon: "fa-house-user",
        priceUnit: "per month",
        stay: true,
        tint: "#7A5BBF",
        stockImage: `${COMMONS}/d/d8/Tiny_hotel_rooms_%287937963592%29.jpg/960px-Tiny_hotel_rooms_%287937963592%29.jpg`,
        stockLicence: "CC BY 2.0",
    },
    {
        label: "Mess & Tiffin",
        icon: "fa-utensils",
        priceUnit: "per month",
        tint: "#E07A28",
        stockImage: `${COMMONS}/4/46/Darjeeling%2C_India%2C_Indian_Thali_meal.jpg/960px-Darjeeling%2C_India%2C_Indian_Thali_meal.jpg`,
        stockLicence: "CC BY 4.0",
    },
    {
        label: "Restaurant",
        icon: "fa-bowl-food",
        priceUnit: "for two",
        tint: "#D6453D",
        // Bikaner is in Rajasthan - closer to what a Jodhpur student actually eats
        // than the South Indian dish this used to show.
        stockImage: `${COMMONS}/6/6a/Bikaner_chole_bhature.jpg/960px-Bikaner_chole_bhature.jpg`,
        stockLicence: "CC BY-SA 4.0",
    },
    {
        label: "Cafe & Snacks",
        icon: "fa-mug-hot",
        priceUnit: "for two",
        tint: "#A9713C",
        stockImage: `${COMMONS}/b/bd/South_India_tea-MB48.jpg/960px-South_India_tea-MB48.jpg`,
        stockLicence: "CC BY-SA 4.0",
    },
    {
        label: "Stationery & Xerox",
        icon: "fa-print",
        priceUnit: "",
        tint: "#3F7FA6",
        stockImage: `${COMMONS}/e/e2/Emerging_professions-_stationery_store_%288347831015%29.jpg/960px-Emerging_professions-_stationery_store_%288347831015%29.jpg`,
        stockLicence: "CC BY 2.0",
    },
    {
        label: "Grocery",
        icon: "fa-cart-shopping",
        priceUnit: "",
        tint: "#3F8F6B",
        stockImage: `${COMMONS}/5/54/Market_Hyderabad.jpg/960px-Market_Hyderabad.jpg`,
        stockLicence: "Public domain",
    },
    {
        label: "Laundry",
        icon: "fa-shirt",
        priceUnit: "per month",
        tint: "#4A8FA8",
        stockImage: `${COMMONS}/9/98/Open_top-loading_washing_machine.jpg/960px-Open_top-loading_washing_machine.jpg`,
        stockLicence: "CC BY-SA 4.0",
    },
    {
        label: "Gym",
        icon: "fa-dumbbell",
        priceUnit: "per month",
        tint: "#5A5A5A",
        stockImage: `${COMMONS}/8/82/Gymnasium_perspective.jpg/960px-Gymnasium_perspective.jpg`,
        stockLicence: "CC BY-SA 4.0",
    },
    {
        label: "Medical",
        icon: "fa-kit-medical",
        priceUnit: "",
        tint: "#C24C63",
        stockImage: `${COMMONS}/8/8f/Pharmacy%2C_shop_interior%2C_counter%2C_work_Fortepan_74179.jpg/960px-Pharmacy%2C_shop_interior%2C_counter%2C_work_Fortepan_74179.jpg`,
        stockLicence: "CC BY-SA 3.0",
    },
    {
        label: "Bank & ATM",
        icon: "fa-indian-rupee-sign",
        priceUnit: "",
        tint: "#2F6E8F",
        stockImage: `${COMMONS}/3/31/ATM-Croatia-2024.jpg/960px-ATM-Croatia-2024.jpg`,
        stockLicence: "CC0",
    },
];

const CATEGORY_LABELS = CATEGORIES.map((category) => category.label);

// Categories where someone is renting a bed, not buying a meal.
const STAY_CATEGORIES = CATEGORIES.filter((c) => c.stay).map((c) => c.label);

const PRICE_UNITS = ["per month", "per meal", "for two", "per person", "per item", ""];

/** Look up a category's config by label, with a safe fallback. */
function categoryMeta(label) {
    return (
        CATEGORIES.find((category) => category.label === label) || {
            label: label || "Place",
            icon: "fa-location-dot",
            priceUnit: "",
            tint: "#6c757d",
            stockImage: null,
            stockLicence: null,
        }
    );
}

module.exports = { CATEGORIES, CATEGORY_LABELS, STAY_CATEGORIES, PRICE_UNITS, categoryMeta };
