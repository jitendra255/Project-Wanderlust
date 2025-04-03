const express = require("express")
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync")
const reviewController = require("../controllers/reviews.js")
const { validatereview, isLoggedIn, isReviewAuthor } = require("../middleware.js")

router.post("/", isLoggedIn, validatereview, wrapAsync(reviewController.create))

//delete review route
router.delete("/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(reviewController.delete))

module.exports = router;
