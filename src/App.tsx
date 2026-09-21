import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useGestionaleData } from "./context/DataContext";
import { Login } from "./components/Login";
import { Header } from "./components/Header";
import { CantieriList } from "./components/CantieriList";
import { CantiereDetail } from "./components/CantiereDetail";
import { ImpiantoDetail } from "./components/ImpiantoDetail";

type View =
  | { name: "list" }
  | { name: "cantiere"; cantiereId: string }
  | { name: "impianto"; cantiereId: string; impiantoId: string };

function Workspace() {
  const { syncStatus, error } = useGestionaleData();
  const [view, setView] = useState<View>({ name: "list" });

  return (
    <>
      <Header onHome={() => setView({ name: "list" })} />
      <main className="app-main">
        {syncStatus === "loading" && <p className="muted">Caricamento dati da Google Drive...</p>}
        {syncStatus === "error" && error && <p className="alert alert-danger">{error}</p>}

        {syncStatus !== "loading" && (
          <>
            {view.name === "list" && (
              <CantieriList onOpenCantiere={(id) => setView({ name: "cantiere", cantiereId: id })} />
            )}
            {view.name === "cantiere" && (
              <CantiereDetail
                cantiereId={view.cantiereId}
                onBack={() => setView({ name: "list" })}
                onOpenImpianto={(impiantoId) =>
                  setView({ name: "impianto", cantiereId: view.cantiereId, impiantoId })
                }
              />
            )}
            {view.name === "impianto" && (
              <ImpiantoDetail
                cantiereId={view.cantiereId}
                impiantoId={view.impiantoId}
                onBack={() => setView({ name: "cantiere", cantiereId: view.cantiereId })}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}

function AuthGate() {
  const { status } = useAuth();
  if (status !== "authenticated") {
    return <Login />;
  }
  return (
    <DataProvider>
      <Workspace />
    </DataProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
