"use client";

import React from "react";
import "./LoadingSpinner.css";

//full-screen overlay that shows the branded loading gif while content is fetching
const LoadingSpinner = () => {
  return (
    <div className="spinner-overlay">
      <img src="/loading.gif" alt="Loading..." className="spinner-gif" />
    </div>
  );
};

export default LoadingSpinner;
