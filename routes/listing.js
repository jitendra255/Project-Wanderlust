const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync")
const { isLoggedIn, isOwner, validatelisting } = require("../middleware.js")
const listingController = require("../controllers/listings.js")
const multer = require('multer')
const { storage } = require("../CloudConfig.js")
const upload = multer({ storage })




router.route("/").get(wrapAsync(listingController.index)).post(isLoggedIn, upload.single('listing[image]'),validatelisting, wrapAsync(listingController.create));

//Search for individual listing
router.get("/search",wrapAsync(listingController.search))

router.get("/filter",wrapAsync(listingController.filter))

//New Route --> isse agar show route ke baad likh rhe to new ko id ki trh le rha tha isliye phle likha h usse
router.get("/new", isLoggedIn, listingController.new);

router.route("/:id").get(wrapAsync(listingController.show)).put(isLoggedIn, isOwner,upload.single('listing[image]'), validatelisting, wrapAsync(listingController.update)).delete(isLoggedIn, isOwner, wrapAsync(listingController.delete))

//Edit Route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.edit))


module.exports = router;
