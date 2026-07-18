const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "listing", // the Listing model is registered lowercase
        required: true,
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // Half-open interval [checkIn, checkOut): the checkout day is free for the
    // next guest, which is how availability works everywhere in this domain.
    checkIn: {
        type: Date,
        required: true,
    },
    checkOut: {
        type: Date,
        required: true,
    },
    guests: {
        type: Number,
        default: 1,
        min: 1,
    },
    // Snapshotted at booking time so a later price change does not rewrite history.
    totalPrice: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ["confirmed", "cancelled"],
        default: "confirmed",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// The overlap test: two half-open ranges collide when each starts before the
// other ends. Cancelled bookings free their dates.
bookingSchema.statics.findConflict = function (listingId, checkIn, checkOut, excludeId) {
    const query = {
        listing: listingId,
        status: "confirmed",
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
    };
    if (excludeId) query._id = { $ne: excludeId };
    return this.findOne(query);
};

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
