import { useState } from "react";
import { useSelector } from "react-redux";
import authApi from "../../../services/auth.js";
import { useNavigate } from "react-router-dom";
import "./Signup.css";
import { enqueueSnackbar } from "notistack";
import {
  isValidPassword,
  isValidUsername,
} from "../../../libs/validationUtils.js";

function Signup() {
  const { loading } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [errorUsername, setErrorUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [errorRepeatPassword, setErrorRepeatPassword] = useState("");
  const [apiError, setApiError] = useState("");
  const [loadingButton, setLoadingButton] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingButton(true);
    setErrorPassword("");
    setErrorRepeatPassword("");
    setErrorUsername("");
    setApiError("");
    if (!isValidUsername(username)) {
      setErrorUsername(
        `L'username deve contenere almeno 8 caratteri e può contenere solo i
         caratteri speciali _ e .`
      );
      setLoadingButton(false);
      return;
    }
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
      const res = await authApi.post("/signup", {
        password,
        repeatPassword,
        email,
        username,
      });
      if (res.data.success) {
        enqueueSnackbar("Utente registrato con successo! Effettua l'accesso.", {
          variant: "success",
        });
        navigate("/auth/login");
        setLoadingButton(false);
      }
    } catch (err) {
      switch (err?.response?.data?.error?.code) {
        case "USER_EXISTS_USERNAME": {
          setApiError("Username già in uso. Per favore scegline un altro.");
          break;
        }
        case "USER_EXISTS_EMAIL": {
          setApiError(
            "Questa email è già stata utilizzata per un altro account."
          );
          break;
        }
        default: {
          setApiError("Errore di servizio. Vi invitiamo a provare più tardi.");
        }
      }
      setLoadingButton(false);
    }
  };

  return (
    <div className="signup-form-div">
      <h1 className="title">Registrati</h1>
      <div className="description-div">
        Registrati ed entra a far parte della nostra Community!
        <br />
        Compila il form con le tue informazioni.
      </div>
      {apiError && <div className="alert">{apiError}</div>}

      <form onSubmit={handleSubmit}>
        {errorUsername && <div className="alert">{errorUsername}</div>}
        <input
          type="text"
          placeholder="Username"
          autoComplete="username"
          value={username}
          spellCheck={false}
          onChange={(e) => {
            setErrorUsername("");
            setUsername(e.target.value.replace(/\s/g, ""));
            setApiError("");
          }}
          required
        />
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setApiError("");
          }}
          required
        />
        {errorPassword && <div className="alert">{errorPassword}</div>}
        <input
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setErrorPassword("");
            setPassword(e.target.value);
            setApiError("");
            setApiError("");
          }}
          required
        />
        {errorRepeatPassword && (
          <div className="alert">{errorRepeatPassword}</div>
        )}
        <input
          type="password"
          placeholder="Ripeti password"
          autoComplete="new-password"
          value={repeatPassword}
          onChange={(e) => {
            setErrorRepeatPassword("");
            setRepeatPassword(e.target.value);
            setApiError("");
            setApiError("");
          }}
          required
        />
        <div className="actions">
          <button
            className="button"
            type="submit"
            disabled={loading || loadingButton}
          >
            {loadingButton ? "Caricamento..." : "Registrati"}
          </button>
          <div className="divider-horizontal" />
          <a onClick={() => navigate("/auth/login")}>
            Hai già un account? Accedi
          </a>
        </div>
      </form>
    </div>
  );
}

export default Signup;
