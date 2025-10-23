import { User } from "../models/user.model.js";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const Register = async (req, res) => {
  const { name, username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(StatusCodes.CONFLICT)
        .json({ message: "User already exists!" });
    }

    const hash = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      username,
      password: hash,
    });

    await newUser.save();

    return res
      .status(StatusCodes.CREATED)
      .json({ message: "New user created successfully!" });
  } catch (err) {
    console.error("Register error:", err);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong!" });
  }
};

const Login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Please provide all information" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "User not found" });
    }

    const result = await bcrypt.compare(password, user.password);
    if (!result) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Incorrect credentials" });
    }

    // Generate a random token (you could also use JWT here)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    user.token = token;
    await user.save();

    // ✅ Always return both message and user data for frontend clarity
    return res.status(StatusCodes.OK).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong!" });
  }
};

export { Register, Login };
