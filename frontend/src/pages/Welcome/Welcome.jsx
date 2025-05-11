import { useNavigate } from "react-router-dom";
import "./Welcome.css";

function Welcome() {
  const navigate = useNavigate();

  const onClickLoginPage = () => {
    navigate("/auth/login");
  };
  return (
    <div className="container">
      <div className="logo">ExpSharing</div>
      <section className="hero">
        <h1>Condividi le tue esperienze con la nostra Community</h1>
        <p>Connect, learn, and grow by sharing your stories and insights.</p>
        <div className="buttons">
          <button id="join-button" onClick={() => navigate("/auth/signup")}>
            Unisciti alla Community
          </button>
          <button id="login-button" onClick={() => navigate("/auth/login")}>
            Accedi
          </button>
        </div>
      </section>
    </div>
  );
}

export default Welcome;
