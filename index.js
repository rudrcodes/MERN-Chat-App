import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import cors from "cors";
import { UserModel } from "./models/Users.js";
import { MessageModel } from "./models/Messages.js";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { createServer } from "http";
import fs from "fs";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__dirname);
// Without the .js extension this gives error , so if getting an error in importing stuff try adding the extension of that file

dotenv.config();
const app = express();
const httpServer = createServer(app);

const mongoDBuri = process.env.MONGODB_URI;
const jwtSecretKey = process.env.JWT_SECRET_KEY;
const clientURL = process.env.CLIENT_URL;
const bcryptSalt = bcrypt.genSaltSync(10);

// const connectedClients = new Map(); // Map to store connected clients

// ^ If i'll not use this i'll get undefined in my req.body as json is not being parsed 😵

app.use("/uploads", express.static(__dirname + "/uploads"));

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    credentials: true,
    origin: clientURL,
  })
);

// connecting to the mongoDB using mongoose
mongoose
  .connect(mongoDBuri)
  .then((res) => {
    console.log("DB connected...");
  })
  .catch((err) => console.log("err"));

app.get("/", (req, res) => {
  res.json("Server is Live 🟢");
});

// app.get("/logout", (req, res) => {
//   req.cookies.token = "";
//   res.json();
// });

// To get all the messages between two particular users
// This dynamic variable i.e ':name' should be having the same name as the value that we are passing in the params
app.get("/messages/:name", async (req, res) => {
  // res.json(req.params);
  const { name } = req.params;

  // Using token to get our userID and the userID of other person we are getting from the params
  const token = req.cookies.token;
  let userDetails;
  if (token) {
    jwt.verify(token, jwtSecretKey, {}, (err, userData) => {
      if (err) throw err;
      userDetails = userData;
    });
  }
  const ourUserId = userDetails?.userId;
  const ourUserName = userDetails?.username;
  // res.json({ ourUserId, userId });
  const messages = await MessageModel.find({
    receiverUsername: { $in: [name, ourUserName] },
    // senderID: { $in: [userId, ourUserId] },
    senderUsername: { $in: [name, ourUserName] },
  });
  // console.log(messages);
  // res.json(messages);
  res.json(messages);
});

//get all the users present in the db

app.get("/allUsers", async (req, res) => {
  try {
    const result = await UserModel.find({});
    // console.log(result);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ err: error });
  }
});

app.get("/profile", (req, res) => {
  if (!req.cookies) res.status(401).json("no token");

  const token = req.cookies.token;
  if (token) {
    jwt.verify(token, jwtSecretKey, {}, (err, userData) => {
      if (err) throw err;
      // res.json({name:"rudransh"}); // Testing Purposes

      // The data that we use to create token can be accessed while we verify token
      res.json(userData);
    });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await UserModel.findOne({ username });
  if (foundUser) {
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      jwt.sign(
        { userId: foundUser._id, username },
        jwtSecretKey,
        {},
        (err, token) => {
          if (err) throw err;
          res
            .cookie("token", token, { sameSite: "none", secure: true })
            .status(201)
            .json({
              id: foundUser._id,
            });
        }
      );
    }
  }
});

app.post("/register", async (req, res) => {
  //   console.log("req.body : ", req.body);
  const { username, password } = req.body;

  const hashedPass = bcrypt.hashSync(password, bcryptSalt);
  try {
    const createdUser = await UserModel.create({
      username,
      password: hashedPass,
    });
    //   Now we want to log in the user as soon as they are logged in.

    jwt.sign(
      { userId: createdUser._id, username },
      jwtSecretKey,
      {},
      (err, token) => {
        if (err) throw err;
        res
          .cookie("token", token, { sameSite: "none", secure: true })
          .status(201)
          .json({
            id: createdUser._id,
          });
      }
    );
  } catch (err) {
    if (err) {
      res.json({ err });
      // throw err
      console.log(err);
    }
    // if (err) throw err;
  }

  //   About JWT :
  //   (Asynchronous) If a callback is supplied, the callback is called with the err or the JWT.
  // (Synchronous) Returns the JsonWebToken as string
});

