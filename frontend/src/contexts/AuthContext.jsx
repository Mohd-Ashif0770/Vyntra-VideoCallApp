/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext(null);

const client = axios.create({
  baseURL: "http://localhost:8080/api/users",
});

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  // initialize from localStorage if available
  const [userData, setUserData] = useState(() => {
    const saved = localStorage.getItem("userData");
    return saved ? JSON.parse(saved) : null;
  });

  const handleRegister = async (name, username, password) => {
    try {
      const res = await client.post("/register", { name, username, password });
      setUserData(res.data.user);
      localStorage.setItem("userData", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      console.error("Registration failed:", err);
      throw err;
    }
  };

  const data = {
    userData,
    setUserData,
    handleRegister,
  };

  return (
    <AuthContext.Provider value={data}>
      {children}
    </AuthContext.Provider>
  );
};

// optional helper hook
export const useAuth = () => useContext(AuthContext);
