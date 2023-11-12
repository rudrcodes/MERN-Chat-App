import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    // ?
    receiverID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    senderID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // receiverID: String,
    // senderID: String,
    receiverUsername: String,
    senderUsername: String,
    message: String,
    type: String,
    body: String,
    mimeType: String,
  },
  { timestamps: true }
);

export const MessageModel = mongoose.model("Message", messageSchema);
