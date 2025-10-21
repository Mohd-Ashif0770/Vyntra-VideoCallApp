import { Router } from "express";
import { Login, Register } from "../controllers/user.controller.js";

const router = Router();

router.route("/login").post(Login)
router.route("/register").post(Register)
router.route("/add_to_activity")
router.route("/get_all_activity")

export default router;