import React, { useContext, useState } from "react";
import { AuthContext } from "../contexts/authContext";

export function Authentication() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formState, setFormState] = useState("signin"); // "signin" or "signup"

  const { handleLogin, handleRegister } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (formState === "signin") {
        await handleLogin(username, password);
      } else {
        await handleRegister(name, username, password);

        // ✅ After successful registration:
        // Show success toast (already handled in context)
        // Then automatically switch to Sign In form
        setFormState("signin");
        setName("");
        setUsername("");
        setPassword("");
      }
    } catch (err) {
      console.error("Authentication error:", err);
      // Toastify handles error, no alert needed
    }
  };

  const toggleForm = () => {
    setFormState(formState === "signin" ? "signup" : "signin");
    setName("");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-4">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-4">
              <h3 className="text-center mb-4 fw-bold">
                {formState === "signin" ? "Sign In" : "Sign Up"}
              </h3>

              <form onSubmit={handleSubmit}>
                {/* Full name only in Sign Up */}
                {formState === "signup" && (
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label fw-semibold">
                      Full Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="name"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="username" className="form-label fw-semibold">
                    Username
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label fw-semibold">
                    Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 fw-semibold"
                >
                  {formState === "signin" ? "Sign In" : "Sign Up"}
                </button>
              </form>

              <div className="text-center mt-3">
                {formState === "signin" ? (
                  <p>
                    Don’t have an account?{" "}
                    <button
                      type="button"
                      className="btn btn-link p-0"
                      onClick={toggleForm}
                    >
                      Sign Up
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="btn btn-link p-0"
                      onClick={toggleForm}
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
