import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setAuthenticated } from "../../../../features/auth/authSlice";
import userApi from "../../../../services/user";
import { enqueueSnackbar } from "notistack";

function UsernameSettings() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.username) {
      setUsername(user.username);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await userApi.post("/edit-username", { username });

      // aggiorna Redux con il nuovo username
      dispatch(setAuthenticated({ ...user, username }));

      enqueueSnackbar("Username aggiornato con successo!", {
        variant: "success",
      });
    } catch (err) {
      console.error("Errore nel salvataggio:", err);
      enqueueSnackbar("Errore durante il salvataggio.", {
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-settings-form">
      <h2>Cambia nome utente</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Nome utente
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
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

export default UsernameSettings;
