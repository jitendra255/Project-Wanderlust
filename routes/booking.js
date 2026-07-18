const express = require("express")
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync")
const bookingController = require("../controllers/bookings.js")
const { isLoggedIn, isBookingGuest } = require("../middleware.js")

router.post("/", isLoggedIn, wrapAsync(bookingController.create))

//cancel booking route
router.delete("/:bookingId", isLoggedIn, isBookingGuest, wrapAsync(bookingController.cancel))

module.exports = router;
