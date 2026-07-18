const express = require("express")
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync")
const adminController = require("../controllers/admin.js")
const { isAdmin } = require("../middleware.js")

// Every route here is admin-only.
router.use(isAdmin);

router.get("/queue", wrapAsync(adminController.queue))

router.post("/listings/:id/approve", wrapAsync(adminController.approve))
router.post("/listings/:id/reject", wrapAsync(adminController.reject))
router.post("/listings/:id/verify", wrapAsync(adminController.verify))

module.exports = router;
