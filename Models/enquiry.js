const mongoose = require("mongoose");

// A question from one student to whoever added a place.
//
// Note this is deliberately not a booking: nobody reserves a mess by date
// range, and we have no account for the actual hostel owner. The useful thing
// a directory can offer is a junior asking the senior who added the entry.
const enquirySchema = new mongoose.Schema({
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "listing",
        required: true,
    },
    // Who asked.
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // Who it went to - the person who added the listing, snapshotted so the
    // thread survives the listing changing hands.
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    message: {
        type: String,
        required: true,
        maxLength: 1000,
    },
    reply: {
        type: String,
        maxLength: 1000,
    },
    repliedAt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

enquirySchema.virtual("answered").get(function () {
    return Boolean(this.reply);
});

const Enquiry = mongoose.model("Enquiry", enquirySchema);
module.exports = Enquiry;
