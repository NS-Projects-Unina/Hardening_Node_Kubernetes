import { useEffect, useState } from "react";
import userApi from "../../../services/user";
import "./Sessions.css"; // se vuoi separare stile

function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await userApi.get("/sessions");
        setSessions(res.data?.data?.sessions || []);
      } catch (err) {
        console.error("Errore nel caricamento sessioni:", err);
        setError("Errore nel caricamento delle sessioni.");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const deleteSession = async (sessionId) => {
    try {
      await userApi.delete("/delete-session", {
        data: { sessionId },
      });
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      console.error("Errore nella cancellazione sessione:", err);
      alert("Errore nella cancellazione della sessione.");
    }
  };

  if (loading) return <p>🔄 Caricamento sessioni...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="profile-settings-form">
      <h2>Sessioni attive</h2>
      <ul className="session-list">
        {sessions.map((session) => (
          <li
            key={session.sessionId}
            className={`session-item ${
              session.isCurrent ? "current-session" : ""
            }`}
          >
            <p>
              <strong>IP:</strong> {session.ipAddress}
            </p>
            <p>
              <strong>Inizio:</strong>{" "}
              {new Date(session.start).toLocaleString()}
            </p>
            <p>
              <strong>Ultimo accesso:</strong>{" "}
              {new Date(session.lastAccess).toLocaleString()}
            </p>
            {session.rememberMe && (
              <p>
                <em>Remember me attivo</em>
              </p>
            )}
            {session.isCurrent && (
              <p className="current-label">✔️ Sessione attuale</p>
            )}
            {!session.isCurrent && (
              <button
                className="delete-session-btn"
                onClick={() => deleteSession(session.sessionId)}
              >
                ❌ Elimina
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sessions;
