const express = require("express")
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const userController = require("../controllers/users.js")

router.route("/signup").get(userController.renderSignupForm).post(wrapAsync(userController.signup))
router.route("/login").get(userController.renderLoginForm).post(saveRedirectUrl, passport.authenticate("local", { failureRedirect: '/login', failureFlash: true }), wrapAsync(userController.login))

router.get("/profile", isLoggedIn, wrapAsync(userController.profile))

router.get("/logout", userController.logout)

module.exports = router;