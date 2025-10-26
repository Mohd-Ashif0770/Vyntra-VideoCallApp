import { Router } from "express";
import { addToHistory, getUserHistory, Login, Register, deleteHistory } from "../controllers/user.controller.js";

const router = Router();

router.route("/login").post(Login)
router.route("/register").post(Register)
router.route("/add_to_activity").post(addToHistory)
router.route("/get_all_activity").get(getUserHistory);
router.route("/delete_single_activity").delete(deleteHistory);


export default router;