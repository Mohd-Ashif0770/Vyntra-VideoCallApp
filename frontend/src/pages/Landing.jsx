import React from "react";
import {Link} from "react-router-dom"

export default function Landing() {
  return (
    <div className="landingPageContainer">
      <nav className="navContainer">
        <div>
          <Link to={"/home"} className="navLogo">Vyntra</Link>
        </div>
        <div className="navList">
          <div className="navOptions">
            <Link to={"/guest"}  className="navItem">Join as Guest</Link>
            <Link to={"/register"} className="navItem">Register</Link>
            <Link to={"/login"} className="navItem" id="loginBtn">Login</Link>
          </div>
        </div>
      </nav>
      <div className="imageContainer">
        <div className="leftContainer">
            <h1><span style={{color:"#ff9839"}}>Connect</span> with your <br /> Loved Ones</h1>
            <p className="leftPara">Cover a distance by Vyntra</p>
            <div role="button">
              <Link to={"/auth"} className="getStartedBtn">Get Started</Link>
            </div>
        </div>
        <div className="rightContainer">
            <img src="mobile.png" alt="mobile-image" />
        </div>
      </div>
    </div>
  );
}
