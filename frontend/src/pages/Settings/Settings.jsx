import { useState, useEffect } from "react";
import { Outlet, useLocation, useMatch } from "react-router-dom";
import SettingsMenu from "./SettingsMenu";
import BackBar from "./BackBar";
import "./Settings.css";

function Settings() {
  const location = useLocation();
  const matchSettingsRoot = useMatch("/settings");

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showSettingsMenu = !isMobile || matchSettingsRoot;

  return (
    <div className="settings-container">
      {showSettingsMenu ? (
        <SettingsMenu />
      ) : (
        <BackBar label="Impostazioni" to="/settings" />
      )}
      <div className="settings-content">
        <Outlet />
        {matchSettingsRoot && (
          <div className="settings-placeholder">
            <p>Seleziona un'opzione dal menu per iniziare</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
