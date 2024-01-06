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

connectToDB();

const server = http.createServer(app);  // Create an HTTP server

const io = socketIo(server, {
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

  console.log(socket);

  const user_id = socket.handshake.query["user_id"]

  const socket_id = socket.id;

  console.log(`User connected, ${socket_id}`);

  if (user_id) {
    await User.findByIdAndUpdate(user_id, { socket_id })
  }

  socket.on("friend_request", async (data) => {
    console.log(data.to);

    const to = await User.findById(data.to);


    io.to(to.socket_id).emit("new_friend_request", {

    });
  })


})