import type { Request } from "express";
import User, { type IUserDocument } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { generateToken } from "../utils/generateToken.js";
import type { ChangePasswordInput, LoginInput, RegisterInput } from "../validators/auth.validation.js";

interface AuthenticatedRequest extends Request {
  user?: IUserDocument;
}

const sanitizeUser = (user: IUserDocument) => {
  const userObject = user.toObject() as Record<string, unknown> & { password?: string; __v?: number };
  const { password: _password, __v: _version, ...safeUser } = userObject;
  return safeUser;
};

export const registerUser = async (input: RegisterInput) => {
  const existingUser = await User.findOne({ email: input.email });

  if (existingUser) {
    throw new ApiError(409, "User already exists with this email");
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: input.password,
  });

  const token = generateToken(user._id.toString());

  return {
    user: sanitizeUser(user),
    token,
  };
};

export const loginUser = async (input: LoginInput) => {
  const user = await User.findOne({ email: input.email }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await user.comparePassword(input.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = generateToken(user._id.toString());

  return {
    user: sanitizeUser(user),
    token,
  };
};

export const getCurrentUser = async (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  return sanitizeUser(req.user);
};

export const changePassword = async (req: AuthenticatedRequest, input: ChangePasswordInput) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isCurrentPasswordValid = await user.comparePassword(input.currentPassword);

  if (!isCurrentPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = input.newPassword;
  await user.save();

  return sanitizeUser(user);
};
