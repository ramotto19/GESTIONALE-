/**
 * Gestionale Impianti — backend Google Apps Script.
 *
 * Fa da intermediario tra l'app (index.html) e i dati dell'azienda:
 * - verifica l'identità di chi chiama tramite il suo ID token Google;
 * - applica le stesse regole di accesso dell'artifact originale
 *   (l'amministratore vede e modifica tutto; un dipendente vede e
 *   modifica solo le proprie ore e la propria scheda accessi, e legge
 *   l'elenco commesse);
 * - salva i dati in un Google Sheet (una scheda per collezione) e gli
 *   allegati in una cartella Google Drive.
 *
 * Setup: vedi il README nella cartella principale del repository.
 */

var COLS = ['clienti', 'commesse', 'dipendenti', 'squadre', 'assegnazioni', 'assegnazioniG', 'tipiLavoro', 'categorie', 'docAzienda', 'assicurazioni', 'mezzi', 'documenti', 'verbali', 'scadenze', 'riservato', 'accessi', 'impostazioni', 'commesseElenco', 'registri'];

/* Incolla qui il Client ID OAuth creato su Google Cloud Console
   (Credenziali → ID client OAuth → tipo Applicazione web).
   Deve essere lo STESSO valore messo in CONFIG.CLIENT_ID dentro index.html. */
var CLIENT_ID = '993000663967-5fv7cntdsjrcl0urmv8j2uscmju29ieu.apps.googleusercontent.com';

/* ---------- setup iniziale (da eseguire una sola volta dall'editor di Apps Script) ---------- */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SHEET_ID')) {
    var ss = SpreadsheetApp.create('Gestionale Impianti — Dati');
    props.setProperty('SHEET_ID', ss.getId());
    Logger.log('Creato Google Sheet: ' + ss.getUrl());
  }
  if (!props.getProperty('FOLDER_ID')) {
    var folder = DriveApp.createFolder('Gestionale Impianti — Allegati');
    props.setProperty('FOLDER_ID', folder.getId());
    Logger.log('Creata cartella Drive: ' + folder.getUrl());
  }
  COLS.forEach(function (col) { sheetFor(col); });
  if (CLIENT_ID.indexOf('INSERISCI_QUI') === 0) {
    Logger.log('ATTENZIONE: sostituisci il valore di CLIENT_ID in cima al file con il tuo Client ID OAuth, poi salva.');
  } else {
    Logger.log('CLIENT_ID configurato. Ora pubblica il Web App (Esegui il deployment → Nuovo deployment).');
  }
}

/* ---------- entry point del Web App ---------- */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, info: 'Gestionale Impianti — backend attivo. Usa POST per le richieste dati.' })).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var out;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = handle(body);
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle(body) {
  var caller = verifyToken(body.idToken);
  var role = resolveRole(caller.email);
  if (!role) return { ok: true, unauthorized: true, email: caller.email, name: caller.name };
  switch (body.action) {
    case 'whoami': return { ok: true, email: caller.email, name: caller.name, role: role };
    case 'listAll': return apiListAll(caller, role);
    case 'get': return apiGet(body, caller, role);
    case 'set': return apiSet(body, caller, role);
    case 'update': return apiUpdate(body, caller, role);
    case 'delete': return apiDelete(body, caller, role);
    case 'upload': return apiUpload(body, caller, role);
    default: return { ok: false, error: 'Azione sconosciuta: ' + body.action };
  }
}

/* ---------- identità ---------- */
/* Verificare il token con Google (riga sotto) è una chiamata di rete: l'app la fa ad ogni
   singola richiesta (ogni 30 secondi per ogni persona collegata, più ogni salvataggio), anche
   se il token non è cambiato dall'ultima volta. Il risultato per lo STESSO token non cambia
   finché non scade, quindi si tiene in cache per pochi minuti: niente di meno sicuro (un
   token scaduto o falso continua a essere rifiutato, semplicemente non lo si richiede di
   nuovo a Google se lo si è già verificato da poco), solo più veloce. */
function verifyToken(idToken) {
  if (!idToken) throw new Error('Token mancante: accedi di nuovo.');
  if (!CLIENT_ID || CLIENT_ID.indexOf('INSERISCI_QUI') === 0) throw new Error('Il backend non è configurato: imposta CLIENT_ID in cima a Code.gs.');
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Sessione scaduta: accedi di nuovo.');
  var info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('Token non valido per questa applicazione.');
  if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('Email Google non verificata.');
  var out = { email: String(info.email).toLowerCase(), name: info.name || info.email };
  try { cache.put(key, JSON.stringify(out), 300); } catch (e) { /* cache piena: non è un problema, si continua senza */ }
  return out;
}

