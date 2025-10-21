import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

 export const connectDB = async()=>{
    try{
        await mongoose.connect(process.env.MongoDb_URL);
        console.log("✅ MongoDB Connected Successfully");
    }catch(error){
        console.log("❌ MongoDB Connection Failed:", error.message);

    }
}

