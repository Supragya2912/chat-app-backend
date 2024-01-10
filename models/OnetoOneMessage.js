const mongoose = require("mongoose");


const onetoOneMessage = new mongoose.Schema({

    participants:[
        {
            type: mongoose.Schema.ObjectId,
            ref:"User",
        }
    ],
    messages:[
        {
            to: {
                type: mongoose.Schema.ObjectId,
                ref:"User",
            },
            from: {
                type: mongoose.Schema.ObjectId,
                ref:"User",
            },
            type:{
                type: String,
                enum: ["Text", "Media", "Link"]
            },
            created_at:{
                type: Date,
                default: Date.now()
            },
            text:{
                type: String,
            },
            file:{
                type: String,
            }
        }
    ]
});


const OnetoOneMessage = new mongoose.model("OnetoOneMessage", onetoOneMessage);

module.exports = OnetoOneMessage;