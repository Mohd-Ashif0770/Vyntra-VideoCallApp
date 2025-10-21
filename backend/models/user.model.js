

import mongoose from "mongoose";

const userSchema = mongoose.Schema({
    name:{type: String, reqiured: true},
    username:{type:String, reqiured: true, unique:true},
    password:{type:String, reqiured:true},
    token:{type:String},
})

const User = mongoose.model("User", userSchema);

export {User};