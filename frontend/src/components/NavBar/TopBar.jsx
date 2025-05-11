import "./Topbar.css";
import { NavLink, useNavigate } from "react-router-dom";
import { FiHome, FiUser, FiSettings, FiUserPlus } from "react-icons/fi";
import { useSelector } from "react-redux";
import { FiLogIn } from "react-icons/fi";
import authApi from "../../services/auth";
import { IoIosLogOut } from "react-icons/io";
const apiEnpoint = import.meta.env.VITE_API_ENDPOINT;

function Topbar() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  function onClickTopBarButton() {
    navigate("/home");
  }

  const onClickLogout = async () => {
    try {
      await authApi.post("/logout", {}, { withCredentials: true });
      window.location.reload();
    } catch (err) {
      //console.log(err);
    }
  };

  return (
    <div className="header-div">
      <div className="topbar-title" onClick={onClickTopBarButton}>
        ExpSharing
      </div>
      <div className="topbar-buttons">
        {isAuthenticated ? (
          <>
            <NavLink to="/home" className="topbar-btn" title="Home">
              <FiHome />
            </NavLink>
            <NavLink to="/profile" className="topbar-btn" title="Profilo">
              <FiUser />
            </NavLink>
            <NavLink to="/settings" className="topbar-btn" title="Impostazioni">
              <FiSettings />
            </NavLink>
            <button
              onClick={onClickLogout}
              className="bottombar-btn"
              title="Esci"
            >
              <IoIosLogOut />
            </button>
          </>
        ) : (
          <>
            <NavLink to="/welcome" className="topbar-btn" title="Benvenuto">
              <FiHome />
            </NavLink>
            <NavLink to="/auth/login" className="topbar-btn" title="Accedi">
              <FiLogIn />
            </NavLink>
            <NavLink
              to="/auth/signup"
              className="topbar-btn"
              title="Registrati"
            >
              <FiUserPlus />
            </NavLink>
          </>
        )}
      </div>
    </div>
  );
}

export default Topbar;
