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
const path = require("path");
const FriendRequest = require('./models/friendRequest');
const OnetoOneMessage = require('./models/OnetoOneMessage');

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
    await User.findByIdAndUpdate(user_id, { socket_id, status: "Online" })
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

  })


  socket.on("get_direct_conversations", async ({ user_id }, callback) => {
    const existing_conversation = await OnetoOneMessage.find({
      participants: { $all: [user_id] }
    }).populate("participants", "firstName lastName _id email status");

    callback(existing_conversation)
  })


  socket.on("start_conversations", async (data) => {

    const { to, from } = data;

    const existing_conversation = await OnetoOneMessage.find({
      participants: { $size: 2, $all: [to, from] }
    }).populate("participants", "firstName lastName _id email status");


    console.log(existing_conversation);


    if (existing_conversation.length === 0) {
      let new_chat = await OnetoOneMessage.create({
        participants: [to, from]
      })
      console.log(new_conversation);

      new_chat = await OnetoOneMessage.findById(new_chat._id).populate("participants", "firstName lastName _id email status");
      socket.emit("start_chat", new_chat);
    } else {
      socket.emit("start_chat", existing_conversation[0]);
    }

  });


  socket.on("get_messages", async (data, callback) => {
    const { messages } = await OnetoOneMessage.findById(data.conversation_id).select("messages");
    callback(messages)
  })

  socket.on("text_message", async(data) => {
    console.log(data);

    //data => to and from, messages, conversation_id, type

    const { to, from, message, conversation_id, type } = data;
    const to_user = await User.findById(to);
    const from_user = await User.findById(from);
    const new_message = {
      to,
      from,
      type,
      text: message,
      created_at: Date.now()
    }

    //create a new convo if it does not exist or add a new message to the message list

    const chat = await OnetoOneMessage.findById(conversation_id);
    chat.messages.push(new_message);
       //save to db
    await chat.save({});

    //emit incoming_message to user

    io.to(to_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    })


    //emit outgoing message from user

    io.to(from_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    })

  });

  socket.on("file_message", (data) => {

    console.log(data);

    //data =>{ to, from , text, file}

    const fileExtension = path.extname(data.file.name)

    //generate unique filename
    const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}${fileExtension}`;

    //upload file 

  })



  socket.on("start_audio_call", async (data) => {
    const { from, to, roomID } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    console.log("to_user", to_user);

    // send notification to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_notification", {
      from: from_user,
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  //audio call not picked up
  socket.on("audio_call_not_picked", async (data) => {
    console.log(data);
    // find and update call record
    const { to, from } = data;

    const to_user = await User.findById(to);

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    // TODO => emit call_missed to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_missed", {
      from,
      to,
    });
  });

  // handle audio_call_accepted
  socket.on("audio_call_accepted", async (data) => {
    const { to, from } = data;

    const from_user = await User.findById(from);

    // find and update call record
    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Accepted" }
    );

    // TODO => emit call_accepted to sender of call
    io.to(from_user?.socket_id).emit("audio_call_accepted", {
      from,
      to,
    });
  });

  // handle audio_call_denied
  socket.on("audio_call_denied", async (data) => {
    // find and update call record
    const { to, from } = data;

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit call_denied to sender of call

    io.to(from_user?.socket_id).emit("audio_call_denied", {
      from,
      to,
    });
  });

  // handle user_is_busy_audio_call
  socket.on("user_is_busy_audio_call", async (data) => {
    const { to, from } = data;
    // find and update call record
    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit on_another_audio_call to sender of call
    io.to(from_user?.socket_id).emit("on_another_audio_call", {
      from,
      to,
    });
  });


  socket.on("end", async (data) => {

    //find user by id and set the status to offline

    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" })
    }


    console.log("disconnected");
    socket.disconnect(0);
  })

})