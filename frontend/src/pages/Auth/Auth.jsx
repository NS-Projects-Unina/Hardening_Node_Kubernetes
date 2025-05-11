import { Outlet } from "react-router-dom";
import "./Auth.css";
import { useSelector } from "react-redux";

function Auth() {
  const { isAuthenticated } = useSelector((state) => state.auth);
  if (isAuthenticated) return <Navigate to="/" />;
  return (
    <div className="auth-div">
      <div className="logo">ExpSharing</div>
      <div className="form-div">
        <Outlet />
      </div>
    </div>
  );
}

export default Auth;
