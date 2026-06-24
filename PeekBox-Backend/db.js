const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Errore connessione database:", err.message);
  else console.log("✅ Connesso al database SQLite (PeekBox-Backend)");
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");

  // 1. Tabella UTENTI — con tipo_profilo ('personal' | 'business') e is_admin
  db.run(`CREATE TABLE IF NOT EXISTS utenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    tipo_profilo TEXT NOT NULL DEFAULT 'personal',
    is_admin INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(`ALTER TABLE utenti ADD COLUMN tipo_profilo TEXT NOT NULL DEFAULT 'personal'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error("Migrazione tipo_profilo:", err.message);
    }
  });

  db.run(`ALTER TABLE utenti ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error("Migrazione is_admin:", err.message);
    }
  });

  db.run(`ALTER TABLE utenti ADD COLUMN data_registrazione TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error("Migrazione data_registrazione:", err.message);
    }
  });

  // 2. Tabella ARMADI
  db.run(`CREATE TABLE IF NOT EXISTS armadi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    rif_utente INTEGER,
    FOREIGN KEY(rif_utente) REFERENCES utenti(id) ON DELETE CASCADE
  )`);

  // 3. Tabella BOX — con moving_mode flag e descrizione
  db.run(`CREATE TABLE IF NOT EXISTS box (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descrizione TEXT,
    rif_armadio INTEGER,
    is_preferito INTEGER DEFAULT 0,
    data_eliminazione TEXT DEFAULT NULL,
    moving_mode INTEGER DEFAULT 0,
    FOREIGN KEY(rif_armadio) REFERENCES armadi(id) ON DELETE CASCADE
  )`);

  // Migrazioni box
  db.run(`ALTER TABLE box ADD COLUMN data_eliminazione TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error("Migrazione data_eliminazione:", err.message);
  });
  db.run(`ALTER TABLE box ADD COLUMN moving_mode INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error("Migrazione moving_mode:", err.message);
  });
  db.run(`ALTER TABLE box ADD COLUMN descrizione TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error("Migrazione descrizione box:", err.message);
  });
  db.run(`ALTER TABLE box ADD COLUMN dimensione TEXT DEFAULT 'piccola'`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error("Migrazione dimensione box:", err.message);
  });
  db.run(`ALTER TABLE box ADD COLUMN data_creazione TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error("Migrazione data_creazione box:", err.message);
    else db.run(`UPDATE box SET data_creazione = datetime('now', 'localtime') WHERE data_creazione IS NULL`);
  });

  // 4. Tabella OGGETTI
  db.run(`CREATE TABLE IF NOT EXISTS oggetti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descrizione TEXT,
    tipo TEXT,
    fragile INTEGER DEFAULT 0,
    quantita INTEGER DEFAULT 1,
    foto TEXT,
    rif_catalogo INTEGER,
    rif_box INTEGER,
    FOREIGN KEY(rif_box) REFERENCES box(id) ON DELETE CASCADE
  )`);

  db.run(`ALTER TABLE oggetti ADD COLUMN rif_catalogo INTEGER`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error("Migrazione rif_catalogo:", err.message);
    }
  });

  db.run(`ALTER TABLE oggetti ADD COLUMN data_eliminazione TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error("Migrazione data_eliminazione oggetti:", err.message);
    }
  });

  // 5. Tabella TIPOLOGIE
  db.run(`CREATE TABLE IF NOT EXISTS tipologie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    rif_utente INTEGER,
    FOREIGN KEY(rif_utente) REFERENCES utenti(id) ON DELETE CASCADE
  )`);

  // Catalogo elementi predefiniti
  db.run(`CREATE TABLE IF NOT EXISTS catalogo_categorie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descrizione TEXT,
    ordine INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS catalogo_elementi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descrizione TEXT,
    categoria_slug TEXT NOT NULL,
    tags TEXT,
    foto TEXT,
    popolarita INTEGER NOT NULL DEFAULT 0,
    fragile INTEGER NOT NULL DEFAULT 0,
    attivo INTEGER NOT NULL DEFAULT 1,
    UNIQUE(nome, categoria_slug),
    FOREIGN KEY(categoria_slug) REFERENCES catalogo_categorie(slug) ON DELETE CASCADE
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_catalogo_elementi_categoria ON catalogo_elementi(categoria_slug)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_catalogo_elementi_popolarita ON catalogo_elementi(popolarita DESC)`);

  // 6. Tabella CHECKPOINT GPS
  db.run(`CREATE TABLE IF NOT EXISTS checkpoint_gps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rif_box INTEGER NOT NULL,
    rif_utente INTEGER NOT NULL,
    latitudine REAL NOT NULL,
    longitudine REAL NOT NULL,
    accuratezza REAL,
    label TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(rif_box) REFERENCES box(id) ON DELETE CASCADE,
    FOREIGN KEY(rif_utente) REFERENCES utenti(id) ON DELETE CASCADE
  )`);

  // 7. CONDIVISIONI ARCHIVIO
   db.run(`CREATE TABLE IF NOT EXISTS condivisioni (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     rif_box INTEGER NOT NULL,
     rif_proprietario INTEGER NOT NULL,
     rif_ospite INTEGER NOT NULL,
     ruolo TEXT NOT NULL DEFAULT 'viewer',
     stato TEXT NOT NULL DEFAULT 'in_attesa',
     creato_il TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE(rif_box, rif_ospite),
     FOREIGN KEY(rif_box) REFERENCES box(id) ON DELETE CASCADE,
     FOREIGN KEY(rif_proprietario) REFERENCES utenti(id) ON DELETE CASCADE,
     FOREIGN KEY(rif_ospite) REFERENCES utenti(id) ON DELETE CASCADE
   )`);

  // 8. GEOFENCE
  db.run(`CREATE TABLE IF NOT EXISTS geofence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rif_armadio INTEGER NOT NULL UNIQUE,
    latitudine REAL NOT NULL,
    longitudine REAL NOT NULL,
    raggio_m REAL NOT NULL DEFAULT 100,
    attivo INTEGER NOT NULL DEFAULT 1,
    creato_il TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(rif_armadio) REFERENCES armadi(id) ON DELETE CASCADE
  )`);

  // 9. SMART QR
  db.run(`CREATE TABLE IF NOT EXISTS qr_token (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    rif_box   INTEGER NOT NULL UNIQUE,
    token     TEXT NOT NULL UNIQUE,
    creato_il TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(rif_box) REFERENCES box(id) ON DELETE CASCADE
  )`);

  // 10. SEGNALAZIONI GUEST
  db.run(`CREATE TABLE IF NOT EXISTS segnalazioni_guest (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    rif_box      INTEGER NOT NULL,
    latitudine   REAL,
    longitudine  REAL,
    accuratezza  REAL,
    nota         TEXT,
    ip_hash      TEXT,
    timestamp    TEXT NOT NULL DEFAULT (datetime('now')),
    notificato   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(rif_box) REFERENCES box(id) ON DELETE CASCADE
  )`);

  // 11. NOTIFICHE GEOFENCE
  db.run(`CREATE TABLE IF NOT EXISTS geofence_notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rif_box INTEGER NOT NULL,
    rif_armadio INTEGER NOT NULL,
    rif_utente INTEGER NOT NULL,
    latitudine REAL,
    longitudine REAL,
    messaggio TEXT NOT NULL,
    letto INTEGER NOT NULL DEFAULT 0,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(rif_box) REFERENCES box(id) ON DELETE CASCADE,
    FOREIGN KEY(rif_armadio) REFERENCES armadi(id) ON DELETE CASCADE,
    FOREIGN KEY(rif_utente) REFERENCES utenti(id) ON DELETE CASCADE
  )`);

   // 12. BOX LOG (cronologia)
   db.run(`CREATE TABLE IF NOT EXISTS box_log (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     rif_box    INTEGER NOT NULL,
     tipo       TEXT NOT NULL,
     descrizione TEXT NOT NULL,
     dettagli   TEXT,
     creato_il  TEXT NOT NULL DEFAULT (datetime('now')),
     FOREIGN KEY(rif_box) REFERENCES box(id) ON DELETE CASCADE
   )`);

   // 14. MESSAGGI UTENTI (sistema / supporto)
   db.run(`CREATE TABLE IF NOT EXISTS messaggi_utenti (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     rif_utente INTEGER NOT NULL,
     tipo TEXT NOT NULL DEFAULT 'sistema',
     mittente TEXT NOT NULL DEFAULT 'PeekBox',
     oggetto TEXT NOT NULL,
     corpo TEXT NOT NULL,
     letto INTEGER NOT NULL DEFAULT 0,
     importante INTEGER NOT NULL DEFAULT 0,
     timestamp TEXT NOT NULL DEFAULT (datetime('now')),
     FOREIGN KEY(rif_utente) REFERENCES utenti(id) ON DELETE CASCADE
   )`);

   db.run(`ALTER TABLE messaggi_utenti ADD COLUMN archiviato INTEGER NOT NULL DEFAULT 0`, (err) => {
     if (err && !err.message.includes('duplicate column')) {
       console.error("Migrazione archiviato messaggi:", err.message);
     }
   });
   db.run(`ALTER TABLE messaggi_utenti ADD COLUMN direzione INTEGER NOT NULL DEFAULT 0`, (err) => {
     if (err && !err.message.includes('duplicate column')) {
       console.error("Migrazione direzione messaggi:", err.message);
     }
   });

   // 15. RISPOSTE RAPIDE (templates)
   db.run(`CREATE TABLE IF NOT EXISTS risposte_rapide (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     rif_utente INTEGER NOT NULL,
     titolo TEXT NOT NULL,
     corpo TEXT NOT NULL,
     timestamp TEXT NOT NULL DEFAULT (datetime('now')),
     FOREIGN KEY(rif_utente) REFERENCES utenti(id) ON DELETE CASCADE
   )`);

   // 13. SEGNALAZIONI UTENTI (feedback/report)
   db.run(`CREATE TABLE IF NOT EXISTS segnalazioni_utenti (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     rif_utente INTEGER NOT NULL,
     tipo TEXT NOT NULL,
     titolo TEXT NOT NULL,
     descrizione TEXT,
     priorita TEXT NOT NULL DEFAULT 'bassa',
     stato TEXT NOT NULL DEFAULT 'nuova',
     timestamp TEXT NOT NULL DEFAULT (datetime('now')),
     FOREIGN KEY(rif_utente) REFERENCES utenti(id) ON DELETE CASCADE
   )`);

  console.log("✅ Schema tabelle SQLite pronto (Svuotato dagli elementi predefiniti).");
  popolaCatalogoDefault();
  popolaDatiEsempio();
});

function popolaCatalogoDefault() {
  console.log("Catalogo elementi lasciato vuoto come richiesto.");
}

function inserisciDatiEsempio() {
  const messaggi = [
    [1, 1, 'sistema', 'Team PeekBox', 'Benvenuto in PeekBox!', 'Grazie per esserti registrato su PeekBox. Qui riceverai notifiche importanti riguardanti le tue box e messaggi dal nostro team di supporto. Buona organizzazione!', null, 1],
    [2, 1, 'supporto', 'Assistenza PeekBox', 'Nuova funzione disponibile', 'Ciao! Abbiamo appena attivato la funzione di geolocalizzazione per le tue box. Ora puoi tracciare la posizione delle tue scatole e ricevere notifiche quando vengono spostate.', null, 0],
    [3, 1, 'condivisione', 'Sistema Condivisioni', 'Nuovo archivio condiviso con te', "Un utente ti ha condiviso l'archivio \"Elettronica\". Vai su Condividi Archivio per accettare o rifiutare.", null, 0],
    [4, 1, 'sistema', 'Team PeekBox', 'Manutenzione programmata', 'Nella giornata di Domenica dalle 02:00 alle 04:00 il servizio potrebbe subire brevi interruzioni per manutenzione straordinaria.', null, 0],
    [5, 1, 'supporto', 'Assistenza PeekBox', 'Richiesta presa in carico', 'Abbiamo ricevuto la tua segnalazione. Il nostro team verificherà e ti aggiornerà. Tempo stimato: 24 ore.', null, 1],
    [6, 1, 'sistema', 'Team PeekBox', 'Suggerimento: organizza per categorie', 'Puoi organizzare le tue box in spazi e armadi personalizzati. Vai su Gestione Spazi per creare la struttura perfetta.', null, 0],
    [7, 1, 'condivisione', 'Mario Rossi', 'Invito: Archivio Ufficio', "Ciao! Ho condiviso con te l'archivio \"Ufficio\" in modalità Visualizzatore. Accedi per vedere i dettagli.", 0, 0],
    [8, 1, 'sistema', 'Team PeekBox', 'Backup completato con successo', 'Il backup notturno dei tuoi dati è stato completato senza errori. Prossimo backup programmato per stanotte alle 03:00.', 0, 0],
    [9, 1, 'supporto', 'Assistenza PeekBox', 'Il tuo ticket #2847 è stato risolto', "Il problema che hai segnalato relativo alla sincronizzazione delle box è stato risolto. Riavvia l'app per applicare l'aggiornamento.", 1, 0],
    [10, 1, 'condivisione', 'Laura Bianchi', 'Condivisione: Biblioteca Casa', "Laura ha condiviso l'archivio \"Biblioteca Casa\" con te in modalità Editor. Puoi aggiungere e modificare i libri catalogati.", 1, 0],
    [11, 1, 'sistema', 'Team PeekBox', 'Nuovo aggiornamento disponibile v2.4', "È disponibile una nuova versione dell'app con miglioramenti delle prestazioni e nuove funzionalità. Aggiorna dallo store per non perdere le novità.", null, 0],
    [12, 1, 'supporto', 'Assistenza PeekBox', 'Riepilogo attività mensile', 'Ecco il riepilogo di questo mese: 12 nuovi oggetti catalogati, 3 box create, 2 condivisioni attive. Continua così!', 0, 1],
  ];
  for (const m of messaggi) {
    db.run(`INSERT OR IGNORE INTO messaggi_utenti (id, rif_utente, tipo, mittente, oggetto, corpo, letto, importante) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 0), ?)`, m);
  }

  const risposte = [
    [1, 1, 'Conferma ricezione', 'Grazie per la comunicazione. Ho ricevuto il tuo messaggio e provvederò a breve.'],
    [2, 1, 'Richiedo chiarimenti', 'Grazie per la segnalazione. Potresti fornirmi ulteriori dettagli per poter risolvere la questione?'],
    [3, 1, 'Suggerisci correzione', 'Grazie per la segnalazione. Provvederemo a verificare e correggere quanto segnalato.'],
  ];
  for (const r of risposte) {
    db.run(`INSERT OR IGNORE INTO risposte_rapide (id, rif_utente, titolo, corpo) VALUES (?, ?, ?, ?)`, r);
  }
}

async function popolaDatiEsempio() {
  try {
    const saltRounds = 10;
    const hashPassword = await bcrypt.hash('password123', saltRounds);

    db.run(
      `INSERT OR IGNORE INTO utenti (id, username, email, password, tipo_profilo) VALUES (?, ?, ?, ?, ?)`,
      [1, 'Emanuele', 'ema@example.com', hashPassword, 'personal'],
      function(err) {
        if (err) return console.error(err.message);
        if (this.changes > 0) console.log("👤 Utente di prova creato (ema@example.com)");
        inserisciDatiEsempio();
      }
    );
  } catch (err) {
    console.error("Errore hashing password esempio:", err);
  }
}

module.exports = db;
