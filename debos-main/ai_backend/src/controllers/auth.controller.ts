import type { NextFunction, Request, Response } from "express";
import { changePassword, getCurrentUser, loginUser, registerUser } from "../services/auth.service.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { env } from "../config/env.js";
import type { IUserDocument } from "../models/user.model.js";

interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
}

const setAuthCookie = (res: Response, token: string): void => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const registerController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await registerUser(req.body);
    setAuthCookie(res, result.token);
    return sendSuccess(res, 201, "Registration successful", { user: result.user });
  } catch (error) {
    next(error);
  }
};

export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loginUser(req.body);
    setAuthCookie(res, result.token);
    return sendSuccess(res, 200, "Login successful", { user: result.user });
  } catch (error) {
    next(error);
  }
};

export const logoutController = (_req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return sendSuccess(res, 200, "Logout successful", {});
};

export const meController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await getCurrentUser(req);
    return sendSuccess(res, 200, "User fetched successfully", { user });
  } catch (error) {
    next(error);
  }
};

export const changePasswordController = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await changePassword(req, req.body);
    return sendSuccess(res, 200, "Password changed successfully", { user });
  } catch (error) {
    next(error);
  }
};
