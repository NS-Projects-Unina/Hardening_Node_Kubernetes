import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import authApi from "../../../services/auth.js";
import { useNavigate } from "react-router-dom";
import {
  setAuthenticated,
  setUnauthenticated,
} from "../../../features/auth/authSlice.js";
import client from "../../../services/graphql/apolloClient.js";
import { GET_ME } from "../../../services/graphql/queries.js";
import { store } from "../../../app/store.js";
import "./Login.css";
import Dialog from "../../../components/Dialog/Dialog.jsx";
import { enqueueSnackbar } from "notistack";
import { FiMail } from "react-icons/fi";
import { FiArrowUpRight } from "react-icons/fi";
import { isValidEmail } from "../../../libs/validationUtils.js";

function Login() {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiError, setApiError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [openConfigureTotpDialog, setOpenConfigureTotpDialog] = useState(false);
  const [configureTotp, setConfigureTotp] = useState({});
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [openVerifyTotpDialog, setOpenVerifyTotpDialog] = useState(false);
  const [openVerifyEmailDialog, setOpenVerifyEmailDialog] = useState(false);
  const [openResetPasswordDialog, setOpenResetPasswordDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetEmailError, setResetEmailError] = useState("");
  const apiEndpoint = import.meta.env.VITE_API_ENDPOINT;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authApi.post("/login", {
        email,
        password,
        ...(rememberMe && { remember: true }),
      });
      if (res.data.success) {
        switch (res.data.message) {
          case "configure_otp_required": {
            setOpenConfigureTotpDialog(true);
            setConfigureTotp(res.data.data);
            break;
          }
          case "verify_email_required": {
            setOpenVerifyEmailDialog(true);
            break;
          }
          default: {
            try {
              const { data } = await client.query({
                query: GET_ME,
                fetchPolicy: "no-cache",
              });
              store.dispatch(setAuthenticated(data.me));
            } catch (err) {
              dispatch(setUnauthenticated());
              setOpenVerifyTotpDialog(false);
              setOpenConfigureTotpDialog(false);
              setConfigureTotp({});
              setTotpCode("");
              setTotpError("");
              setApiError(
                "Errore di servizio. Vi invitiamo a provare più tardi."
              );
            }
          }
        }
      }
    } catch (err) {
      dispatch(setUnauthenticated());
      const errorCode = err?.response?.data?.error?.code;
      const errorType = err?.response?.data?.error?.details?.error;
      if (errorCode === "USER_LOGIN_FAILED") {
        switch (errorType) {
          case "invalid_grant": {
            setApiError("Email o passowrd errati.");
            break;
          }
          case "otp_required": {
            if (errorType === "otp_required") {
              setTotpCode("");
              setTotpError("");
              setOpenVerifyTotpDialog(true);
            }
            break;
          }
          default:
            setApiError(
              "Errore di servizio. Vi invitiamo a provare più tardi."
            );
        }
      } else {
        setApiError("Errore di servizio. Vi invitiamo a provare più tardi.");
      }
    }
  };

  const onClickGoogleLogin = async () => {
    window.location.href = `https://${apiEndpoint}/fedauth/google`;
  };

  const handleTotpConfigureSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authApi.post("/otp/verify", {
        email,
        code: totpCode,
      });
      enqueueSnackbar(
        "Codice TOTP configurato con successo! Esegui il login.",
        { variant: "success" }
      );
      setOpenConfigureTotpDialog(false);
      setConfigureTotp("");
      setTotpError("");
      setTotpCode("");
    } catch (err) {
      if (err.response.data.error.code === "OTP_INVALID_CODE") {
        setTotpError("Codice TOTP non valido.");
      } else {
        setTotpError("Errore di servizio. Vi invitiamo a provare più tardi.");
      }
    }
  };

  const handleTotpLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authApi.post("/login", {
        email,
        password,
        ...(rememberMe && { remember: true }),
        otpCode: totpCode,
      });
      if (res.data.success) {
        switch (res.data.message) {
          case "verify_email_required": {
            setOpenVerifyTotpDialog(false);
            setTotpCode("");
            setTotpError("");
            setOpenVerifyEmailDialog(true);
            break;
          }
          default: {
            try {
              const { data } = await client.query({
                query: GET_ME,
                fetchPolicy: "no-cache",
              });
              store.dispatch(setAuthenticated(data.me));
            } catch (err) {
              dispatch(setUnauthenticated());
              setOpenVerifyTotpDialog(false);
              setOpenConfigureTotpDialog(false);
              setConfigureTotp({});
              setTotpCode("");
              setTotpError("");
              setApiError(
                "Errore di servizio. Vi invitiamo a provare più tardi."
              );
            }
          }
        }
      }
    } catch (err) {
      if (err.response.data.error.code === "USER_LOGIN_FAILED") {
        setTotpError("Codice TOTP non valido.");
      } else {
        setTotpError("Errore di servizio. Vi invitiamo a provare più tardi.");
      }
    }
  };

  const handleResetEmailSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(resetEmail)) {
      setResetEmailError("Email inserita non valida.");
      return;
    }
    try {
      const res = await authApi.post("/reset-password-email", {
        email: resetEmail,
      });
      if (res.data.success) {
        enqueueSnackbar("Verifica la tua casella email!", { variant: "info" });
      }
      setResetEmail("");
      setOpenResetPasswordDialog(false);
    } catch (err) {
      if (err.response.data === "Too many requests.") {
        enqueueSnackbar("Troppe richieste riprova più tardi.", {
          variant: "error",
        });
      } else {
        enqueueSnackbar("Verifica la tua casella email!", { variant: "info" });
      }
      setResetEmail("");
      setOpenResetPasswordDialog(false);
    }
  };

  return (
    <div className="login-form-div">
      <h1 className="title">Login</h1>
      <div className="description-div">
        Inserisci le credenziali d'accesso oppure accedi con Google.
      </div>
      <Dialog
        title={"Recupera Password"}
        open={openResetPasswordDialog}
        setOpen={setOpenResetPasswordDialog}
      >
        <div className="dialog-content">
          {`Inserisci la tua email e clicca invia. Se l'indirizzo inserito è associato
          ad un account verrà inviata un'email con il link per il reset della password.
          `}
          {resetEmailError && <div className="alert">{resetEmailError}</div>}
          <input
            type="email"
            className="input-email"
            placeholder="Email"
            value={resetEmail}
            onChange={(e) => {
              setResetEmailError("");
              setResetEmail(e.target.value);
            }}
          />
          <button
            className="button"
            onClick={handleResetEmailSubmit}
            disabled={!resetEmail}
          >
            Invia
          </button>
        </div>
      </Dialog>

      <Dialog
        title={"Verifica la tua email"}
        open={openVerifyEmailDialog}
        setOpen={setOpenVerifyEmailDialog}
      >
        <div className="dialog-content">
          {`Ti è stata inviata un'email per la verifica del tuo account. 
            Controlla la tua casella di posta elettronica e vai al link
            che ti abbiamo inviato per attivare il tuo account.
            `}
          <div className="email-icon-container">
            <FiMail className="email-icon" />
            <FiArrowUpRight className="check-icon" />
          </div>
          <button
            className="button"
            onClick={() => setOpenVerifyEmailDialog(false)}
            disabled={loading}
          >
            Chiudi
          </button>
        </div>
      </Dialog>

      <Dialog
        title={"Configura TOTP"}
        open={openConfigureTotpDialog}
        setOpen={setOpenConfigureTotpDialog}
      >
        <div className="dialog-content">
          {`Configura il TOTP con un'app di autenticazione ( es. DUO mobile, Google Authenticator)
            ed inserisci il codice.
            `}
          <img
            src={`data:image/png;base64,${configureTotp.qrCode}`}
            alt="qrCode"
          />
          <strong>{configureTotp.secret}</strong>
          {totpError && <div className="alert">{totpError}</div>}
          <input
            type="text"
            inputMode="numeric"
            placeholder="Codice TOTP"
            value={totpCode}
            pattern="[0-9]*"
            maxLength={6}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 6) {
                setTotpCode(value);
                setTotpError("");
              }
            }}
          />
          <button
            className="button"
            onClick={handleTotpConfigureSubmit}
            disabled={totpCode.length < 6}
          >
            Verifica
          </button>
        </div>
      </Dialog>

      <Dialog
        title={"Verifica TOTP"}
        open={openVerifyTotpDialog}
        setOpen={setOpenVerifyTotpDialog}
      >
        <div className="dialog-content">
          {`Inserisci il codice TOTP configurato con un app di autenticazione.`}
          {totpError && <div className="alert">{totpError}</div>}
          <input
            type="text"
            inputMode="numeric"
            placeholder="Codice TOTP"
            value={totpCode}
            pattern="[0-9]*"
            maxLength={6}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 6) {
                setTotpCode(value);
                setTotpError("");
              }
            }}
          />
          <button
            className="button"
            onClick={handleTotpLoginSubmit}
            disabled={totpCode.length < 6}
          >
            Verifica
          </button>
        </div>
      </Dialog>

      {apiError && <div className="alert">{apiError}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setApiError("");
          }}
          required
        />
        <br />
        <input
          className="password-input"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setApiError("");
          }}
          required
        />
        <div className="remember-me">
          <label>
            <input
              type="checkbox"
              value={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Ricordami
          </label>
          <a
            className="forgot-password"
            onClick={() => setOpenResetPasswordDialog(true)}
          >
            Hai dimenticato la password?
          </a>
        </div>
        <div className="actions">
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Caricamento..." : "Accedi"}
          </button>
          <div className="divider-horizontal" />
          <button className="button" type="button" onClick={onClickGoogleLogin}>
            Accedi con Google
          </button>
          <a onClick={() => navigate("/auth/signup")} className="action-text">
            Non hai ancora un account? Registrati
          </a>
        </div>
      </form>
    </div>
  );
}

export default Login;
