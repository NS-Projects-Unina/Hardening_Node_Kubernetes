import { NavLink } from "react-router-dom";
import "./Settings.css";

function SettingsMenu() {
  const menuItems = [
    { label: "Profilo", path: "profile" },
    { label: "Sicurezza", path: "security" },
    { label: "Sessioni", path: "sessions" },
  ];

  return (
    <div className="settings-menu">
      {menuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `settings-link${isActive ? " active" : ""}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

export default SettingsMenu;
