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

var COLS = ['clienti', 'commesse', 'dipendenti', 'squadre', 'assegnazioni', 'tipiLavoro', 'categorie', 'docAzienda', 'assicurazioni', 'mezzi', 'documenti', 'verbali', 'scadenze', 'riservato', 'accessi', 'impostazioni', 'commesseElenco', 'registri'];

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
function verifyToken(idToken) {
  if (!idToken) throw new Error('Token mancante: accedi di nuovo.');
  if (!CLIENT_ID || CLIENT_ID.indexOf('INSERISCI_QUI') === 0) throw new Error('Il backend non è configurato: imposta CLIENT_ID in cima a Code.gs.');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Sessione scaduta: accedi di nuovo.');
  var info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('Token non valido per questa applicazione.');
  if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('Email Google non verificata.');
  return { email: String(info.email).toLowerCase(), name: info.name || info.email };
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
  var cols = role === 'admin' ? COLS : ['accessi', 'commesseElenco'];
  var out = {};
  cols.forEach(function (col) {
    if (col === 'accessi' && role !== 'admin') {
      var own = readDoc('accessi', caller.email);
      out.accessi = own ? toIdMap(caller.email, own) : {};
    } else {
      out[col] = readAll(col);
    }
  });
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
function apiUpload(body, caller, role) {
  var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) return { ok: false, error: 'Cartella allegati non configurata: esegui setup().' };
  var folder = DriveApp.getFolderById(folderId);
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
function findRow(sh, id) {
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) if (String(vals[i][0]) === String(id)) return i + 1;
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
function readDoc(col, id) {
  var sh = sheetFor(col), row = findRow(sh, id);
  if (row < 0) return null;
  try { return JSON.parse(sh.getRange(row, 2).getValue()); } catch (e) { return null; }
}
function writeDoc(col, id, obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = sheetFor(col), row = findRow(sh, id);
    var json = JSON.stringify(obj), now = new Date().toISOString();
    if (row < 0) sh.appendRow([id, json, now]); else sh.getRange(row, 1, 1, 3).setValues([[id, json, now]]);
  } finally { lock.releaseLock(); }
}
function updateDoc(col, id, part) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var cur = {};
    var sh = sheetFor(col), row = findRow(sh, id);
    if (row > 0) { try { cur = JSON.parse(sh.getRange(row, 2).getValue()) || {}; } catch (e) { cur = {}; } }
    var merged = Object.assign({}, cur, part);
    var json = JSON.stringify(merged), now = new Date().toISOString();
    if (row < 0) sh.appendRow([id, json, now]); else sh.getRange(row, 1, 1, 3).setValues([[id, json, now]]);
    return merged;
  } finally { lock.releaseLock(); }
}
function deleteDoc(col, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { var sh = sheetFor(col), row = findRow(sh, id); if (row > 0) sh.deleteRow(row); }
  finally { lock.releaseLock(); }
}
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
