
import mongoose from "mongoose";

const meetingSchema = mongoose.Schema({
    user_id:{type: String,},
    meetingCode:{type:String, reqiured: true},
    date:{type:Date, default: Date.now, reqiured:true},
})

const Meeting = mongoose.model("Meeting", meetingSchema);

export {Meeting};