/* Il primo utente che accede diventa automaticamente amministratore.
   I successivi devono essere aggiunti dall'amministratore (sezione "Ore del personale › Accessi"). */
function resolveRole(email) {
  var acc = readDoc('accessi', email);
  if (acc) return acc.ruolo === 'admin' ? 'admin' : 'dipendente';
  var all = readAll('accessi');
  if (Object.keys(all).length === 0) {
    writeDoc('accessi', email, { ruolo: 'admin', creatoIl: todayStr() });
    return 'admin';
  }
  return null;
}

/* ---------- regole di accesso (identiche a quelle dell'artifact originale) ---------- */
function selfIdMatches(col, id, email) {
  if (col === 'accessi') return id === email;
  if (col === 'ore') return !!id && id.split('::')[0] === email;
  return false;
}
function canRead(col, id, role, email) {
  if (role === 'admin') return true;
  if (col === 'commesseElenco') return true;
  return selfIdMatches(col, id, email);
}
function canWrite(col, id, role, email) {
  if (role === 'admin') return true;
  if (col === 'ore') return selfIdMatches(col, id, email);
  return false;
}

/* ---------- operazioni dati ---------- */
function apiListAll(caller, role) {
  if (role === 'admin') return { ok: true, cols: readManyBatch(COLS) };
  var out = {};
  var own = readDoc('accessi', caller.email);
  out.accessi = own ? toIdMap(caller.email, own) : {};
  out.commesseElenco = readAll('commesseElenco');
  return { ok: true, cols: out };
}
function toIdMap(id, doc) { var m = {}; m[id] = doc; return m; }

function apiGet(body, caller, role) {
  var col = body.col, id = body.id;
  if (!canRead(col, id, role, caller.email)) return { ok: true, found: false };
  var doc = readDoc(col, id);
  return { ok: true, found: !!doc, doc: doc };
}
function apiSet(body, caller, role) {
  var col = body.col, id = body.id;
  if (!canWrite(col, id, role, caller.email)) return { ok: false, error: 'Non hai i permessi per modificare questi dati.' };
  writeDoc(col, id, body.data || {});
  return { ok: true };
}
function apiUpdate(body, caller, role) {
  var col = body.col, id = body.id;
  if (!canWrite(col, id, role, caller.email)) return { ok: false, error: 'Non hai i permessi per modificare questi dati.' };
  var merged = updateDoc(col, id, body.data || {});
  return { ok: true, doc: merged };
}
function apiDelete(body, caller, role) {
  var col = body.col, id = body.id;
  if (!canWrite(col, id, role, caller.email)) return { ok: false, error: 'Non hai i permessi per modificare questi dati.' };
  deleteDoc(col, id);
  return { ok: true };
}
/* risolve (creando se serve) la cartella annidata dentro quella radice che corrisponde a
   pagina/commessa/sezione, cosi' i documenti caricati da Apps Script finiscono nella stessa
   struttura di cartelle di quelli caricati direttamente dal browser, invece che tutti insieme
   in un'unica cartella piatta */
function ensureFolderPath(rootFolder, segments) {
  var folder = rootFolder;
  (segments || []).slice(0, 4).forEach(function (name) {
    name = String(name || '').trim().slice(0, 100);
    if (!name) return;
    var it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  });
  return folder;
}
function apiUpload(body, caller, role) {
  var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) return { ok: false, error: 'Cartella allegati non configurata: esegui setup().' };
  var folder = ensureFolderPath(DriveApp.getFolderById(folderId), body.folderPath);
  var bytes = Utilities.base64Decode(body.base64 || '');
  var blob = Utilities.newBlob(bytes, body.mimeType || 'application/octet-stream', body.filename || 'file');
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, id: file.getId(), url: file.getUrl(), name: body.filename || file.getName() };
}

/* ---------- storage: Google Sheet come database, una scheda per collezione ---------- */
/* Il foglio e le singole schede vengono aperti una sola volta per esecuzione
   (una chiamata al backend può leggere fino a 18 collezioni in "listAll":
   riaprirle ogni volta era la causa principale della lentezza). */
