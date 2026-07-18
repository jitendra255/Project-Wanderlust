if (process.env.NODE_ENV != "production") {
    require('dotenv').config()
}
const express = require("express")
const app = express()
const mongoose = require("mongoose")
const path = require("path")
const methodoverride = require("method-override")
const ejsMate = require("ejs-mate")
const ExpressError = require("./utils/ExpressError")
const session = require("express-session")
const MongoStore = require('connect-mongo');
const flash = require("connect-flash")
const passport = require("passport")
const LocalStrategy = require("passport-local")
const User = require("./Models/user.js")

const listingRouter = require("./routes/listing.js")
const reviewRouter = require("./routes/review.js")
const userRouter = require("./routes/user.js")
const enquiryRouter = require("./routes/enquiry.js")
const adminRouter = require("./routes/admin.js")


const { CATEGORIES } = require("./utils/categories.js")
const { CAMPUS, formatDistance } = require("./utils/campus.js")

app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"));
// Available to every view: the filter bar, the submit/edit forms, and the
// "x m from campus" labels that appear on nearly every page.
app.locals.categories = CATEGORIES;
app.locals.campus = CAMPUS;
app.locals.formatDistance = formatDistance;
app.use(express.static(path.join(__dirname, "/public")))
app.use(express.urlencoded({ extended: true }))
app.use(methodoverride("_method"))
app.engine('ejs', ejsMate);

const dbUrl = process.env.ATLASDB_URL;

if (!dbUrl || !process.env.SECRET) {
    console.error("Missing ATLASDB_URL or SECRET. Copy .env.example to .env and fill it in.");
    process.exit(1);
}

async function main() {
    await mongoose.connect(dbUrl)
}

main().then(() => {
    console.log("connected");

}).catch((err) => {
    console.log(err);

})

const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET
    },
    touchAfter: 24 * 3600,
})

store.on("error",()=>{
    console.log('error in mongo session store');
    
})

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
}

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
})


app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/listings/:id/enquiries", enquiryRouter);
app.use("/admin", adminRouter);
app.use("/", userRouter);



app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found!!"));

})

app.use((err, req, res, next) => {
    let { status = 500, message = "Something went wrong" } = err;

    // Log server faults. Without this a 500 leaves no trace anywhere and the
    // only symptom is a blank error page.
    if (status >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, err);
    }

    res.status(status).render("error.ejs", { err })
})

const port = process.env.PORT || 2000;

// Under test the app is driven in-process by supertest, so binding a port
// would just leave an open handle behind.
if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => {
        console.log(`Listening on port ${port}`);

    });
}

module.exports = app;
