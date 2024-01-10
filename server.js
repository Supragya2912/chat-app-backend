require('dotenv').config()
const express = require('express')
const app = express()
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const xss = require('xss');
const cors = require('cors');
const { mongo } = require('mongoose');
const { connectToDB } = require('./db');
const port = process.env.PORT;
const routes = require('./routes/index')
const authRoute = require("./routes/auth");
const userRoute = require("./routes/user");
const { Server } = require('socket.io');
const User = require("./models/user");
const http = require("http");
const FriendRequest = require('./models/friendRequest');

connectToDB();

const server = http.createServer(app);  // Create an HTTP server

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});


app.use(mongoSanitize());
// app.use(xss());

app.use(cors({
  origin: "*",
  methods: ['GET', 'PATCH', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: "10kb" }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000,
  message: "Limit exceeded"
})
app.use("/tawk", limiter);


// app.use(routes);


app.use("/user", userRoute);
app.use("/auth", authRoute);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

io.on("connection", async (socket) => {

  console.log(JSON.stringify(socket.handshake.query));
  console.log(socket);

  const user_id = socket.handshake.query["user_id"]
  const socket_id = socket.id;

  if (Boolean(user_id)) {
    await User.findByIdAndUpdate(user_id, { socket_id })
  }

  socket.on("friend_request", async (data) => {
    console.log(data.to);

    // data has {to, from} which indicates to whom and from whom the friend request is sent
    const to = await User.findById(data.to).select("socket_id");
    const from = await User.findById(data.from).select("socket_id");

    //create a friend request
    await FriendRequest.create({
      sender: data.from,
      recepient: data.to
    })
    io.to(to?.socket_id).emit("new_friend_request", {
      message: "New friend request received",
    });
    io.to(from?.socket_id).emit("request_sent", {
      message: "Request Sent successfully!",
    });

  })


  socket.on("accept_request", async (data) => {

    const request_doc = await FriendRequest.findById(data.request_id);

    const sender = await User.findById(request_doc.sender);
    const receiver = await User.findById(request_doc.recepient);

    sender.friends.push(request_doc.recepient);
    sender.friends.push(request_doc.sender);


    await receiver.save({ new: true, validateModifiedOnly: true });
    await sender.save({ new: true, validateModifiedOnly: true });


    await FriendRequest.findByIdAndDelete(data.request_id);

    io.to(sender.socket_id).emit("request_accepted", {
      message: "Request accepted successfully!",
    });

    io.to(receiver.socket_id).emit("request_accepted", {
      message: "Request accepted successfully!",
    });


    socket.on("end",function(){
      console.log("disconnected");
      socket.disconnect(0);
    })


  })

})