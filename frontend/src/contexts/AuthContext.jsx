/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import axios, { HttpStatusCode } from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import serverUrl from "../environment";

export const AuthContext = createContext(null);

const client = axios.create({
  baseURL: `${serverUrl}/api/users`,
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

  const addToUserHistory = async (meetingCode) => {
    try {
      const response = await client.post("/add_to_activity", {
        token: localStorage.getItem("token"),
        meetingCode,
      });
      console.log("✅ Add meeting response:", response.data);
      return response.data;
    } catch (err) {
      console.error("❌ Add meeting error:", err);
      toast.error("Failed to save meeting to history");
      throw err;
    }
  };
  
  const getHistoryOfUser = async () => {
    try {
      const response = await client.get("/get_all_activity", {
        params: {
          token: localStorage.getItem("token"),
        },
      });
  
      console.log("📜 Get history response:", response.data);
  
      // ✅ Handle both formats: direct array OR wrapped in { data: [...] }
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (Array.isArray(response.data.data)) {
        return response.data.data;
      } else {
        console.warn("⚠️ Unexpected response format:", response.data);
        return [];
      }
    } catch (err) {
      toast.error("Failed to fetch meeting history");
      console.error("❌ Error fetching meeting history:", err);
      return [];
    }
  };

  const deleteSingleHistory = async (meetingId) => {
    try {
      const response = await client.delete("/delete_single_activity", {
        params: {
          token: localStorage.getItem("token"),
          meetingId,
        },
      });
      toast.success("Meeting deleted successfully!");
      return response.data;
    } catch (err) {
      toast.error("Failed to delete meeting");
      console.error("❌ Error deleting single meeting:", err);
      throw err;
    }
  };
  
  
  

  const data = {
    userData,
    setUserData,
    getHistoryOfUser,
    addToUserHistory,
    deleteSingleHistory,
    handleRegister,
    handleLogin,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};

// optional helper hook
export const useAuth = () => useContext(AuthContext);
