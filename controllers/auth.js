const jwt = require('jsonwebtoken');
const User = require("../models/user");



const signToken = (userId) => jwt.sign({userId}, process.env.JWT_SECRET)

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