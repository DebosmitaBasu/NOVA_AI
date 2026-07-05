import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError.js";
import { sendError } from "../utils/ApiResponse.js";

export const errorHandler: ErrorRequestHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.message);
  }

  if (err instanceof Error) {
    return sendError(res, 500, err.message);
  }

  return sendError(res, 500, "Internal server error");
};
