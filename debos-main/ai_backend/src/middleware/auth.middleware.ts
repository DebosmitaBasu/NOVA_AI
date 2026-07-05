import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { env } from "../config/env.js";
import type { IUserDocument } from "../models/user.model.js";

interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
}

export const protect = async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      next(new ApiError(401, "Authentication required"));
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      next(new ApiError(401, "User not found"));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(new ApiError(401, "Invalid or expired token"));
  }
};