// --------------------------------
// --------------------------------
// --------------------------------

const io = new Server(httpServer, {
  cors: {
    origin: clientURL,
  },
});

let allClients = [];

app.get("/allClients", (req, res) => {
  // res.json([allClientsObj]);
  res.json(allClients);
});

io.on("connection", async (socket) => {
  console.log(`🔥: A ${socket.id} :  user connected`);
  // console.log("connected");

  //I setup a custom header to get cookie from the client
  // If theres a token that means the user is logged in and connected to socket

  // read username and id from the cookie for this connection
  const userCookie = socket.handshake.headers.usercookie;
  if (userCookie) {
    jwt.verify(userCookie, jwtSecretKey, {}, (err, userData) => {
      if (err) throw err;
      // res.json({name:"rudransh"}); // Testing Purposes
      // console.log(userData);

      // This "open" event is added to automatically show the online status of the user to other users

      io.emit("open", {
        userId: userData.userId,
        name: userData.username,
        // message: "connected",
      });
      // The data that we have used to create the token can be accessed while we verify the token
      socket.username = userData.username;
      socket.userId = userData.userId;
      // console.log("socket.username : ", socket.username);
    });
  }
  const allClientsObj = {};
  socket.on("sendMessage", async (data) => {
    // console.log(data);
    let messageDoc;
    if (data.type != "file") {
      messageDoc = await MessageModel.create(data);
    }
    // console.log("messageDoc : ",messageDoc)
    // if (data.fileData != null) {
    console.log("data : ", data);
    // }

    // If data is a file type store it in the uploads folder
    if (data.type == "file") {
      const parts = data.message.split(".");
      const ext = parts[parts.length - 1];
      const filename = Date.now() + "." + ext;
      // setTimeout(() => {}, 2000);

      messageDoc = await MessageModel.create({ ...data, message: filename });
      console.log("file : ", { ...data, message: filename });

      const path = __dirname + "/uploads/" + filename;
      // const blob = new Blob([data.body], { type: data.type });
      // Buffer.from();

      fs.writeFile(path, data.body, () => {
        console.log("file saved : ", path);
      });
      io.emit("messageResponse", { ...data, message: filename });

      //save this file in uploads
    }
    if (data.message && data.receiverID && data.type != "file") {
      // Sending the message to all the connected clienst
      io.emit("messageResponse", data);
    }
  });
  //* io.fetchSockets() -> to get all the connected clients ,it's a promise

  await io.fetchSockets().then((clients) => {
    clients.forEach((client) => {
      allClients.push({
        username: client.username,
        // *This id is provided by socket.io whenever a new connection is made
        id: client.id,
        // *And this id is the mongoDB id of the stored user
        userId: client.userId,
      });

      //create an object that contains all the connected users

      // console.log(allClients);
      allClients.map((client) => {
        // if (!allClientsObj[client.username])
        allClientsObj[client.username] = {
          id: client.id,
          userId: client.userId,
        };
      });

      // console.log("Client details:", {
      //   username: client.username,
      //   id: client.id,
      // });
      // console.log("----");
      // console.log(allClientsObj);
    });
  });

  socket.on("disconnect", async () => {
    //when someone disconnects emit an event to let frontend know about it automatically without reloading

    let disClient = allClients.find((client) => client.id == socket.id);

    // This "closed" event is added to automatically show the ofline status of the user to other users

    io.emit("closed", {
      id: socket.id,
      username: disClient.username,
      userId: allClientsObj[disClient.username].userId,
    });
    allClients = allClients.filter((client) => client.id != socket.id);
    console.log(
      `-------------- 🔥: A ${socket.id} : ${disClient.username}  user disconnected`
    );
  });
});

// --------------------------------
// --------------------------------
// --------------------------------

httpServer.listen(4000, () => {
  console.log("--- Server listening on port 🚢 :  4000 --- ");
});
// wss.on("connection ", () => {
//   console.log("connected");
// });
