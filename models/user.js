const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

});

userSchema.methods.correctPassword = async function (
    candidatePassword,
    userPassword
){
    return await bcrypt.compare(candidatePassword, userPassword);

}

const User = mongoose.model('User',userSchema);
module.exports = User;