var _ssCache = null, _sheetCache = {};
function ss() {
  if (_ssCache) return _ssCache;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Il backend non è configurato: esegui setup() dall\'editor di Apps Script.');
  _ssCache = SpreadsheetApp.openById(id);
  return _ssCache;
}
function sheetFor(col) {
  if (_sheetCache[col]) return _sheetCache[col];
  var s = ss(), sh = s.getSheetByName(col);
  if (!sh) { sh = s.insertSheet(col); sh.appendRow(['id', 'json', 'aggiornato']); sh.setFrozenRows(1); }
  _sheetCache[col] = sh;
  return sh;
}
/* Legge solo la colonna A (gli id), non l'intero foglio: prima leggeva anche la colonna con il
   JSON di ogni riga (a volte grande, es. una commessa con iter e checklist) solo per scartarlo
   subito dopo — un lavoro inutile ripetuto a ogni singola lettura/scrittura/eliminazione, che
   con molte righe si sentiva soprattutto nelle eliminazioni. */
function findRow(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function readAll(col) {
  var sh = sheetFor(col), vals = sh.getDataRange().getValues(), out = {};
  for (var i = 1; i < vals.length; i++) {
    var id = vals[i][0], json = vals[i][1];
    if (!id) continue;
    try { out[id] = JSON.parse(json); } catch (e) { /* riga corrotta: la saltiamo */ }
  }
  return out;
}
/* Legge più collezioni in UNA sola chiamata di rete (invece di una per collezione)
   usando il servizio avanzato "Sheets API" (Servizi → + → Google Sheets API, nell'editor
   di Apps Script). Se non è stato attivato, o per qualunque altro motivo la chiamata
   fallisce, si torna automaticamente al metodo più lento ma sempre funzionante: l'app
   non si rompe mai per questo, va solo più piano finché il servizio non è attivo. */
function readManyBatch(cols) {
  try {
    if (typeof Sheets === 'undefined' || !Sheets.Spreadsheets || !Sheets.Spreadsheets.Values) throw new Error('adv-service-off');
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    var ranges = cols.map(function (c) { return "'" + c + "'!A2:C"; });
    var resp = Sheets.Spreadsheets.Values.batchGet(id, { ranges: ranges });
    var out = {};
    (resp.valueRanges || []).forEach(function (vr, i) {
      var col = cols[i], map = {};
      (vr.values || []).forEach(function (row) {
        var rid = row[0], json = row[1];
        if (!rid) return;
        try { map[rid] = JSON.parse(json); } catch (e2) { /* riga corrotta: la saltiamo */ }
      });
      out[col] = map;
    });
    return out;
  } catch (e) {
    var out2 = {};
    cols.forEach(function (c) { out2[c] = readAll(c); });
    return out2;
  }
}
function readDoc(col, id) {
  var sh = sheetFor(col), row = findRow(sh, id);
  if (row < 0) return null;
  try { return JSON.parse(sh.getRange(row, 2).getValue()); } catch (e) { return null; }
}
/* Ogni scrittura (su qualunque collezione, di chiunque) passa da qui: un unico "semaforo"
   condiviso, perché Apps Script non offre un lucchetto per singola collezione, solo uno per
   script. Due scritture sulla STESSA riga devono per forza aspettare il proprio turno (altrimenti
   una delle due si perderebbe), quindi il lucchetto resta necessario; ma prima, se era occupato,
   si aspettava fino a 30 secondi e poi uscivano il messaggio d'errore grezzo di Apps Script
   (in inglese, poco chiaro). Ora l'attesa massima è più breve e l'errore, se capita, è chiaro. */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); }
  catch (e) { throw new Error('Il server è momentaneamente occupato: riprova tra qualche secondo.'); }
  try { return fn(); } finally { lock.releaseLock(); }
}
function writeDoc(col, id, obj) {
  return withLock(function () {
    var sh = sheetFor(col), row = findRow(sh, id);
    var json = JSON.stringify(obj), now = new Date().toISOString();
    if (row < 0) sh.appendRow([id, json, now]); else sh.getRange(row, 1, 1, 3).setValues([[id, json, now]]);
  });
}
function updateDoc(col, id, part) {
  return withLock(function () {
    var cur = {};
    var sh = sheetFor(col), row = findRow(sh, id);
    if (row > 0) { try { cur = JSON.parse(sh.getRange(row, 2).getValue()) || {}; } catch (e) { cur = {}; } }
    var merged = Object.assign({}, cur, part);
    var json = JSON.stringify(merged), now = new Date().toISOString();
    if (row < 0) sh.appendRow([id, json, now]); else sh.getRange(row, 1, 1, 3).setValues([[id, json, now]]);
    return merged;
  });
}
function deleteDoc(col, id) {
  return withLock(function () {
    var sh = sheetFor(col), row = findRow(sh, id);
    if (row > 0) sh.deleteRow(row);
  });
}
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- migrazione una tantum: sposta gli allegati già caricati nelle sottocartelle ---------- */
/* Prima di questa modifica tutti i file finivano nell'unica cartella radice "Gestionale
   Impianti - Allegati". Questa funzione sposta quelli già presenti nelle stesse sottocartelle
   che userebbe un caricamento nuovo (Commesse/<commessa>/Sicurezza, Personale/<dipendente>/
   Formazione, ecc.), cosi' anche i documenti caricati prima si ritrovano organizzati.
   Si può rilanciare più volte senza problemi: ogni volta sposta solo i file ancora nella
   cartella radice (quelli già spostati in una sottocartella non vengono più toccati), e non
   tocca MAI un file semplicemente collegato con un link "Oppure link a Google Drive" (quei
   file non sono dentro questa cartella, restano dove l'utente li aveva messi su Drive).
   Uso, dall'editor di Apps Script: scegli "migraCartelleAnteprima" dal menu delle funzioni in
   alto ed esegui (▷): nei log (Visualizza → Log, o Ctrl+Cmd+H) si vede quanti file verrebbero
   spostati e in quali cartelle, senza spostare nulla. Quando il risultato convince, esegui
   "migraCartelle" per spostarli davvero. */
