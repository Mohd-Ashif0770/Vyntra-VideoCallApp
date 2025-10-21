import React from "react";

export default function Landing() {
  return (
    <div className="landingPageContainer">
      <nav className="navContainer">
        <div className="navLogo">
          <h2>Vyntra</h2>
        </div>
        <div className="navList">
          <div className="navOptions">
            <a>Join as Guest</a>
            <a>Register</a>
            <a>Login</a>
          </div>
        </div>
      </nav>
      <div className="imageContainer">
        <div className="leftContainer">
            <h1>Connect with your <br /> Loved Ones</h1>
            <p>Cover a distance by Vyntra</p>
            <button>Get Started</button>
        </div>
        <div className="rightContainer">
            <img src="mobile.png" alt="mobile-image" />
        </div>
      </div>
    </div>
  );
}
