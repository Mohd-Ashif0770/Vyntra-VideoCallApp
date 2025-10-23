import "./App.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "./contexts/authContext.jsx";
import { Authentication } from "./pages/Authentication.jsx";
import Landing from "./pages/Landing";
import { Routes, Route } from "react-router-dom";
import VideoMeet from "./pages/VideoMeet.jsx";

function App() {
  return (
    <>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Authentication />} />
          <Route path="/:id" element={<VideoMeet/>} />
        </Routes>
          <ToastContainer position="top-center" autoClose={2000} />
      </AuthProvider>
    </>
  );
}

export default App;
