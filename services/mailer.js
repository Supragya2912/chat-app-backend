// const sgMail = require("@sendgrid/mail");



// sgMail.setApiKey(process.env.SG_API_KEY);


// const sendSGMail = async({
//     recipient,
//     sender,
//     subject,
//    html,
//    text,
//     attachments
// })  =>{

//     try{

//         const from = sender ||  "anandsupragya@gmail.com";

//         const msg = {
//             to: recipient,
//             from : from,
//             subject,
//             html: html,
//             text: text,
//             attachments
//         }
        
//         return sgMail.send(msg);

//     }catch(err){
//         console.log("Error: ", err);
//     }
// }

// exports.sendMail = async (args) =>{

//     if(process.env.NODE_ENV === 'development'){
//         return new Promise.resolve();
//     }
//     else{
//         return sendSGMail(args);
//     }
// }


const nodemailer = require('nodemailer');


exports.sendMail = async (req, res) =>{

   let config = {
    service: 'gmail',
    auth: {
        user: '',
        pass: ''
    }
   }

   let transporter = nodemailer.createTransporter(config);

   
}