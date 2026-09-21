import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login, status, error, clientIdConfigured } = useAuth();

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Gestionale Impianti</h1>
        <p className="muted">
          Gestisci cantieri, impianti e interventi con i dati salvati in modo sicuro nel tuo
          Google Drive personale.
        </p>

        {!clientIdConfigured && (
          <p className="alert alert-warning">
            L'app non e' ancora configurata con un Google OAuth Client ID. Vedi il file README.md
            per le istruzioni di setup.
          </p>
        )}

        {error && <p className="alert alert-danger">{error}</p>}

        <button
          className="btn btn-primary"
          onClick={login}
          disabled={status === "loading" || !clientIdConfigured}
        >
          {status === "loading" ? "Accesso in corso..." : "Accedi con Google"}
        </button>

        <p className="muted small">
          Verra' creata una cartella "Gestionale Impianti" nel tuo Drive: l'app potra' leggere e
          scrivere solo i file che crea al suo interno.
        </p>
      </div>
    </div>
  );
}
