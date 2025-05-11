import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import userApi from "../../../../services/user";
import { enqueueSnackbar } from "notistack";
import { setAuthenticated } from "../../../../features/auth/authSlice";

function EmailSettings() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await userApi.post("/edit-email", { email });

      // Aggiorna Redux con la nuova email
      dispatch(setAuthenticated({ ...user, email }));

      enqueueSnackbar("Email aggiornata con successo!", {
        variant: "success",
      });
    } catch (err) {
      console.error("Errore nel salvataggio:", err);
      enqueueSnackbar("Errore durante il salvataggio dell'email.", {
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-settings-form">
      <h2>Cambia email</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={50}
            required
          />
        </label>
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Salvataggio..." : "Salva"}
        </button>
      </form>
    </div>
  );
}

export default EmailSettings;
