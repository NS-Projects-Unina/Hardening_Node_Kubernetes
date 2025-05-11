import { useEffect, useState } from "react";
import userApi from "../../../services/user";
import Dialog from "../../../components/Dialog/Dialog";
import { enqueueSnackbar } from "notistack";
import "./SecuritySettings.css";

function SecuritySettings() {
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configureTotp, setConfigureTotp] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

  const [openDisableDialog, setOpenDisableDialog] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState("");

  useEffect(() => {
    const loadOtpStatus = async () => {
      try {
        const res = await userApi.get("/configure-otp");
        if (res.data?.data) {
          setConfigureTotp(res.data.data);
          setOtpEnabled(false);
        } else {
          setOtpEnabled(true);
        }
      } catch (err) {
        const code = err?.response?.data?.error?.code;
        if (code === "OTP_ALREADY_ENABLED") {
          setOtpEnabled(true);
          setConfigureTotp(null);
          enqueueSnackbar("La verifica in due passaggi è già attiva.", {
            variant: "info",
          });
        } else {
          console.error("Errore nel caricamento OTP:", err);
          enqueueSnackbar("Errore nel caricamento della configurazione OTP.", {
            variant: "error",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadOtpStatus();
  }, []);

  const handleVerifyTotp = async () => {
    try {
      await userApi.post("/verify-otp", { code: totpCode });
      enqueueSnackbar("OTP abilitato con successo!", { variant: "success" });
      setOtpEnabled(true);
      setOpenDialog(false);
      setTotpCode("");
      setTotpError("");
    } catch (err) {
      if (err?.response?.data?.error?.code === "OTP_INVALID_CODE") {
        setTotpError("Codice OTP non valido.");
      } else {
        enqueueSnackbar("Errore durante l'attivazione dell'OTP.", {
          variant: "error",
        });
      }
    }
  };

  const handleDisableOtpSubmit = async () => {
    try {
      await userApi.post("/disable-otp", { code: disableCode });
      enqueueSnackbar("OTP disattivato con successo.", { variant: "info" });
      setOtpEnabled(false);
      setOpenDisableDialog(false);
      setDisableCode("");
      setDisableError("");
    } catch (err) {
      const errorCode = err?.response?.data?.error?.code;
      if (errorCode === "OTP_INVALID_CODE") {
        setDisableError("Codice OTP non valido.");
      } else if (errorCode === "CODE_FIELD_EMPTY") {
        setDisableError("Il codice OTP è obbligatorio.");
      } else {
        enqueueSnackbar("Errore durante la disattivazione dell'OTP.", {
          variant: "error",
        });
      }
    }
  };

  if (loading) return <p>🔄 Caricamento impostazioni di sicurezza...</p>;

  return (
    <div className="profile-settings-form">
      <h2>Sicurezza account</h2>
      <div className="security-section">
        <h3>Autenticazione a due fattori (TOTP)</h3>
        {otpEnabled ? (
          <div className="otp-status active">
            <p>✅ La verifica in due passaggi è attiva sul tuo account.</p>
            <button
              className="button danger"
              onClick={() => setOpenDisableDialog(true)}
            >
              Disattiva OTP
            </button>
          </div>
        ) : (
          <div className="otp-status inactive">
            <p>⚠️ La verifica in due passaggi non è attiva.</p>
            <button
              className="button"
              onClick={() => setOpenDialog(true)}
              disabled={!configureTotp}
            >
              Abilita OTP
            </button>
          </div>
        )}
      </div>

      {/* Abilitazione OTP */}
      <Dialog title="Configura OTP" open={openDialog} setOpen={setOpenDialog}>
        <div className="dialog-content">
          <p>
            Scansiona il QR code con un'app come Google Authenticator o DUO, poi
            inserisci il codice di 6 cifre generato.
          </p>
          {configureTotp && (
            <>
              <img
                src={`data:image/png;base64,${configureTotp.qrCode}`}
                alt="QR Code OTP"
                className="otp-qr"
              />
              <p className="otp-secret">
                <strong>{configureTotp.secret}</strong>
              </p>
            </>
          )}
          {totpError && <div className="alert">{totpError}</div>}
          <input
            type="text"
            inputMode="numeric"
            placeholder="Codice OTP"
            value={totpCode}
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
            onClick={handleVerifyTotp}
            disabled={totpCode.length < 6}
          >
            Verifica codice
          </button>
        </div>
      </Dialog>

      {/* Disabilitazione OTP */}
      <Dialog
        title="Disattiva OTP"
        open={openDisableDialog}
        setOpen={setOpenDisableDialog}
      >
        <div className="dialog-content">
          <p>
            Inserisci il codice OTP generato dalla tua app per disattivare la
            verifica in due passaggi.
          </p>
          {disableError && <div className="alert">{disableError}</div>}
          <input
            type="text"
            inputMode="numeric"
            placeholder="Codice OTP"
            value={disableCode}
            maxLength={6}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 6) {
                setDisableCode(value);
                setDisableError("");
              }
            }}
          />
          <button
            className="button danger"
            onClick={handleDisableOtpSubmit}
            disabled={disableCode.length < 6}
          >
            Disattiva
          </button>
        </div>
      </Dialog>
    </div>
  );
}

export default SecuritySettings;
