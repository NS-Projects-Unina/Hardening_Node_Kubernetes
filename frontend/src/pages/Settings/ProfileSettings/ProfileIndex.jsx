import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import ProfileMenu from "./ProfileMenu";
import BackBar from "../BackBar";
import "./ProfileIndex.css";

function ProfileIndex() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isOnMainProfilePage = location.pathname === "/settings/profile";

  return (
    <div className="profile-settings-container">
      {isOnMainProfilePage ? (
        <ProfileMenu />
      ) : (
        <BackBar label="Profilo" to="/settings/profile" />
      )}

      <div className="profile-settings-content">
        <Outlet />
      </div>
    </div>
  );
}

export default ProfileIndex;
