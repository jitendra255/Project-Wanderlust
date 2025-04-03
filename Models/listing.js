const { ref } = require("joi");
const mongoose = require("mongoose")
const Review = require("./review.js")

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
    location: {
        type: String,
    },
    country: {
        type: String,
    },
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
        enum: ["Trending", "Rooms", "Mountain Cities", "Iconic Cities", "Castles", "Pools", "Camping", "Farms", "Arctic", "Domes", "Boats"],
    }
})

listingSchema.post("findOneAndDelete", async (listing) => {       //when we delete a listing it's review should also get deleted.
    if (listing) {
        await Review.deleteMany({ _id: { $in: listing.reviews } })
    }
})

const Listing = mongoose.model("listing", listingSchema);
module.exports = Listing;