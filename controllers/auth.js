const jwt = require('jsonwebtoken');
const User = require("../models/user");
const filter = require('../utils/filterObj');
const otp_generator = require('otp-generator');
const mailService = require("../services/mailer");


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
        next();
    } else {

        const new_user = await User.create(filteredBody);
        req.userId = new_user._id;
        next();
    }

}

exports.sendOTP = async (req, res, next) => {

    const { userId } = req;
    const new_otp = otp_generator.generate(6, { upperCaseAlphabets: false, specialChars: false, alphabets: false });
    const otp_expiry = Date.now() + 10 * 60 * 1000;

    await User.findByIdAndUpdate(userId, {
        otp: new_otp,
        otp_expiry
    });

    //SEND MAIL

    mailService.sendMail({
        from : "anandsupragya@gmail.com",
        to: "example@gmail.com",
        subject: "OTP for Login",
        text: `Your otp is ${new_otp} and will be valid for 10 minutes`,

    })


    res.status(200).json({
        status: "success",
        message: "OTP sent successfully"
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
    user.otp = undefined;

    await user.save({ new: true, validateModifiedOnly: true })

    const token = signToken(user._id);
    res.status(200).json({
        status: "success",
        message: "OTP verified successfully",
        token
    })
}

exports.login = async (req, res, next) => {


    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            status: "error",
            message: "Please provide email and password"
        })
    }

    const userDoc = await User.findOne({ email: email }).select({ password: password });

    if (!userDoc || !(await userDoc.correctPassword(password, userDoc.password))) {
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

    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    })

    if (!user) {
        res.status(400).json({
            status: "error",
            message: "Token has expired"
        })

        return;
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();


    const token = signToken(user._id)

    res.status(200).json({
        status: "success",
        message: "Password reset successfully",
        token
    })
}