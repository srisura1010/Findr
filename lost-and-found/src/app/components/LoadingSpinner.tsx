"use client";

import React from "react";
import "./LoadingSpinner.css";

const LoadingSpinner = () => {
  return (
    <div className="spinner-overlay">
      <img
        src="/loading.gif"
        alt="Loading..."
        className="spinner-gif" />
      
    </div>);

};

export default LoadingSpinner;
