import React from "react";
import { Link } from "react-router-dom";
import "../styles/Landing.css";

export default function Landing() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand">
          <Link to={"/home"} className="nav-logo">
            Vyntra
          </Link>
        </div>
        <nav className="landing-nav-links">
          <Link to={"/guest"} className="nav-link">
            Join as Guest
          </Link>
          <Link to={"/auth"} className="nav-link">
            Register
          </Link>
          <Link to={"/auth"} className="nav-link nav-link--button">
            Login
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-left">
          <h1 className="hero-title">
            <span className="accent">Connect</span> with your
            <br /> Loved Ones
          </h1>
          <p className="hero-sub">
            Cover the distance with Vyntra — secure, fast video calls.
          </p>
          <div className="hero-ctas">
            <Link to={"/auth"} className="btn btn-primary">
              Get Started
            </Link>
            <Link to={"/guest"} className="btn btn-outline">
              Join as Guest
            </Link>
          </div>
        </div>
        <div className="hero-right" aria-hidden>
          {/* background image handled in CSS to avoid layout shift; falls back to /background.png */}
        </div>
      </section>
    </main>
  );
}
