const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({

    firstName: {
        type: String,
        required: [true, 'Please enter your first name']
    },
    lastName: {
        type: String,
        required: [true, 'Please enter your last name']
    },
    avatar: {
        type: String
    },
    email: {
        type: String,
        required: [true, 'Please enter your email'],
        unique: true,
        validate: {
            validator: function (email) {
                return String(email).toLowerCase().match(
                    "^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$"
                );
            },
            message: (props) => `Email (${props.value}) is not valid`,
        }
    },
    password: {
        type: String,
    },
    passwordConfirm :{
        type: String,
    },
    passwordUpdatedAt: {
        type: Date
    },
    passwordResetToken: {
        type: String
    },
    passwordResetExpires: {
        type: Date
    },
    createdAt: {
        type: Date,
        // default: Date.now()
    },
    updatedAt: {
        type: Date,
        // default: Date.now()
    },
    verified:{
        type: Boolean,
        default: false
    },
    otp :{
        type: String,
    },
    otp_expiry:{
        type: Date
    },
    socket_id:{
        type: String,
    },
    friends :[
        {
            type: mongoose.Schema.ObjectId,
            ref: "User",
        }
    ]

});

userSchema.pre('save', async function (next) {
  
    if (!this.isModified('password')) return next();

   
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    next();
});


userSchema.pre("save", async function(next)  {

    if(!this.isModified("otp")) return next();

    this.otp = await bcrypt.hash(this.otp,12);

    next();
})


userSchema.methods.correctOTP = async function (
    candidateOTP,
    userOTP
){
    return await bcrypt.compare(candidateOTP, userOTP);

}

userSchema.methods.correctPassword = async function (
    candidatePassword,
    userPassword
){
    return await bcrypt.compare(candidatePassword, userPassword);

}


userSchema.methods.createPasswordResetToken = function () {

    const resetToken = crypto.randomBytes(32).toString("hex");
    this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex")

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
}

userSchema.methods.changePasswordAfter = function (timestamp) {

    return timestamp < this.passwordUpdatedAt;
}

const User = mongoose.model('User',userSchema);
module.exports = User;