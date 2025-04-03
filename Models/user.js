const passportLocalMongoose = require('passport-local-mongoose');
const mongoose = require("mongoose")
const Schema=mongoose.Schema;

const userSchema=new Schema({
    email:{
        type:String,
        required:true,
    },
})
userSchema.plugin(passportLocalMongoose); //It will automatically add username,password with hashing and salting.

module.exports = mongoose.model("User", userSchema);