import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import Login from "./pages/Auth/Login/Login";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { checkAuth } from "./features/auth/authSlice";
import "./App.css";
import PublicRoute from "./components/PublicRoute";
import Home from "./pages/Home/Home";
import Main from "./pages/Main/Main";
import Welcome from "./pages/Welcome/Welcome";
import Auth from "./pages/Auth/Auth";
import Signup from "./pages/Auth/Signup/Signup";
import ResetPassword from "./pages/Auth/ResetPassword/ResetPassword";
import VerifyEmail from "./pages/Auth/VerifyEmail/VerifyEmail";
import Profile from "./pages/Profile/Profile";
import Settings from "./pages/Settings/Settings";
import ProfileIndex from "./pages/Settings/ProfileSettings/ProfileIndex";
import UsernameSettings from "./pages/Settings/ProfileSettings/Username/UsernameSettings";
import EmailSettings from "./pages/Settings/ProfileSettings/Email/EmailSettings";
import Sessions from "./pages/Settings/Sessions/Sessions";
import PasswordSettings from "./pages/Settings/ProfileSettings/Password/PasswordSettings";
import SecuritySettings from "./pages/Settings/SecuritySettings/SecuritySettings";

function App() {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, []);

  if (loading)
    return (
      <div className="loading-overlay">
        <div className="loading-text">ExpSharing</div>
      </div>
    );

  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect esplicito dalla root */}
        <Route path="/" element={<Navigate to="/welcome" replace />} />

        {/* Public */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <Main />
            </PublicRoute>
          }
        >
          <Route path="welcome" element={<Welcome />} />
          <Route path="auth" element={<Auth />}>
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="verify-email" element={<VerifyEmail />} />
          </Route>
        </Route>

        {/* Protected */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Main />
            </PrivateRoute>
          }
        >
          <Route path="home" element={<Home />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />}>
            <Route path="profile" element={<ProfileIndex />}>
              <Route path="username" element={<UsernameSettings />} />
              <Route path="email" element={<EmailSettings />} />
              <Route path="password" element={<PasswordSettings />} />
            </Route>
            <Route path="security" element={<SecuritySettings />} />
            <Route path="sessions" element={<Sessions />} />
          </Route>
        </Route>

        {/* Catch-all finale */}
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
