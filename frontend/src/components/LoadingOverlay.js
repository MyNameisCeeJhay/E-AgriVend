import React from 'react';
import './LoadingOverlay.css';

const LoadingOverlay = ({ message = 'Loading...', subtext = 'Please wait' }) => {
  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">{message}</div>
        <div className="loading-subtext">{subtext}</div>
        <div className="progress-bar">
          <div className="progress-bar-fill"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;