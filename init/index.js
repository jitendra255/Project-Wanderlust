const mongoose = require("mongoose")
const initdata = require("./data.js")
const listing = require("../Models/listing.js")
async function main() {
    await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust")
}

main().then(() => {
    console.log("connected");

}).catch((err) => {
    console.log(err);

})

const initDb = async () => {
    await listing.deleteMany({});
    initdata.data = initdata.data.map((obj) => ({
        ...obj, owner: "67e8c91aed255196196a4aa9",
    }))
    await listing.insertMany(initdata.data)
    console.log("data was initialised");

}

initDb();