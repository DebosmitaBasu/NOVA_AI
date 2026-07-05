import { Router } from "express";
import { chatController, providerStatusController } from "../controllers/ai.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { aiChatSchema } from "../validators/ai.validation.js";

const router = Router();

router.post("/chat", validate(aiChatSchema), chatController);
router.get("/status", providerStatusController);

export default router;
