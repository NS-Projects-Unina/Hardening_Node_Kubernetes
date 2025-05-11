import { Outlet } from "react-router-dom";
import "./Main.css";
import Topbar from "../../components/NavBar/TopBar";
import Bottombar from "../../components/NavBar/BottomBar";

function Main() {
  return (
    <div className="main-div">
      <Topbar />
      <div className="page-div">
        <Outlet />
      </div>
      <div className="footer-div">
        <div className="left">
          Francesco Scognamiglio M63001364
          <br />
          Felice Micillo M63001377
        </div>
        <div className="right">Powered by ExpSharing</div>
      </div>
      <Bottombar />
    </div>
  );
}

export default Main;
