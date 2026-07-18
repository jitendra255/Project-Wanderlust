const passportLocalMongoose = require('passport-local-mongoose');
const mongoose = require("mongoose")
const Schema=mongoose.Schema;

const userSchema=new Schema({
    email:{
        type:String,
        required:true,
    },
    // Admins moderate the submission queue. Granted with `npm run make-admin <username>`.
    isAdmin:{
        type:Boolean,
        default:false,
    },
})
userSchema.plugin(passportLocalMongoose); //It will automatically add username,password with hashing and salting.

module.exports = mongoose.model("User", userSchema);