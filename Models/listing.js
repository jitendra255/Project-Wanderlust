const mongoose = require("mongoose")
const Review = require("./review.js")
const { CATEGORY_LABELS, PRICE_UNITS } = require("../utils/categories.js")
const { distanceFromCampus } = require("../utils/campus.js")

const listingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    image: {
        url: String,
        filename: String,
    },
    price: {
        type: Number,
    },
    // What the price actually means - a mess is per month, a restaurant is for two.
    priceUnit: {
        type: String,
        enum: PRICE_UNITS,
        default: "",
    },
    location: {
        type: String,
    },
    // Nearest recognisable landmark, which is how people actually navigate here.
    landmark: {
        type: String,
    },
    country: {
        type: String,
        default: "India",
    },
    phone: {
        type: String,
    },
    // Stored separately: click-to-chat matters more than calling for most students.
    whatsapp: {
        type: String,
    },
    timings: {
        type: String,
    },
    vegOnly: {
        type: Boolean,
        default: false,
    },
    // Accommodation only.
    gender: {
        type: String,
        enum: ["Boys", "Girls", "Co-ed", ""],
        default: "",
    },
    deposit: {
        type: Number,
    },
    amenities: [{
        type: String,
    }],
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
    },
    ],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    category: {
        type: String,
        enum: CATEGORY_LABELS,
    },
    // GeoJSON Point. Optional - a place without coordinates renders without a map.
    geometry: {
        type: {
            type: String,
            enum: ["Point"],
        },
        coordinates: {
            type: [Number], // [longitude, latitude] - GeoJSON order
        },
    },
    // Cached so the listing grid can sort by proximity without recomputing.
    distanceFromCampus: {
        type: Number,
    },
    // Where this entry came from. OSM entries are a skeleton, not checked facts.
    source: {
        type: String,
        enum: ["osm", "student"],
        default: "student",
    },
    osmId: {
        type: String, // e.g. "node/123456" - lets a re-import update instead of duplicate
        index: true,
    },
    // Set once a human has actually confirmed the details on the ground.
    verified: {
        type: Boolean,
        default: false,
    },
    verifiedAt: {
        type: Date,
    },
    // Entries about real businesses are moderated before going public.
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

// Keep the cached distance in step with the coordinates, however they were set.
listingSchema.pre("save", function (next) {
    if (this.geometry && this.geometry.coordinates) {
        this.distanceFromCampus = distanceFromCampus(this.geometry.coordinates);
    }
    next();
})

listingSchema.post("findOneAndDelete", async (listing) => {       //when we delete a listing it's review should also get deleted.
    if (listing) {
        await Review.deleteMany({ _id: { $in: listing.reviews } })
    }
})

const Listing = mongoose.model("listing", listingSchema);
module.exports = Listing;
