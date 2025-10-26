/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import axios, { HttpStatusCode } from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const AuthContext = createContext(null);

const client = axios.create({
  baseURL: "http://localhost:8080/api/users",
});

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  // initialize from localStorage if available
  const [userData, setUserData] = useState(() => {
    try {
      const saved = localStorage.getItem("userData");
      if (!saved || saved === "undefined") return null;
      return JSON.parse(saved);
    } catch (err) {
      console.error("Failed to parse userData from localStorage:", err);
      localStorage.removeItem("userData");
      return null;
    }
  });

  const handleRegister = async (name, username, password) => {
    try {
      const res = await client.post("/register", { name, username, password });
      setUserData(res.data.user);
      localStorage.setItem("userData", JSON.stringify(res.data.user));
      toast.success("Registration successful!");
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Registration failed. Please try again.");
      }
      console.error("Registration error:", err);
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const res = await client.post("/login", { username, password });
      setUserData(res.data.user);

      if (res.status === HttpStatusCode.Ok) {
        localStorage.setItem("token", res.data.token);
      }

      toast.success("Login successful!");
      navigate("/home");
    } catch (err) {
      // 👇 Catch backend error messages safely
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Login failed. Please try again.");
      }
      console.error("Login error:", err);
    }
  };

  const getHistoryOfUser = async () => {
    try {
      const response = await client.get("/get_all_activity", {
        params: {
          token: localStorage.getItem("token"),
        },
      });
      return response.data;
    } catch (err) {
      toast.error("Failed to fetch meeting history");
      throw err;
    }
  };

  const addToUserHistory = async (meetingCode) => {
    try {
      const response = await client.post("/add_to_activity", {
        token: localStorage.getItem("token"),
        meetingCode,
      });
      return response.data;
    } catch (err) {
      toast.error("Failed to save meeting to history");
      throw err;
    }
  };

  const data = {
    userData,
    setUserData,
    getHistoryOfUser,
    addToUserHistory,
    handleRegister,
    handleLogin,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};

// optional helper hook
export const useAuth = () => useContext(AuthContext);
