import { useSelector } from "react-redux";
import userApi from "../../services/user.js";
import "./Home.css";
import { useNavigate } from "react-router-dom";
import Experiences from "../../components/Experiences/Experiences.jsx";
function Home() {
  const { loading, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  return (
    <div className="home-div">
      <Experiences />
    </div>
  );
}

export default Home;
