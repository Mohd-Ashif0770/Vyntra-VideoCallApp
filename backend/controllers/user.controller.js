import { User } from "../models/user.model.js";
import { StatusCodes, ReasonPhrases } from "http-status-codes";
import jwt from "jsonwebtoken"
import crypto from "crypto"
import bcrypt from "bcrypt"


const Register = async(req, res)=>{
    const {name, username, password} = req.body;

    try{
        const existingUser = await User.findOne({username})
        if(existingUser){
            return res.status(StatusCodes.CONFLICT).json({message:`User already exist!`})
        }

        const hash = await bcrypt.hash(password, 10);

        const newUser = await new User({
            name:name,
            username:username,
            password:hash
        })

        await newUser.save();
        res.status(StatusCodes.CREATED).json({message:"new your created"})

    }catch(err){
        res.json({message:`Something went wrong ${err}`});
    }
}


const Login = async(req, res)=>{
    const {username, password}= req.body;
    if(!username || !password){
        return res.status(400).json({message:"Please provide all information"})
    }
    
    try{
        const user = await User.findOne({username});
        if(!user){
            return res.status(404).json({message:"User not found"})
        }

        const result = bcrypt.compare(password, user.password);
        if(!result){
             return res.status(400).json({message:"Incorrect credentails"})
        }

        const token = crypto.randomBytes(20).toString("hex");
        user.token = token;
        await user.save();
        return res.status(200).json({token:token});

    }catch(err){
        res.json({message:`Something went wrong ${err}`});
    }
}

export {Register, Login}


