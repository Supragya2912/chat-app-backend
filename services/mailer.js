const sgMail = require("@sendgrid/mail");
const dotenv = require("dotenv");

dotenv.config = config({path: "../env"});


sgMail.setApiKey(process.env.SG_API_KEY);


const sendSGMail = async({
    recipient,
    sender,
    subject,
   html,
   text,
    attachments
})  =>{

    try{

        const from = sender ||  "anandsupragya@gmail.com";

        const msg = {
            to: recipient,
            from : from,
            subject,
            html: html,
            text: text,
            attachments
        }
        
        return sgMail.send(msg);

    }catch(err){
        console.log("Error: ", err);
    }
}

exports.sendMail = async (args) =>{

    if(process.env.NODE_ENV === 'development'){
        return new Promise.resolve();
    }
    else{
        return sendSGMail(args);
    }
}
