import React from "react";
import "./Dialog.css";
import { FiX } from "react-icons/fi";

function Dialog({ open, setOpen, title, fullscreen = false, children }) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div className={`dialog-container ${fullscreen ? "fullscreen" : ""}`}>
        <div className="dialog-header">
          <h2>{title}</h2>
          <button
            className="dialog-close-button"
            onClick={() => setOpen(false)}
          >
            <FiX />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

export default Dialog;
