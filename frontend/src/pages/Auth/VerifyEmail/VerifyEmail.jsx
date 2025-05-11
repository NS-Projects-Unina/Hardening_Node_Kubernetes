import { useEffect, useState } from "react";
import authApi from "../../../services/auth.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./VerifyEmail.css";
import { enqueueSnackbar } from "notistack";
import { FiMail } from "react-icons/fi";
import { FaCheckCircle, FaSpinner } from "react-icons/fa";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      enqueueSnackbar("URL non valido.", {
        variant: "error",
      });
      navigate("/");
    } else {
      handleSubmit();
    }
  }, [token]);

  const handleSubmit = async () => {
    try {
      const res = await authApi.post("/email-verify", {
        token,
      });
      if (res.data.success) {
        enqueueSnackbar("Email verificata con successo!", {
          variant: "success",
        });
        setLoading(false);
        setTimeout(() => {
          navigate("/auth/login");
        }, 10000);
      }
    } catch (err) {
      enqueueSnackbar("Si è verificato un errore. URL non valido.", {
        variant: "error",
      });
      navigate("/");
    }
  };

  return (
    <div className="verify-email-form-div">
      <h1 className="title">Verifica Email</h1>
      <div className="verify-email-message">
        {loading ? (
          <>
            <div className="email-icon-container">
              <FiMail className="email-icon" />
              <FaSpinner className="check-icon" />
            </div>
            <strong>E' in corso la verifica dell'email, attendere...</strong>
          </>
        ) : (
          <>
            <div className="email-icon-container">
              <FiMail className="email-icon" />
              <FaCheckCircle className="check-icon-static" />
            </div>
            <strong>
              Email verificata con successo!
              <br />
              Tra 10 secondi verrai reindirizzato alla pagina principale.
            </strong>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
