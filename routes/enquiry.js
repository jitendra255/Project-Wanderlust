const express = require("express")
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync")
const enquiryController = require("../controllers/enquiries.js")
const { isLoggedIn } = require("../middleware.js")

router.post("/", isLoggedIn, wrapAsync(enquiryController.create))

//reply to an enquiry addressed to you
router.post("/:enquiryId/reply", isLoggedIn, wrapAsync(enquiryController.reply))

module.exports = router;
