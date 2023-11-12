import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true },
    password: String,
  },
  { timestamps: true }
  
//   ~ {timestamps: true } -> This will give createadAT and updatedAt timestamps in the db for each user
);

export const UserModel = mongoose.model("User", userSchema);
