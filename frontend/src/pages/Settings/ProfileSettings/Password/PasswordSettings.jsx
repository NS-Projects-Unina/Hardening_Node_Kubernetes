import { useState } from "react";
import userApi from "../../../../services/user.js";
import { enqueueSnackbar } from "notistack";
import { isValidPassword } from "../../../../libs/validationUtils.js";
import "./PasswordSettings.css";

function PasswordSettings() {
  const [password, setPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [errorRepeatPassword, setErrorRepeatPassword] = useState("");
  const [loadingButton, setLoadingButton] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorPassword("");
    setErrorRepeatPassword("");
    setLoadingButton(true);

    if (password !== repeatPassword) {
      setErrorRepeatPassword("Le password non coincidono.");
      setLoadingButton(false);
      return;
    }

    if (!isValidPassword(password)) {
      setErrorPassword(
        `La password deve contenere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale.`
      );
      setLoadingButton(false);
      return;
    }

    try {
      await userApi.post("/edit-password", {
        password,
        repeatPassword,
      });

      enqueueSnackbar("Password aggiornata con successo!", {
        variant: "success",
      });

      setPassword("");
      setRepeatPassword("");
    } catch (err) {
      enqueueSnackbar("Errore durante l'aggiornamento della password.", {
        variant: "error",
      });
    } finally {
      setLoadingButton(false);
    }
  };

  return (
    <div className="profile-settings-form">
      <h2>Cambia password</h2>
      <form onSubmit={handleSubmit}>
        {errorPassword && <div className="alert">{errorPassword}</div>}
        <input
          type="password"
          placeholder="Nuova password"
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
          placeholder="Ripeti nuova password"
          value={repeatPassword}
          onChange={(e) => {
            setErrorRepeatPassword("");
            setRepeatPassword(e.target.value);
          }}
          required
        />
        <div className="actions">
          <button className="button" type="submit" disabled={loadingButton}>
            {loadingButton ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PasswordSettings;
