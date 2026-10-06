# CLAUDE.md

Memoria del progetto **Gestionale Impianti**: Claude legge questo file automaticamente all'inizio di ogni sessione.

## Come usare la memoria

- Quando l'utente dice "ricorda che…", o prende una decisione da mantenere nel tempo, aggiungi una riga nella sezione giusta qui sotto.
- Voci brevi, una per riga, con la data (AAAA-MM-GG) quando serve.
- Se una voce non è più valida, aggiornala o cancellala: niente informazioni in contraddizione.
- Dopo aver modificato questo file, fai commit e push: le sessioni cloud si cancellano a fine lavoro e resta solo ciò che è su GitHub.
- Non scrivere mai password, token o chiavi API in questo file.

## Il progetto in breve

- App gestionale per un'impresa di impiantistica: commesse con iter, planning squadre, scadenzario, personale, azienda, documentale, verbali, registro ore. Dettagli e setup completo in `README.md`.
- **`index.html`**: tutta l'app in un solo file (HTML + CSS + JavaScript), nessuna build. Il blocco `const CONFIG` (Client ID Google e URL dell'Apps Script) è verso la fine del file.
- **`apps-script/Code.gs`**: backend Google Apps Script. Applica i permessi per ruolo e salva i dati su Google Sheets e gli allegati su Google Drive.
- **`service-worker.js`** e **`manifest.json`**: rendono l'app installabile (PWA).
- Il branch principale del repository è `claude/gestionale-impianti-google-drive-2nxyv9`.

## Regole di lavoro

- Le modifiche a `apps-script/Code.gs` non arrivano all'app finché l'utente non le copia nell'editor di Apps Script e crea una **nuova versione** del deployment: ricordaglielo ogni volta che cambi quel file.
- I permessi (cosa può vedere un dipendente) vanno fatti rispettare nel backend (`Code.gs`), non solo nascondendo elementi nell'interfaccia.
- Messaggi di commit in italiano, brevi, che descrivono l'effetto per l'utente (es. "Sfoglia Drive apre direttamente su \"Il mio Drive\"").
- **Qualunque funzione "una tantum" richiamata dal polling** (seed/migrazione dati automatica, tipo `seedCategorieDefault`, `seedTipiLavoroDefault`, `migraScadenzeMezziDaiCampi`) **deve** avere una variabile di guardia "tentata-una-volta-per-sessione" (tipo `let xTentata = false`, impostata a `true` prima del tentativo, mai resettata) — non solo una guardia anti-sovrapposizione tipo `xSeeding` che si resetta nel `finally`. Senza quella, se il salvataggio finale fallisce anche una sola volta, la funzione riparte da capo ad ogni giro di polling (ogni 30 secondi) all'infinito, rallentando con scritture continue tutti i salvataggi dell'app (bug reale successo il 2026-10-06, corretto in tutte e tre le funzioni che esistevano allora: se se ne aggiungono altre in futuro, applicare subito lo stesso schema).
- Dopo ogni modifica a `index.html` o `Code.gs`, prima di committare: verificare la sintassi JS (node -c, o `new Function()` sui contenuti di `<script>`) e, quando possibile, rileggere a mente il nuovo codice cercando proprio questo tipo di bug (ritentativi senza limite, letture di dati non più aggiornate, campi rimandati indietro anche quando non cambiano) prima di considerare la modifica conclusa.

## Preferenze dell'utente

- Rispondere in italiano.
- Spiegazioni passo passo, semplici e non tecniche.

## Decisioni prese

- 2026-09-30: plugin e skill di Claude Code stanno nel repository separato `ramotto19/CLAUDE-PLUGIN`, non qui.
- 2026-09-30: la memoria è gestita con questo file (gratuito, nessun servizio esterno).

## Da ricordare

<!-- Aggiungi qui fatti, note e cose da non dimenticare. -->
