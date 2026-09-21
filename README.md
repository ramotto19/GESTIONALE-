# Gestionale Impianti

App per la gestione di cantieri, impianti e interventi di manutenzione, con
i dati salvati direttamente nel Google Drive personale dell'utente (nessun
backend/database proprio: il "cloud di riferimento" e' Google Drive).

- Ogni utente effettua il login con il proprio account Google.
- Al primo accesso l'app crea nel Drive dell'utente una cartella
  **"Gestionale Impianti"** con un file `dati-gestionale.json` (cantieri,
  impianti, interventi) e una sottocartella di allegati per ogni cantiere.
- L'app usa lo scope OAuth `drive.file`: puo' leggere/scrivere **solo** i
  file che crea lei stessa, mai il resto del Drive dell'utente.

## Stack

- React + TypeScript + Vite
- Google Identity Services (OAuth2 token client) per il login
- Google Drive API v3 (REST, via `fetch`) per la persistenza dei dati

## Setup Google Cloud (necessario prima del primo avvio)

1. Vai su [Google Cloud Console](https://console.cloud.google.com/) e crea
   un nuovo progetto (o riusane uno esistente).
2. In **API e servizi > Libreria**, abilita la **Google Drive API**.
3. In **API e servizi > Schermata di consenso OAuth**:
   - Tipo utente: *Esterno* (o *Interno* se hai un Google Workspace).
   - Compila i campi obbligatori (nome app, email di supporto).
   - In *Ambiti* aggiungi `.../auth/drive.file`.
   - In *Utenti di test* aggiungi il/i tuoi account Google (finche' l'app
     non e' verificata da Google, solo questi utenti potranno accedere).
4. In **API e servizi > Credenziali**, crea una credenziale
   **ID client OAuth**, tipo applicazione **Applicazione web**:
   - *Origini JavaScript autorizzate*: aggiungi l'URL da cui servirai
     l'app, es. `http://localhost:5173` (dev) e l'URL di produzione.
   - Non serve un redirect URI (si usa il token client implicito di GIS).
5. Copia il **Client ID** generato.

## Configurazione app

```bash
cp .env.example .env
# apri .env e incolla il Client ID:
# VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

## Avvio in sviluppo

```bash
npm install
npm run dev
```

Apri l'URL indicato (default `http://localhost:5173`), clicca "Accedi con
Google" e autorizza l'accesso ai file creati dall'app.

## Build di produzione

```bash
npm run build
npm run preview
```

Ricorda di aggiungere l'URL di produzione tra le origini JavaScript
autorizzate del Client ID OAuth (passo 4 sopra) e di configurare la
variabile d'ambiente `VITE_GOOGLE_CLIENT_ID` nell'hosting scelto.

## Modello dati

I dati sono organizzati in una gerarchia salvata come singolo file JSON su
Drive:

```
Cantiere
├── impianti[]
│   ├── interventi[]   (manutenzioni/interventi tecnici)
│   └── allegati[]     (riferimenti a file caricati su Drive)
└── allegati[]
```

Gli allegati (foto, certificati, documenti) vengono caricati come file reali
nella sottocartella Drive del cantiere; nel JSON viene salvato solo il
riferimento (id file, nome, link di visualizzazione).
