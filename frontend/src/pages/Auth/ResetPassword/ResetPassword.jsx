import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import authApi from "../../../services/auth.js";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./ResetPassword.css";
import { enqueueSnackbar } from "notistack";
import { isValidPassword } from "../../../libs/validationUtils.js";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { loading } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [errorRepeatPassword, setErrorRepeatPassword] = useState("");
  const [loadingButton, setLoadingButton] = useState(false);

  useEffect(() => {
    if (!token) {
      enqueueSnackbar("URL non valido.", {
        variant: "error",
      });
      navigate("/");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingButton(true);
    setErrorPassword("");
    setErrorRepeatPassword("");
    if (repeatPassword !== password) {
      setErrorRepeatPassword(`Le password non coincidono.`);
      setLoadingButton(false);
      return;
    }
    if (!isValidPassword(password)) {
      setErrorPassword(`La password deve contenere almeno 8 caratteri, almeno una lettera 
    maiuscola e minuscola, un numero ed un carattere speciale.`);
      setLoadingButton(false);
      return;
    }
    try {
      const res = await authApi.post("/reset-password-email-verify", {
        token,
        newPassword: password,
      });
      if (res.data.success) {
        enqueueSnackbar("Password modificata con successo!", {
          variant: "success",
        });
        navigate("/auth/login");
        setLoadingButton(false);
      }
    } catch (err) {
      enqueueSnackbar("Si è verificato un errore. URL non valido.", {
        variant: "error",
      });
      navigate("/");
      setLoadingButton(false);
    }
  };

  return (
    <div className="reset-password-form-div">
      <h1 className="title">Reset Password</h1>
      <div className="description-div">
        Cambia la tua vecchia password con una nuova e conferma.
      </div>
      <form onSubmit={handleSubmit}>
        {errorPassword && <div className="alert">{errorPassword}</div>}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setErrorPassword("");
            setPassword(e.target.value);
          }}
          required
        />
        {errorRepeatPassword && (
          <div className="alert">{errorRepeatPassword}</div>
        )}
        <input
          type="password"
          placeholder="Ripeti password"
          value={repeatPassword}
          onChange={(e) => {
            setErrorRepeatPassword("");
            setRepeatPassword(e.target.value);
          }}
          required
        />
        <div className="actions">
          <button
            className="button"
            type="submit"
            disabled={loading || loadingButton}
          >
            {loadingButton ? "Caricamento..." : "Conferma"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ResetPassword;
