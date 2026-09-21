# Gestionale Impianti

App gestionale completa per un'impresa di impiantistica/installazioni: commesse con iter
(preventivo → conferma d'ordine → POS → progetto → materiali → cantiere → collaudo → DICO →
fattura di saldo), planning settimanale delle squadre con controlli di sicurezza automatici,
scadenzario unificato, personale (formazione/abilitazioni), azienda (DURC, assicurazioni,
mezzi), gestione documentale con categorie riservate, verbali con azioni, registro ore con
approvazione mensile ed export per le paghe, e un editor per personalizzare pagine/campi/liste
senza toccare il codice.

Questa è la stessa identica applicazione — stesse schermate, stesse regole, stessa logica —
ma resa **standalone**, con **Google** come unico "cloud" di riferimento: login con Google,
dati salvati su Google Sheets, allegati su Google Drive. Non serve alcun server a pagamento.

## Architettura

- **`index.html`** — l'intera app (HTML + CSS + JavaScript, nessuna build necessaria). È il
  file dell'artifact originale, quasi del tutto invariato: solo il punto di accesso ai dati è
  stato sostituito con l'autenticazione Google e il backend descritto sotto.
- **`apps-script/`** — un piccolo backend **Google Apps Script**, che gira gratuitamente sul
  tuo account Google. Serve per applicare *davvero* i permessi (un dipendente non può leggere
  ore altrui o documenti riservati nemmeno aggirando l'interfaccia): verifica l'identità di chi
  chiama, decide cosa può leggere/scrivere, e salva tutto in un Google Sheet (i dati) e in una
  cartella Google Drive (gli allegati).

Più persone (titolare e dipendenti) possono accedere ciascuna con il proprio account Google:
il backend riconosce chi sei e applica il ruolo giusto.

## Setup (una tantum)

### 1. Crea il backend Google Apps Script

1. Vai su [script.google.com](https://script.google.com) → **Nuovo progetto**.
2. Rinominalo (es. "Gestionale Impianti — backend").
3. Sostituisci il contenuto di `Code.gs` con quello di [`apps-script/Code.gs`](apps-script/Code.gs) di questo repository.
4. Apri **Impostazioni progetto** (icona ingranaggio) → spunta "Mostra file manifest `appsscript.json`", poi sostituisci il suo contenuto con quello di [`apps-script/appsscript.json`](apps-script/appsscript.json).
5. Nell'editor, seleziona la funzione `setup` dal menu a tendina in alto e premi **Esegui**. La prima volta Google chiederà di autorizzare lo script (è normale: sta creando il tuo Google Sheet e la tua cartella Drive). Controlla i log (Visualizza → Log) per gli URL creati.

### 2. Crea l'OAuth Client ID di Google ("Accedi con Google")

1. Vai su [Google Cloud Console](https://console.cloud.google.com/) → crea o riusa un progetto.
2. **API e servizi → Schermata di consenso OAuth**: tipo *Esterno*, compila nome app ed email di supporto. Non servono ambiti (scope) aggiuntivi: si usa solo l'identità di base.
3. **API e servizi → Credenziali → Crea credenziali → ID client OAuth**, tipo **Applicazione web**.
4. In *Origini JavaScript autorizzate* aggiungi l'URL da cui servirai `index.html` (es. `https://tuonome.github.io` per GitHub Pages, oppure `http://localhost:8080` per test locali).
5. Copia il **Client ID** generato (finisce in `.apps.googleusercontent.com`).

### 3. Collega Client ID e Apps Script

1. Torna nell'editor di Apps Script, seleziona la funzione `setClientId`, e prima di eseguirla scrivi nel campo argomenti (o modifica temporaneamente la riga `function setClientId(clientId)` chiamandola in fondo al file con `setClientId('IL_TUO_CLIENT_ID.apps.googleusercontent.com');`) — poi **Esegui**.
2. **Deploy → Nuovo deployment**: tipo *App web*. Esegui come **Me**, chi ha accesso **Chiunque**. Premi **Esegui il deployment** e autorizza se richiesto.
3. Copia l'**URL dell'app web** generato (finisce in `/exec`).

### 4. Configura `index.html`

Apri `index.html` e cerca (vicino alla fine del file) il blocco:

```js
const CONFIG = {
  CLIENT_ID: '',
  SCRIPT_URL: ''
};
```

Incolla il Client ID (passo 2) e l'URL del Web App (passo 3):

```js
const CONFIG = {
  CLIENT_ID: '123456789-xxxxxxxx.apps.googleusercontent.com',
  SCRIPT_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};
```

### 5. Pubblica `index.html`

Basta un hosting statico qualunque: GitHub Pages, Netlify, Vercel, o anche solo un server
locale per test (`python3 -m http.server` dalla cartella del progetto). L'importante è che
l'URL da cui apri la pagina corrisponda a una delle *Origini JavaScript autorizzate* impostate
al passo 2 (il login Google non funziona aprendo il file con `file://`).

### 6. Primo accesso

La prima persona che accede con "Accedi con Google" diventa automaticamente **amministratore**.
Da lì, l'amministratore può aggiungere dipendenti dalla sezione **Ore del personale › Accessi**,
inserendo il loro indirizzo Gmail e il ruolo (dipendente o amministrazione): potranno accedere
subito con il proprio account Google, ciascuno vedendo solo ciò che gli compete.

## Limiti da conoscere

- **Sincronizzazione**: non essendoci un database in tempo reale, l'app controlla gli
  aggiornamenti ogni ~15 secondi (invece che istantaneamente). Per un gestionale aziendale è
  un ritardo trascurabile.
- **Allegati**: caricati tramite Apps Script (limite pratico consigliato: file sotto i 10–15 MB).
  I file caricati diventano visibili a chiunque abbia il link diretto (link "lunghi" e non
  indicizzabili, ma non protetti quanto i dati nel gestionale, che restano sempre dietro il
  controllo dei permessi).
- **Quote Google gratuite**: Apps Script su account Google personali ha quote giornaliere
  generose ma non infinite (esecuzioni, tempo di esecuzione). Per un uso aziendale normale
  (decine di persone) non dovrebbero essere un problema.

## Struttura dati

Tutto è salvato nel Google Sheet creato da `setup()`: una scheda per ciascuna collezione
(clienti, commesse, dipendenti, squadre, assegnazioni, tipiLavoro, categorie, docAzienda,
assicurazioni, mezzi, documenti, verbali, scadenze, riservato, accessi, impostazioni,
commesseElenco, registri) più le ore lavorate. Ogni riga è `id | json | aggiornato`: puoi
sempre ispezionare o esportare i dati aprendo direttamente il foglio da Google Drive.
