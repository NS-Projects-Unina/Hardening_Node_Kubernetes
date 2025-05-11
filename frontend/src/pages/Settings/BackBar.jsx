import { useNavigate } from "react-router-dom";
import "./BackBar.css";

function BackBar({ label, to }) {
  const navigate = useNavigate();

  return (
    <div className="backbar">
      <button onClick={() => navigate(to)}>← {label}</button>
    </div>
  );
}

export default BackBar;
