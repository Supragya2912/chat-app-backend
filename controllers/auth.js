const jwt = require('jsonwebtoken');
const User = require("../models/user");
const filter = require('../utils/filterObj');
const otp_generator = require('otp-generator');
const mailService = require("../services/mailer");
const crypto = require("crypto");



const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET)


exports.register = async (req, res, next) => {

    const { firstName, lastName, email, password } = req.body;

    const filteredBody = filter(req.body, "firstName", "lastName", "email", "password");


    const existing_user = await User.findOne({ email: email });
 

    if (existing_user && existing_user.verified) {
        res.status(400).json({
            status: "error",
            message: "Email already in use, please login"
        })
   
    }
    else if (existing_user) {
        await User.findOneAndUpdate({ email: email }, filteredBody, { new: true, validateModifiedOnly: true });

        req.userId = existing_user._id;
       res.status(401).json({
        status: "error",
        message:"User already exists"
       })
        next();
    } else {

        const new_user = await User.create(filteredBody);
        req.userId = new_user._id;
        // res.status(200).json({
        //     status: "success",
        //     message: "User created successfully"
        // })
      
        next();
    }

}

exports.sendOTP = async (req, res, next) => {

    const { userId } = req;
    const new_otp = otp_generator.generate(6, { upperCaseAlphabets: false, specialChar: false, alphabets: false });
    const otp_expiry = Date.now() + 10 * 60 * 1000;

    
    const user =  await User.findByIdAndUpdate(userId, {
       
        otp: new_otp,
        otp_expiry
    });
    user.otp = new_otp.toString();
    await user.save({new : true , validateModifiedOnly : true});
   

    //SEND MAIL

    // mailService.sendMail({
    //     from : "anandsupragya@gmail.com",
    //     to: User.email,
    //     subject: "OTP for Login",
    //     text: `Your otp is ${new_otp} and will be valid for 10 minutes`,

    // })


    res.status(200).json({
        status: "success",
        message: "OTP sent successfully",
        otp: new_otp
    })

}


exports.verifyOTP = async (req, res, next) => {

    const { email, otp } = req.body;

    const user = await User.findOne({
        email,
        otp_expiry: { $gt: Date.now() },
    })


    if (!user) {
        res.status(400).json({
            status: "error",
            message: "Email is INVALID or OTP has expired"
        })
    }


    if (!await user.correctOTP(otp, user.otp)) {
        res.status(400).json({
            status: "error",
            message: "OTP is incorrect"
        })
    }

    user.verified = true;

    await user.save({ new: true, validateModifiedOnly: true })

    const token = signToken(user._id);
    res.status(200).json({
        status: "success",
        message: "OTP verified successfully",
        token,
        user_id: user._id
    })
}

exports.login = async (req, res, next) => {
    const { email, password } = req.body;
  
  
  
    if (!email || !password) {
      res.status(400).json({
        status: "error",
        message: "Both email and password are required",
      });
      return;
    }
  
    const user = await User.findOne({ email: email }).select("+password");
  
    if (!user || !user.password) {
      res.status(400).json({
        status: "error",
        message: "Incorrect password",
      });
  
      return;
    }
  
    if (!user || !(await user.correctPassword(password, user.password))) {
      res.status(400).json({
        status: "error",
        message: "Email or password is incorrect",
      });
  
      return;
    }
  
    const token = signToken(user._id);
  
    res.status(200).json({
      status: "success",
      message: "Logged in successfully!",
      token,
      user_id: user._id,
    });
  };


exports.protect = async (req, res, next) => {

    let token;
    if (req.headers.authorization && req.headers.authorization.startswith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    }
    else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    else {
        req.status(400).json({
            status: "error",
            message: "You are not logged in"
        })

        return;
    }

    //verification of token
    const decode = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    //check if user exists
    const this_user = await User.findById(decode.userId)

    if(! this_user){
        res.status(400).json({
            status:"error",
            messsage:"The user does not exist",
        })
    }

    if(this_user.changedPasswordAfter(decode.iat)){
        res.status(400).json({
            status:"error",
            message:"user recently updated the password"
        })
    }

    req.user = this_user;
    next()

  
}

exports.forgotPassword = async (req, res, next) => {

    const user = await User.findOne({
        email: req.body.email
    })

    if (!user) {
        res.status(400).json({
            status: "error",
            message: "No user found with that email address"
        })

        return;
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({validateBeforeSave:false});
    console.log(resetToken);
    const resetURL = `https://tawk.com/auth/reset-password/?code=${resetToken}`;


    try {
        //send email
        res.status(200).json({
            status: "success",
            message: "Token sent to email"
        })

    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;

        await user.save({ validateBeforeSave: false });
        res.status(500).json({
            status: "error",
            message: "There was an error sending the email, try again later"
        })
    }
}

exports.resetPassword = async (req, res, next) => {
    
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.body.token)
      .digest("hex");
  
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
  
 
    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "Token is Invalid or Expired",
      });
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  
  
    const token = signToken(user._id);
  
    res.status(200).json({
      status: "success",
      message: "Password Reset Successfully",
      token,
    });
  };