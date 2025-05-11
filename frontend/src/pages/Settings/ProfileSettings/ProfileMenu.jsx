import { NavLink } from "react-router-dom";
import "../Settings.css"; // riusa lo stesso stile di settings-link

function ProfileMenu() {
  const menuItems = [
    { label: "Nome utente", path: "username" },
    { label: "Email", path: "email" },
    { label: "Password", path: "password" },
  ];

  return (
    <div className="profile-menu">
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

export default ProfileMenu;
