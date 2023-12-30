const jwt = require('jsonwebtoken');
const User = require("../models/user");
const filter = require('../utils/filterObj');
const otp_generator = require('otp-generator');



const signToken = (userId) => jwt.sign({userId}, process.env.JWT_SECRET)


exports.register = async (req, res, next) =>{

    const { firstName, lastName, email, password} = req.body;

    const filteredBody = filter(req.body, "firstName", "lastName", "email", "password");

    const existing_user = await User.findOne({email: email});

    if(existing_user && existing_user.verified){
        res.status(400).json({
            status:"error",
            message:"Email already in use, please login"
        })
    }
    else if(existing_user){
       await User.findOneAndUpdate({email:email}, filteredBody,{new: true, validateModifiedOnly: true});

        req.userId = existing_user._id;
        next();
    }else{

        const new_user = await User.create(filteredBody);
        req.userId = new_user._id;
        next();
    }

}



exports.sendOTP = async (req, res, next) => {

    const {userId} =  req;
    const new_otp = otp_generator.generate(6,{upperCaseAlphabets: false, specialChars: false, alphabets: false});
    const otp_expiry = Date.now() + 10 * 60 * 1000;

    await User.findByIdAndUpdate(userId,{
        otp: new_otp,
        otp_expiry
    });
    
    //SEND MAIL

    res.status(200).json({
        status: "success",
        message: "OTP sent successfully"
    })

}


exports.verifyOTP = async (req,res,next) =>{

    const {email , otp } = req.body;

    const user = await User.findOne({
        email,
        otp_expiry : {$gt: Date.now()},
    })


    if(!user){
        res.status(400).json({
            status : "error",
            message:"Email is INVALID or OTP has expired"
        })
    }

    if(!await user.correctOTP(otp, user.otp)){
        res.status(400).json({
            status : "error",
            message:"OTP is incorrect"
        })
    }

    user.verified = true;
    user.otp = undefined;

    await user.save({new: true, validateModifiedOnly: true})

    const token = signToken(user._id);
    res.status(200).json({
        status: "success",
        message: "OTP verified successfully",
        token
    })
}

exports.login = async (req, res, next) =>{


    const {email, password} = req.body;

    if(!email || !password){
        return res.status(400).json({
            status: "error",
            message: "Please provide email and password"
        })
    }

    const userDoc = await User.findOne({email:email}).select({password:password});

    if(!userDoc || !(await userDoc.correctPassword(password, userDoc.password))){
        return res.status(400).json({
            status: "error",
            message: "Email or password is incorrect"
        })
    }

    const token = signToken(userDoc._id);
    res.status(200).json({
        status: "success",
        message: "Logged in successfully",
        token
    })
    

}