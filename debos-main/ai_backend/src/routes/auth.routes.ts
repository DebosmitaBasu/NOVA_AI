import { Router } from "express";
import {
  changePasswordController,
  loginController,
  logoutController,
  meController,
  registerController,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { changePasswordSchema, loginSchema, registerSchema } from "../validators/auth.validation.js";

const router = Router();

router.post("/register", validate(registerSchema), registerController);
router.post("/login", validate(loginSchema), loginController);
router.post("/logout", logoutController);
router.get("/me", protect, meController);
router.patch("/change-password", protect, validate(changePasswordSchema), changePasswordController);

export default router;
