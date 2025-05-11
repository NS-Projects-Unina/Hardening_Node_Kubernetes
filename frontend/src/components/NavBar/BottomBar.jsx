import "./BottomBar.css";
import { NavLink, useNavigate } from "react-router-dom";
import { FiHome, FiUser, FiSettings, FiUserPlus } from "react-icons/fi";
import { useSelector } from "react-redux";
import { FiLogIn } from "react-icons/fi";
import authApi from "../../services/auth";
import { IoIosLogOut } from "react-icons/io";

function Bottombar() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  const onClickLogout = async () => {
    try {
      await authApi.post("/logout", {}, { withCredentials: true });
      window.location.reload();
    } catch (err) {
      //console.log(err);
    }
  };
  return (
    <div className="bottombar-div">
      <div className="bottombar-buttons">
        {isAuthenticated ? (
          <>
            <NavLink to="/home" className="bottombar-btn" title="Home">
              <FiHome />
            </NavLink>
            <NavLink to="/profile" className="bottombar-btn" title="Profilo">
              <FiUser />
            </NavLink>
            <NavLink
              to="/settings"
              className="bottombar-btn"
              title="Impostazioni"
            >
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
            <NavLink to="/welcome" className="bottombar-btn" title="Benvenuto">
              <FiHome />
            </NavLink>
            <NavLink to="/auth/login" className="bottombar-btn" title="Accedi">
              <FiLogIn />
            </NavLink>
            <NavLink
              to="/auth/signup"
              className="bottombar-btn"
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

export default Bottombar;
