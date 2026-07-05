import mongoose from "mongoose";
import { env } from "./env.js";

export const connectToDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    console.warn("Server will continue without database connectivity.");
  }
};
