import "./App.css";
import { AuthProvider } from "./contexts/authContext.jsx";
import { Authentication } from "./pages/Authentication.jsx";
import Landing from "./pages/Landing";
import { Routes, Route } from "react-router-dom";

function App() {
  return (
    <>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Authentication />} />
        </Routes>
      </AuthProvider>
    </>
  );
}

export default App;
