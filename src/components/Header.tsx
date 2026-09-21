import { useAuth } from "../context/AuthContext";
import { useGestionaleData } from "../context/DataContext";

const SYNC_LABEL: Record<string, string> = {
  idle: "",
  loading: "Caricamento da Drive...",
  saving: "Salvataggio su Drive...",
  saved: "Sincronizzato con Drive",
  error: "Errore di sincronizzazione",
};

export function Header({
  onHome,
}: {
  onHome: () => void;
}) {
  const { user, logout } = useAuth();
  const { syncStatus } = useGestionaleData();

  return (
    <header className="app-header">
      <button className="app-title" onClick={onHome}>
        Gestionale Impianti
      </button>
      <div className="header-right">
        <span className={`sync-indicator sync-${syncStatus}`}>{SYNC_LABEL[syncStatus]}</span>
        {user && (
          <div className="user-chip">
            {user.picture && <img src={user.picture} alt="" className="avatar" />}
            <span>{user.name}</span>
          </div>
        )}
        <button className="btn btn-ghost" onClick={logout}>
          Esci
        </button>
      </div>
    </header>
  );
}