function migraCartelleAnteprima() { return migraCartelleEsegui(true); }
function migraCartelle() { return migraCartelleEsegui(false); }
function migraCartelleEsegui(dryRun) {
  var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) { Logger.log('Cartella allegati non configurata: esegui prima setup().'); return; }
  var root = DriveApp.getFolderById(folderId);

  var clienti = readAll('clienti'), commesse = readAll('commesse'), dipendenti = readAll('dipendenti'),
    mezzi = readAll('mezzi'), categorie = readAll('categorie'), documenti = readAll('documenti'),
    riservato = readAll('riservato'), verbali = readAll('verbali'), docAzienda = readAll('docAzienda'),
    assicurazioni = readAll('assicurazioni'), registri = readAll('registri'), impostazioni = readAll('impostazioni');

  var campiCfg = impostazioni.campi || {};
  var registriDefs = {}; ((impostazioni.registri || {}).items || []).forEach(function (r) { registriDefs[r.id] = r; });

  var clienteNome = function (id) { var c = clienti[id]; return c ? c.ragioneSociale : ''; };
  var commessaLabel = function (c) { return (c.codice || '') + ' · ' + clienteNome(c.clienteId); };
  var nomeD = function (d) { return (d.cognome || '') + ' ' + (d.nome || ''); };
  var mezzoLabel = function (m) { return m.descrizione + (m.targa ? ' ' + m.targa : ''); };
  var catPath = function (id) {
    var c = categorie[id]; if (!c) return '';
    var p = c.parentId && categorie[c.parentId];
    return p ? p.nome + ' / ' + c.nome : c.nome;
  };

  var tasks = [];
  var add = function (fileOrId, segments) {
    var id = fileOrId && typeof fileOrId === 'object' ? fileOrId.id : fileOrId;
    if (!id) return;
    tasks.push({ fileId: id, segments: segments });
  };

  Object.keys(commesse).forEach(function (id) {
    var c = commesse[id], lab = ['Commesse', commessaLabel(c)];
    (c.sicurezza || []).forEach(function (s) { if (s.file) add(s.file, lab.concat('Sicurezza')); });
    (c.documentiAmm || []).forEach(function (x) { if (x.file) add(x.file, lab.concat('Documentazione amministrativa')); });
    (c.fotoSopralluogo || []).forEach(function (f) { add(f, lab.concat('Foto sopralluogo')); });
    (c.fotoInstallazione || []).forEach(function (f) { add(f, lab.concat('Foto installazione')); });
    (campiCfg.commesse || []).forEach(function (cf) { if (cf.t === 'file' && c[cf.k]) add(c[cf.k], lab); });
  });

  Object.keys(dipendenti).forEach(function (id) {
    var d = dipendenti[id], lab = ['Personale', nomeD(d)];
    (d.abilitazioni || []).forEach(function (a) { if (a.file) add(a.file, lab.concat('Formazione')); });
    (d.documenti || []).forEach(function (x) { if (x.file) add(x.file, lab.concat('Documenti personali')); });
    (campiCfg.dipendenti || []).forEach(function (cf) { if (cf.t === 'file' && d[cf.k]) add(d[cf.k], lab); });
  });

  Object.keys(mezzi).forEach(function (id) {
    var m = mezzi[id], lab = ['Mezzi', mezzoLabel(m)];
    (m.controlli || []).forEach(function (ct) { if (ct.file) add(ct.file, lab.concat('Controlli')); });
    (campiCfg.mezzi || []).forEach(function (cf) { if (cf.t === 'file' && m[cf.k]) add(m[cf.k], lab); });
  });

  Object.keys(clienti).forEach(function (id) {
    var cl = clienti[id];
    (campiCfg.clienti || []).forEach(function (cf) { if (cf.t === 'file' && cl[cf.k]) add(cl[cf.k], ['Clienti', cl.ragioneSociale]); });
  });

  var docLabel = function (x) {
    if (x.commessaId && commesse[x.commessaId]) return ['Commesse', commessaLabel(commesse[x.commessaId]), 'Documenti'];
    return ['Documentale', catPath(x.categoriaId) || 'Senza categoria'];
  };
  Object.keys(documenti).forEach(function (id) { var x = documenti[id]; if (x.file) add(x.file, docLabel(x)); });
  Object.keys(riservato).forEach(function (id) {
    var x = riservato[id];
    if (x.kind === 'doc' && x.file) add(x.file, docLabel(x));
    else if (x.kind === 'verbale' && x.file) add(x.file, ['Documentale', 'Verbali']);
  });
  Object.keys(verbali).forEach(function (id) { var x = verbali[id]; if (x.file) add(x.file, ['Documentale', 'Verbali']); });
  Object.keys(docAzienda).forEach(function (id) { var x = docAzienda[id]; if (x.file) add(x.file, ['Azienda', 'Documenti aziendali']); });
  Object.keys(assicurazioni).forEach(function (id) { var x = assicurazioni[id]; if (x.file) add(x.file, ['Azienda', 'Assicurazioni']); });
  Object.keys(registri).forEach(function (id) {
    var x = registri[id], def = registriDefs[x.reg]; if (!def) return;
    (def.campi || []).forEach(function (cf) { if (cf.t === 'file' && x[cf.k]) add(x[cf.k], ['Registri', def.nome]); });
  });

  var daSpostare = 0, giaOrganizzati = 0, nonTrovati = 0, errori = 0, cartelleUsate = {};
  tasks.forEach(function (t) {
    var file;
    try { file = DriveApp.getFileById(t.fileId); }
    catch (e) { nonTrovati++; return; }
    var parents = file.getParents(), inRadice = false;
    while (parents.hasNext()) { if (parents.next().getId() === root.getId()) { inRadice = true; break; } }
    if (!inRadice) { giaOrganizzati++; return; }
    var chiave = t.segments.join(' / ');
    cartelleUsate[chiave] = (cartelleUsate[chiave] || 0) + 1;
    if (dryRun) { daSpostare++; return; }
    try {
      var dest = ensureFolderPath(root, t.segments);
      dest.addFile(file);
      root.removeFile(file);
      daSpostare++;
    } catch (e2) { errori++; }
  });

  Logger.log((dryRun ? '[ANTEPRIMA, nessun file è stato spostato] ' : '[FATTO] ') + 'File ' + (dryRun ? 'da spostare' : 'spostati') + ': ' + daSpostare + ' · già organizzati in precedenza (non toccati): ' + giaOrganizzati + ' · non trovati (eliminati o senza permesso): ' + nonTrovati + (errori ? ' · errori: ' + errori : ''));
  Logger.log('Cartelle coinvolte:\n' + Object.keys(cartelleUsate).sort().map(function (k) { return '  ' + k + ' (' + cartelleUsate[k] + ')'; }).join('\n'));
  return { daSpostare: daSpostare, giaOrganizzati: giaOrganizzati, nonTrovati: nonTrovati, errori: errori };
}
