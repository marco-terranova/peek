const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const os = require('os');
const path = require('path');
const db = require('./db');
const BoxRepository = require('./repositories/box.repository');
const BoxService = require('./services/box.service');
const boxRepository = BoxRepository(db);
const boxService = BoxService(boxRepository);

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET || "chiave_super_segreta_peekbox";

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
const HOST = process.env.HOST || getLocalIP();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:8100').split(',');
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(express.static('public'));

app.get('/scan', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'scan.html'));
});

function verificaToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Accesso negato. Token mancante." });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Token non valido o scaduto." });
        req.user = user;
        next();
    });
}

function verificaAdmin(req, res, next) {
    verificaToken(req, res, () => {
        db.get('SELECT is_admin FROM utenti WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row || row.is_admin !== 1)
                return res.status(403).json({ error: "Accesso riservato agli amministratori." });
            next();
            });
    });
}

function verificaAccessoArmadioScrittura(armadioId, userId, res, cb) {
    db.get('SELECT * FROM armadi WHERE id = ?', [armadioId], (err, armadio) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!armadio) return res.status(404).json({ error: "Archivio non trovato." });

        if (String(armadio.rif_utente) === String(userId)) {
            return cb(armadio);
        }

        return res.status(403).json({ error: "Non hai i permessi per modificare questo archivio." });
    });
}

function verificaAccessoArmadioLettura(armadioId, userId, res, cb) {
    db.get('SELECT * FROM armadi WHERE id = ?', [armadioId], (err, armadio) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!armadio) return res.status(404).json({ error: "Archivio non trovato." });

        if (String(armadio.rif_utente) === String(userId)) {
            return cb(armadio);
        }

        return res.status(403).json({ error: "Non hai accesso a questo archivio." });
    });
}

function verificaAccessoBoxLettura(boxId, userId, res, cb) {
    db.get('SELECT * FROM box WHERE id = ?', [boxId], (err, box) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!box) return res.status(404).json({ error: "Box non trovata." });
        db.get(
            `SELECT c.ruolo FROM condivisioni c
             WHERE c.rif_box = ? AND c.rif_ospite = ? AND c.stato = 'accettata'`,
            [boxId, userId],
            (shareErr, share) => {
                if (shareErr) return res.status(500).json({ error: shareErr.message });
                if (share) return cb(box, share.ruolo);
                verificaAccessoArmadioLettura(box.rif_armadio, userId, res,
                    (armadio, ruolo) => cb(box, ruolo));
            }
        );
    });
}

function verificaAccessoBoxScrittura(boxId, userId, res, cb) {
    db.get('SELECT * FROM box WHERE id = ?', [boxId], (err, box) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!box) return res.status(404).json({ error: "Box non trovata." });
        db.get(
            `SELECT ruolo FROM condivisioni WHERE rif_box = ? AND rif_ospite = ? AND stato = 'accettata' AND ruolo = 'editor'`,
            [boxId, userId],
            (shareErr, share) => {
                if (shareErr) return res.status(500).json({ error: shareErr.message });
                if (share) return cb();
                verificaAccessoArmadioScrittura(box.rif_armadio, userId, res, cb);
            }
        );
    });
}

// ─── Helper: inserisci log cronologia box ─────────────────────
function inserisciLogBox(boxId, tipo, descrizione, dettagli, cb) {
    const sql = `INSERT INTO box_log (rif_box, tipo, descrizione, dettagli) VALUES (?, ?, ?, ?)`;
    db.run(sql, [boxId, tipo, descrizione, dettagli ? JSON.stringify(dettagli) : null], function(err) {
        if (err) console.error('[box_log] Errore:', err.message);
        if (cb) cb(err);
    });
}

// ─────────────────────────────────────────────
// UTENTI
// ─────────────────────────────────────────────

app.get('/', (req, res) => {
    res.send('🚀 Backend PeekBox v3 attivo — GPS + Profili + Ripristina Box!');
});

app.post('/api/registrazione', async (req, res) => {
    const { username, email, password, tipo_profilo = 'personal' } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: "Tutti i campi sono obbligatori." });
    if (!['personal', 'business'].includes(tipo_profilo))
        return res.status(400).json({ error: "tipo_profilo non valido. Usa 'personal' o 'business'." });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const oggi = new Date().toISOString().slice(0, 10);
        const sql = 'INSERT INTO utenti (username, email, password, tipo_profilo, data_registrazione) VALUES (?, ?, ?, ?, ?)';
        db.run(sql, [username, email, hashedPassword, tipo_profilo, oggi], function(err) {
            if (err) return res.status(400).json({ error: "Email già registrata." });
            res.status(201).json({ id: this.lastID, message: "Utente creato!", data_registrazione: oggi, tipo_profilo });
        });
    } catch (error) { res.status(500).json({ error: "Errore server." }); }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email e password sono obbligatorie." });
    db.get('SELECT * FROM utenti WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Credenziali non valide." });
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const token = jwt.sign({ id: user.id, email: user.email, tipo_profilo: user.tipo_profilo }, SECRET_KEY, { expiresIn: '24h' });
            res.json({
                message: "Accesso eseguito!",
                token,
                user: { id: user.id, username: user.username, email: user.email, tipo_profilo: user.tipo_profilo, is_admin: user.is_admin === 1, data_registrazione: user.data_registrazione }
            });
        } else {
            res.status(401).json({ error: "Credenziali non valide." });
        }
    });
});

app.put('/api/utenti/:id/profilo', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.id))
        return res.status(403).json({ error: "Non autorizzato." });
    const { tipo_profilo } = req.body;
    if (!['personal', 'business'].includes(tipo_profilo))
        return res.status(400).json({ error: "tipo_profilo non valido." });
    db.run('UPDATE utenti SET tipo_profilo = ? WHERE id = ?', [tipo_profilo, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Profilo aggiornato!", tipo_profilo });
    });
});

app.put('/api/utenti/:id', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.id))
        return res.status(403).json({ error: "Non autorizzato." });
    const { nome, cognome, email } = req.body;
    db.run('UPDATE utenti SET username = COALESCE(?, username), email = COALESCE(?, email) WHERE id = ?',
        [nome || null, email || null, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Profilo aggiornato!" });
    });
});

app.put('/api/utenti/:id/password', verificaToken, async (req, res) => {
    if (String(req.user.id) !== String(req.params.id))
        return res.status(403).json({ error: "Non autorizzato." });
    const { vecchia_password, nuova_password } = req.body;
    if (!vecchia_password || !nuova_password)
        return res.status(400).json({ error: "Entrambe le password sono obbligatorie." });
    if (nuova_password.length < 8)
        return res.status(400).json({ error: "La nuova password deve essere di almeno 8 caratteri." });
    try {
        db.get('SELECT password FROM utenti WHERE id = ?', [req.params.id], async (err, user) => {
            if (err || !user) return res.status(404).json({ error: "Utente non trovato." });
            const match = await bcrypt.compare(vecchia_password, user.password);
            if (!match) return res.status(401).json({ error: "Password attuale non corretta." });
            const hashedPassword = await bcrypt.hash(nuova_password, 10);
            db.run('UPDATE utenti SET password = ? WHERE id = ?', [hashedPassword, req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Password aggiornata con successo!" });
            });
        });
    } catch (error) { res.status(500).json({ error: "Errore server." }); }
});

// ─────────────────────────────────────────────
// ARMADI
// ─────────────────────────────────────────────

app.get('/api/armadi/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });

    const sql = `
        SELECT a.*, NULL as ruolo_condivisione, u.username as proprietario_username,
               COUNT(b.id) as num_box
        FROM armadi a
        JOIN utenti u ON u.id = a.rif_utente
        LEFT JOIN box b ON b.rif_armadio = a.id AND b.data_eliminazione IS NULL
        WHERE a.rif_utente = ?
        GROUP BY a.id
        ORDER BY a.id ASC
    `;
    db.all(sql, [req.params.utenteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ armadi: rows });
    });
});

app.post('/api/armadi', verificaToken, (req, res) => {
    const { nome, rif_utente } = req.body;
    db.run('INSERT INTO armadi (nome, rif_utente) VALUES (?, ?)', [nome, rif_utente], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

app.delete('/api/armadi/:id', verificaToken, (req, res) => {
    const armadioId = req.params.id;
    db.get('SELECT id FROM armadi WHERE id = ? AND rif_utente = ?', [armadioId, req.user.id], (err, armadio) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!armadio) return res.status(403).json({ error: "Non autorizzato o armadio non trovato." });
        db.run('UPDATE box SET rif_armadio = NULL WHERE rif_armadio = ?', [armadioId], function(orfErr) {
            if (orfErr) return res.status(500).json({ error: orfErr.message });
            const boxOrfane = this.changes;
            db.run('DELETE FROM armadi WHERE id = ?', [armadioId], function(delErr) {
                if (delErr) return res.status(500).json({ error: delErr.message });
                res.json({ message: "Spazio eliminato!", box_orfane: boxOrfane });
            });
        });
    });
});

app.get('/api/box/orfane/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });
    db.all(`SELECT box.* FROM box
            JOIN armadi a ON box.rif_armadio = a.id
            WHERE a.rif_utente = ? AND box.data_eliminazione IS NULL
            UNION
            SELECT box.* FROM box
            WHERE box.rif_armadio IS NULL AND box.data_eliminazione IS NULL
            AND box.id IN (SELECT b.id FROM box b WHERE b.rif_armadio IS NULL)`,
        [req.params.utenteId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            const orfane = (rows || []).filter(b => b.rif_armadio === null);
            res.json({ box_orfane: orfane });
        }
    );
});

app.put('/api/box/:id/rialloca', verificaToken, (req, res) => {
    const { rif_armadio } = req.body;
    if (!rif_armadio) return res.status(400).json({ error: "rif_armadio obbligatorio." });
    db.get('SELECT id FROM armadi WHERE id = ? AND rif_utente = ?', [rif_armadio, req.user.id], (err, armadio) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!armadio) return res.status(403).json({ error: "Spazio non trovato o non autorizzato." });
        db.run('UPDATE box SET rif_armadio = ? WHERE id = ?', [rif_armadio, req.params.id], function(upErr) {
            if (upErr) return res.status(500).json({ error: upErr.message });
            res.json({ message: "Box riallocata!" });
        });
    });
});

// ─────────────────────────────────────────────
// BOX
// ─────────────────────────────────────────────

app.get('/api/box/singola/:id', verificaToken, (req, res) => {
    verificaAccessoBoxLettura(req.params.id, req.user.id, res, (box, ruolo) => {
        boxService.ottieniBoxSingola(req.params.id, (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: "Box non trovata." });
            row.ruolo_condivisione = ruolo || null;
            res.json({ box: row });
        });
    });
});

app.get('/api/box/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });
    boxService.ottieniBoxUtente(req.params.utenteId, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ box: rows });
    });
});

app.post('/api/box', verificaToken, (req, res) => {
    const { nome, descrizione, rif_armadio, is_preferito, moving_mode, dimensione = 'piccola' } = req.body;
    verificaAccessoArmadioScrittura(rif_armadio, req.user.id, res, () => {
        boxService.creaBox({
            nome, descrizione, rif_armadio, is_preferito, moving_mode, dimensione,
            tipoProfilo: req.user.tipo_profilo
        }, (err, result) => {
            if (err) {
                if (err.message.includes('non valida') || err.message.includes('riservata'))
                    return res.status(403).json({ error: err.message });
                if (err.message.includes('obbligatori'))
                    return res.status(400).json({ error: err.message });
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: result.lastID });
        });
    });
});

app.put('/api/box/preferito/:id', verificaToken, (req, res) => {
    verificaAccessoBoxScrittura(req.params.id, req.user.id, res, () => {
        boxService.aggiornaPreferito(req.params.id, req.body.is_preferito, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        });
    });
});

app.put('/api/box/moving-mode/:id', verificaToken, (req, res) => {
    verificaAccessoBoxScrittura(req.params.id, req.user.id, res, () => {
        boxService.aggiornaMovingMode(req.params.id, req.body.moving_mode, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        });
    });
});

// ─── GET cronologia box ──────────────────────────────────────
app.get('/api/box/:id/log', verificaToken, (req, res) => {
    verificaAccessoBoxLettura(req.params.id, req.user.id, res, () => {
        boxService.ottieniLog(req.params.id, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ log: rows });
        });
    });
});

app.delete('/api/box/:id/definitivo', verificaToken, (req, res) => {
    const sqlCheck = `
        SELECT box.id FROM box
        JOIN armadi ON box.rif_armadio = armadi.id
        WHERE box.id = ? AND armadi.rif_utente = ?
          AND box.data_eliminazione IS NOT NULL
    `;
    db.get(sqlCheck, [req.params.id, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Box non trovata nel cestino o non autorizzato.' });
        boxService.eliminaBoxDefinitivo(req.params.id, (runErr, result) => {
            if (runErr) return res.status(500).json({ error: runErr.message });
            res.json(result);
        });
    });
});

app.delete('/api/box/:id', verificaToken, (req, res) => {
    verificaAccessoBoxScrittura(req.params.id, req.user.id, res, () => {
        boxService.eliminaBox(req.params.id, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(result);
        });
    });
});

app.put('/api/box/:id/ripristina', verificaToken, (req, res) => {
    const sqlCheck = `
        SELECT box.id FROM box
        JOIN armadi ON box.rif_armadio = armadi.id
        WHERE box.id = ? AND armadi.rif_utente = ?
          AND box.data_eliminazione IS NOT NULL
    `;
    db.get(sqlCheck, [req.params.id, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Box non trovata nel cestino o non autorizzato." });
        boxService.ripristinaBox(req.params.id, (runErr, result) => {
            if (runErr) return res.status(500).json({ error: runErr.message });
            res.json(result);
        });
    });
});

app.get('/api/box/eliminate/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });
    boxService.ottieniBoxEliminate(req.params.utenteId, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ box_eliminate: rows });
    });
});

app.delete('/api/box/cestino/pulisci', verificaToken, (req, res) => {
    boxService.pulisciCestino((err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

// ── Pulizia automatica ogni ora ──────────────────────────────
const PULIZIA_INTERVAL_MS = 60 * 60 * 1000; // 1 ora
setInterval(() => {
    boxService.pulisciCestino((err, result) => {
        if (err) {
            console.error('[Pulizia automatica box] Errore:', err.message);
        } else if (result && result.message) {
            console.log(`[Pulizia automatica] ${result.message}`);
        }
    });
    const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    db.run('DELETE FROM oggetti WHERE data_eliminazione IS NOT NULL AND data_eliminazione < ?',
        [trentaGiorniFa], function(err) {
        if (err) {
            console.error('[Pulizia automatica oggetti] Errore:', err.message);
        } else if (this.changes > 0) {
            console.log(`[Pulizia automatica] Rimossi ${this.changes} oggetti scaduti.`);
        }
    });
}, PULIZIA_INTERVAL_MS);
console.log(`[Pulizia automatica] Avviata ogni ${PULIZIA_INTERVAL_MS / 60000} minuti.`);

// ─────────────────────────────────────────────
// CHECKPOINT GPS
// ─────────────────────────────────────────────

app.post('/api/checkpoint', verificaToken, (req, res) => {
    const { rif_box, latitudine, longitudine, accuratezza, label } = req.body;
    if (!rif_box || latitudine == null || longitudine == null)
        return res.status(400).json({ error: "rif_box, latitudine e longitudine sono obbligatori." });

    verificaAccessoBoxScrittura(rif_box, req.user.id, res, () => {
        const sql = `INSERT INTO checkpoint_gps (rif_box, rif_utente, latitudine, longitudine, accuratezza, label, timestamp)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
        db.run(sql, [rif_box, req.user.id, latitudine, longitudine, accuratezza || null, label || null], function(runErr) {
            if (runErr) return res.status(500).json({ error: runErr.message });
            res.status(201).json({ id: this.lastID, message: "Checkpoint salvato!" });
        });
    });
});

app.get('/api/checkpoint/:boxId', verificaToken, (req, res) => {
    verificaAccessoBoxLettura(req.params.boxId, req.user.id, res, () => {
        db.all(
            'SELECT * FROM checkpoint_gps WHERE rif_box = ? ORDER BY timestamp ASC',
            [req.params.boxId],
            (fetchErr, rows) => {
                if (fetchErr) return res.status(500).json({ error: fetchErr.message });
                res.json({ checkpoints: rows });
            }
        );
    });
});

app.get('/api/checkpoint/:boxId/ultimo', verificaToken, (req, res) => {
    verificaAccessoBoxLettura(req.params.boxId, req.user.id, res, () => {
        db.get(
            'SELECT * FROM checkpoint_gps WHERE rif_box = ? ORDER BY timestamp DESC LIMIT 1',
            [req.params.boxId],
            (fetchErr, checkpoint) => {
                if (fetchErr) return res.status(500).json({ error: fetchErr.message });
                res.json({ checkpoint: checkpoint || null });
            }
        );
    });
});

app.get('/api/dashboard/business/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });
    if (req.user.tipo_profilo !== 'business')
        return res.status(403).json({ error: "Riservato ai profili Business." });

    const sql = `
        SELECT box.id, box.nome, box.moving_mode, armadi.nome as nome_armadio,
               COUNT(oggetti.id) as num_oggetti,
               gps.latitudine as last_lat,
               gps.longitudine as last_lng,
               gps.timestamp as last_scan,
               gps.label as last_label
        FROM box
        JOIN armadi ON box.rif_armadio = armadi.id
        LEFT JOIN oggetti ON oggetti.rif_box = box.id
        LEFT JOIN (
            SELECT rif_box, latitudine, longitudine, timestamp, label
            FROM checkpoint_gps c1
            WHERE timestamp = (
                SELECT MAX(timestamp) FROM checkpoint_gps c2 WHERE c2.rif_box = c1.rif_box
            )
        ) gps ON gps.rif_box = box.id
        WHERE armadi.rif_utente = ?
          AND box.data_eliminazione IS NULL
        GROUP BY box.id
        ORDER BY gps.timestamp DESC
    `;
    db.all(sql, [req.params.utenteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ assets: rows });
    });
});

app.patch('/api/checkpoint/:id/label', verificaToken, (req, res) => {
    const { label } = req.body;
    if (!label || !label.trim())
        return res.status(400).json({ error: 'Label richiesta.' });
    db.get(`SELECT cp.*, b.rif_utente FROM checkpoint_gps cp JOIN box b ON cp.rif_box = b.id WHERE cp.id = ?`,
        [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Checkpoint non trovato.' });
            if (String(row.rif_utente) !== String(req.user.id))
                return res.status(403).json({ error: 'Non autorizzato.' });
            db.run('UPDATE checkpoint_gps SET label = ? WHERE id = ?', [label.trim(), req.params.id], function(runErr) {
                if (runErr) return res.status(500).json({ error: runErr.message });
                res.json({ message: 'Label aggiornata.', id: req.params.id });
            });
        }
    );
});

app.delete('/api/checkpoint/:boxId', verificaToken, (req, res) => {
    verificaAccessoBoxScrittura(req.params.boxId, req.user.id, res, () => {
        db.run('DELETE FROM checkpoint_gps WHERE rif_box = ?', [req.params.boxId], function(runErr) {
            if (runErr) return res.status(500).json({ error: runErr.message });
            res.json({ message: `Rimossi ${this.changes} checkpoint.` });
        });
    });
});

app.get('/api/checkpoint/tutti/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });

    const sql = `
        SELECT DISTINCT
               box.id as box_id, box.nome as box_nome,
               armadi.nome as armadio_nome,
               cp.latitudine, cp.longitudine, cp.timestamp, cp.label,
               g.latitudine as geofence_lat, g.longitudine as geofence_lng
        FROM box
        JOIN armadi ON box.rif_armadio = armadi.id
        JOIN geofence g ON g.rif_armadio = armadi.id AND g.attivo = 1
        LEFT JOIN condivisioni c ON c.rif_box = box.id AND c.rif_ospite = ? AND c.stato = 'accettata'
        LEFT JOIN checkpoint_gps cp ON cp.id = (
            SELECT id FROM checkpoint_gps WHERE rif_box = box.id ORDER BY timestamp DESC LIMIT 1
        )
        WHERE box.data_eliminazione IS NULL
          AND (armadi.rif_utente = ? OR c.id IS NOT NULL)
        ORDER BY cp.timestamp DESC
    `;
    db.all(sql, [req.params.utenteId, req.params.utenteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows && rows.length > 0) {
            console.log('[DEBUG checkpoint/tutti] prima riga:', JSON.stringify(rows[0], null, 2));
        } else {
            console.log('[DEBUG checkpoint/tutti] nessuna riga trovata');
        }
        res.json({ checkpoints: rows });
    });
});

app.get('/api/checkpoint/tutti-attivi/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });
    const sql = `
        SELECT cp.id, cp.rif_box, cp.latitudine, cp.longitudine, cp.accuratezza,
               cp.label, cp.timestamp, cp.rif_utente,
               b.nome as box_nome, armadi.nome as armadio_nome
        FROM checkpoint_gps cp
        JOIN box b ON cp.rif_box = b.id
        JOIN armadi ON b.rif_armadio = armadi.id
        LEFT JOIN condivisioni c ON c.rif_box = b.id AND c.rif_ospite = ? AND c.stato = 'accettata'
        WHERE b.moving_mode = 1
          AND b.data_eliminazione IS NULL
          AND (armadi.rif_utente = ? OR c.id IS NOT NULL)
        ORDER BY cp.timestamp DESC
    `;
    db.all(sql, [req.params.utenteId, req.params.utenteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ checkpoints: rows || [] });
    });
});

// ─────────────────────────────────────────────
// GEOFENCE & NOTIFICHE
// ─────────────────────────────────────────────

const R = 6371000; // Raggio terrestre in metri (per formula Haversine)

function calcolaDistanza(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Salva/aggiorna geofence per un armadio
app.post('/api/geofence', verificaToken, (req, res) => {
    const { armadio_id, latitudine, longitudine, raggio_m, attivo } = req.body;
    if (!armadio_id || latitudine == null || longitudine == null)
        return res.status(400).json({ error: "armadio_id, latitudine e longitudine sono obbligatori." });

    verificaAccessoArmadioScrittura(armadio_id, req.user.id, res, () => {
        db.run(`INSERT INTO geofence (rif_armadio, latitudine, longitudine, raggio_m, attivo) VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(rif_armadio) DO UPDATE SET latitudine = excluded.latitudine, longitudine = excluded.longitudine,
                 raggio_m = excluded.raggio_m, attivo = excluded.attivo, creato_il = datetime('now')`,
            [armadio_id, latitudine, longitudine, raggio_m || 100, attivo !== false ? 1 : 0],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                db.get('SELECT * FROM geofence WHERE rif_armadio = ?', [armadio_id], (getErr, geofence) => {
                    if (getErr) return res.status(500).json({ error: getErr.message });
                    res.json({ geofence, message: 'Geofence salvato!' });
                });
            }
        );
    });
});

// Ottieni geofence per armadio
app.get('/api/geofence/:armadioId', verificaToken, (req, res) => {
    verificaAccessoArmadioLettura(req.params.armadioId, req.user.id, res, () => {
        db.get('SELECT * FROM geofence WHERE rif_armadio = ?', [req.params.armadioId], (err, geofence) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ geofence: geofence || null });
        });
    });
});

// Elimina geofence
app.delete('/api/geofence/:armadioId', verificaToken, (req, res) => {
    verificaAccessoArmadioScrittura(req.params.armadioId, req.user.id, res, () => {
        db.run('DELETE FROM geofence WHERE rif_armadio = ?', [req.params.armadioId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Geofence rimosso.' });
        });
    });
});

// Verifica posizione rispetto al geofence (accetta armadio_id o box_id)
app.post('/api/geofence/verifica', verificaToken, (req, res) => {
    const { armadio_id, box_id, latitudine, longitudine } = req.body;
    if ((!armadio_id && !box_id) || latitudine == null || longitudine == null)
        return res.status(400).json({ error: "armadio_id o box_id, latitudine e longitudine sono obbligatori." });

    let sql, params;
    if (armadio_id) {
        sql = 'SELECT * FROM geofence WHERE rif_armadio = ?';
        params = [armadio_id];
    } else {
        sql = `SELECT g.*, b.rif_armadio FROM geofence g
                 JOIN box b ON b.rif_armadio = g.rif_armadio WHERE b.id = ?`;
        params = [box_id];
    }

    db.get(sql, params, (err, geofence) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!geofence) return res.json({ dentro_perimetro: true, motivo: 'Nessun geofence configurato.' });

        if (!geofence.attivo) return res.json({ dentro_perimetro: true, motivo: 'Geofence disattivato.' });

        const distanza = calcolaDistanza(latitudine, longitudine, geofence.latitudine, geofence.longitudine);
        const dentro = distanza <= geofence.raggio_m;
        res.json({ dentro_perimetro: dentro, distanza_m: Math.round(distanza), centro: { lat: geofence.latitudine, lng: geofence.longitudine }, raggio_m: geofence.raggio_m });
    });
});

// Salva checkpoint con verifica geofence (usato da scansione QR / tracking)
app.post('/api/checkpoint/sicuro', verificaToken, (req, res) => {
    const { rif_box, latitudine, longitudine, accuratezza, label } = req.body;
    if (!rif_box || latitudine == null || longitudine == null)
        return res.status(400).json({ error: "rif_box, latitudine e longitudine sono obbligatori." });

    verificaAccessoBoxScrittura(rif_box, req.user.id, res, () => {
        // Salva checkpoint
        db.run(`INSERT INTO checkpoint_gps (rif_box, rif_utente, latitudine, longitudine, accuratezza, label, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [rif_box, req.user.id, latitudine, longitudine, accuratezza || null, label || null],
            function(runErr) {
                if (runErr) return res.status(500).json({ error: runErr.message });

                // Verifica geofence
                db.get(`SELECT g.*, b.rif_armadio FROM geofence g
                         JOIN box b ON b.rif_armadio = g.rif_armadio
                         WHERE b.id = ?`, [rif_box], (getErr, geofence) => {
                    if (getErr || !geofence || !geofence.attivo) {
                        return res.status(201).json({ id: this.lastID, message: 'Checkpoint salvato (nessun geofence).' });
                    }

                    const distanza = calcolaDistanza(latitudine, longitudine, geofence.latitudine, geofence.longitudine);
                    if (distanza > geofence.raggio_m) {
                        // Geofence violato — crea notifica
                        const msg = `Il box è uscito dal perimetro di sicurezza (${Math.round(distanza)}m dal centro, raggio ${geofence.raggio_m}m).`;
                        db.run(`INSERT INTO geofence_notifiche (rif_box, rif_armadio, rif_utente, latitudine, longitudine, messaggio)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                            [rif_box, geofence.rif_armadio, req.user.id, latitudine, longitudine, msg],
                            function(notifyErr) {
                                if (notifyErr) console.error('Errore creazione notifica geofence:', notifyErr.message);
                                res.status(201).json({
                                    id: this.lastID,
                                    message: 'Checkpoint salvato!',
                                    geofence_alert: { messaggio: msg }
                                });
                            }
                        );
                    } else {
                        res.status(201).json({ id: this.lastID, message: 'Checkpoint salvato. Asset nel perimetro.' });
                    }
                });
            }
        );
    });
});

// Ottieni tutte le notifiche geofence per l'utente loggato
app.get('/api/geofence/notifiche', verificaToken, (req, res) => {
    db.all(`SELECT n.*, a.nome as nome_archivio, b.nome as nome_box
             FROM geofence_notifiche n
             JOIN armadi a ON n.rif_armadio = a.id
             LEFT JOIN box b ON n.rif_box = b.id
             WHERE n.rif_utente = ?
             ORDER BY n.timestamp DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ notifiche: rows || [] });
    });
});

// Segna notifica come letta
app.patch('/api/geofence/notifiche/:id/letta', verificaToken, (req, res) => {
    db.run('UPDATE geofence_notifiche SET letto = 1 WHERE id = ? AND rif_utente = ?',
        [req.params.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Notifica segnata come letta.' });
        }
    );
});

// Elimina notifica
app.delete('/api/geofence/notifiche/:id', verificaToken, (req, res) => {
    db.run('DELETE FROM geofence_notifiche WHERE id = ? AND rif_utente = ?',
        [req.params.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Notifica eliminata.' });
        }
    );
});

// Ottieni checkpoints per tutti i box di un armadio (per la mappa geofence)
app.get('/api/geofence/:armadioId/checkpoints', verificaToken, (req, res) => {
    verificaAccessoArmadioLettura(req.params.armadioId, req.user.id, res, () => {
        const sql = `SELECT c.*, b.nome as nome_box, b.id as box_id
                      FROM checkpoint_gps c
                      JOIN box b ON c.rif_box = b.id
                      WHERE b.rif_armadio = ? AND b.data_eliminazione IS NULL
                      ORDER BY c.timestamp DESC`;
        db.all(sql, [req.params.armadioId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ checkpoints: rows || [] });
        });
    });
});

// ─────────────────────────────────────────────
// GEOFENCE PER CHECKPOINT
// ─────────────────────────────────────────────

app.post('/api/geofence-checkpoint', verificaToken, (req, res) => {
    const { checkpoint_id, latitudine, longitudine, raggio_m = 100, attivo = true } = req.body;
    if (!checkpoint_id || latitudine == null || longitudine == null) {
        return res.status(400).json({ error: 'checkpoint_id, latitudine e longitudine obbligatori.' });
    }
    if (raggio_m < 0 || raggio_m > 5000) {
        return res.status(400).json({ error: 'Raggio deve essere tra 0 e 5000 metri.' });
    }
    db.get('SELECT c.id FROM checkpoint_gps c WHERE c.id = ? AND c.rif_utente = ?',
        [checkpoint_id, req.user.id], (err, cp) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!cp) return res.status(403).json({ error: 'Checkpoint non trovato o non autorizzato.' });
            db.run(`INSERT INTO geofence_checkpoint (rif_checkpoint, latitudine, longitudine, raggio_m, attivo)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(rif_checkpoint) DO UPDATE SET
                    latitudine = excluded.latitudine, longitudine = excluded.longitudine,
                    raggio_m = excluded.raggio_m, attivo = excluded.attivo`,
                [checkpoint_id, latitudine, longitudine, raggio_m, attivo ? 1 : 0],
                function(err2) {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ id: this.lastID || checkpoint_id, message: 'Geofence checkpoint salvato.' });
                }
            );
        }
    );
});

app.get('/api/geofence-checkpoint/:checkpointId', verificaToken, (req, res) => {
    db.get('SELECT gc.* FROM geofence_checkpoint gc JOIN checkpoint_gps c ON gc.rif_checkpoint = c.id WHERE gc.rif_checkpoint = ? AND c.rif_utente = ?',
        [req.params.checkpointId, req.user.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ geofence: row || null });
        }
    );
});

app.delete('/api/geofence-checkpoint/:checkpointId', verificaToken, (req, res) => {
    db.run(`DELETE FROM geofence_checkpoint WHERE rif_checkpoint = ? AND rif_checkpoint IN (SELECT id FROM checkpoint_gps WHERE rif_utente = ?)`,
        [req.params.checkpointId, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Geofence checkpoint eliminato.' });
        }
    );
});

app.get('/api/geofence-checkpoint/utente/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId)) {
        return res.status(403).json({ error: 'Non autorizzato.' });
    }
    db.all(`SELECT gc.*, c.latitudine as cp_lat, c.longitudine as cp_lng, c.label as cp_label,
            c.timestamp as cp_timestamp, b.nome as box_nome, b.id as box_id
            FROM geofence_checkpoint gc
            JOIN checkpoint_gps c ON gc.rif_checkpoint = c.id
            JOIN box b ON c.rif_box = b.id
            WHERE c.rif_utente = ? AND b.data_eliminazione IS NULL`,
        [req.params.utenteId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ geofences: rows || [] });
        }
    );
});

// ─────────────────────────────────────────────
// CATALOGO ELEMENTI PREDEFINITI
// ─────────────────────────────────────────────

app.get('/api/catalogo/categorie', verificaToken, (req, res) => {
    const sql = `
        SELECT c.*, COUNT(e.id) as num_elementi
        FROM catalogo_categorie c
        LEFT JOIN catalogo_elementi e
          ON e.categoria_slug = c.slug
         AND e.attivo = 1
        WHERE c.rif_utente = ?
        GROUP BY c.id
        ORDER BY c.ordine ASC, c.nome ASC
    `;

    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ categorie: rows || [] });
    });
});

app.post('/api/catalogo/categorie', verificaToken, (req, res) => {
    const { nome } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome categoria obbligatorio.' });
    const slug = nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    db.run(`INSERT INTO catalogo_categorie (slug, nome, rif_utente) VALUES (?, ?, ?)`,
        [slug, nome.trim(), req.user.id], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Categoria già esistente.' });
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, slug, nome: nome.trim() });
        }
    );
});

app.get('/api/catalogo/elementi', verificaToken, (req, res) => {
    const q = String(req.query.q || '').trim();
    const categoria = String(req.query.categoria || 'tutte').trim();
    const tag = String(req.query.tag || 'tutti').trim();
    const sort = String(req.query.sort || 'popolari').trim();

    const where = ['e.attivo = 1'];
    const params = [];

    if (categoria && categoria !== 'tutte') {
        where.push('e.categoria_slug = ?');
        params.push(categoria);
    }

    if (tag && tag !== 'tutti') {
        where.push('e.tags LIKE ?');
        params.push(`%${tag}%`);
    }

    if (q) {
        where.push('(e.nome LIKE ? OR e.descrizione LIKE ? OR e.tags LIKE ? OR c.nome LIKE ?)');
        const term = `%${q}%`;
        params.push(term, term, term, term);
    }

    const orderBy = {
        popolari: 'e.popolarita DESC, e.nome ASC',
        nome: 'e.nome ASC',
        categoria: 'c.ordine ASC, e.nome ASC',
        nuovi: 'e.id DESC'
    }[sort] || 'e.popolarita DESC, e.nome ASC';

    const sql = `
        SELECT e.*, c.nome as categoria_nome, c.ordine as categoria_ordine
        FROM catalogo_elementi e
        JOIN catalogo_categorie c ON c.slug = e.categoria_slug
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT 160
    `;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const elementi = (rows || []).map((row) => ({
            ...row,
            tags_array: row.tags ? String(row.tags).split(',').filter(Boolean) : []
        }));
        res.json({ elementi });
    });
});

app.post('/api/box/:boxId/catalogo/:catalogoId/aggiungi', verificaToken, (req, res) => {
    const boxId = Number(req.params.boxId);
    const catalogoId = Number(req.params.catalogoId);
    const quantita = Math.max(1, Number(req.body?.quantita || 1));

    if (!boxId || !catalogoId) {
        return res.status(400).json({ error: "boxId e catalogoId sono obbligatori." });
    }

    verificaAccessoBoxScrittura(boxId, req.user.id, res, () => {
        db.get(
            `SELECT * FROM catalogo_elementi WHERE id = ? AND attivo = 1`,
            [catalogoId],
            (catalogErr, catalogo) => {
                if (catalogErr) return res.status(500).json({ error: catalogErr.message });
                if (!catalogo) return res.status(404).json({ error: "Elemento catalogo non trovato." });

                verificaCapienzaBox(boxId, quantita, (capErr, consentito, maxCap, totAttuale) => {
                    if (capErr) return res.status(500).json({ error: capErr.message });
                    if (!consentito) {
                        return res.status(400).json({
                            error: `Limite di capienza raggiunto. La box può contenere al massimo ${maxCap} elementi (attualmente ${totAttuale}). Rimuovi qualche oggetto prima di aggiungerne altri.`
                        });
                    }

                    db.get(
                        `SELECT id, quantita FROM oggetti WHERE rif_box = ? AND rif_catalogo = ?`,
                        [boxId, catalogoId],
                        (existingErr, esistente) => {
                            if (existingErr) return res.status(500).json({ error: existingErr.message });

                            if (esistente) {
                                const nuovaQuantita = Number(esistente.quantita || 1) + quantita;
                                db.run(
                                    `UPDATE oggetti SET quantita = ? WHERE id = ?`,
                                    [nuovaQuantita, esistente.id],
                                    function(updateErr) {
                                        if (updateErr) return res.status(500).json({ error: updateErr.message });
                                        return res.json({
                                            id: esistente.id,
                                            quantita: nuovaQuantita,
                                            action: 'incremented',
                                            message: "Quantita aggiornata."
                                        });
                                    }
                                );
                                return;
                            }

                            db.run(
                                `INSERT INTO oggetti
                                  (nome, descrizione, tipo, fragile, quantita, rif_box, rif_catalogo)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    catalogo.nome,
                                    catalogo.descrizione,
                                    catalogo.categoria_slug,
                                    catalogo.fragile ? 1 : 0,
                                    quantita,
                                    boxId,
                                    catalogoId
                                ],
                                function(insertErr) {
                                    if (insertErr) return res.status(500).json({ error: insertErr.message });
                                    res.status(201).json({
                                        id: this.lastID,
                                        quantita,
                                        action: 'created',
                                        message: "Elemento aggiunto alla box."
                                    });
                                }
                            );
                        }
                    );
                });
            }
        );
    });
});

// ─────────────────────────────────────────────
// OGGETTI
// ─────────────────────────────────────────────

app.get('/api/oggetti/:boxId', verificaToken, (req, res) => {
    verificaAccessoBoxLettura(req.params.boxId, req.user.id, res, () => {
        db.all('SELECT * FROM oggetti WHERE rif_box = ? AND data_eliminazione IS NULL', [req.params.boxId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ oggetti: rows });
        });
    });
});

const CAPACITA_MAP = { piccola: 10, media: 20, grande: 30, pallet: 100 };

function verificaCapienzaBox(boxId, nuovaQuantita, callback) {
    db.get('SELECT dimensione FROM box WHERE id = ?', [boxId], (err, box) => {
        if (err) return callback(err);
        if (!box) return callback(new Error("Box non trovata."));
        const maxCapienza = CAPACITA_MAP[box.dimensione] || 10;
        db.get(
            'SELECT COALESCE(SUM(oggetti.quantita), 0) as totale FROM oggetti WHERE oggetti.rif_box = ? AND oggetti.data_eliminazione IS NULL',
            [boxId],
            (err2, row) => {
                if (err2) return callback(err2);
                const nuovoTotale = (row?.totale || 0) + Number(nuovaQuantita);
                if (nuovoTotale > maxCapienza) {
                    return callback(null, false, maxCapienza, row?.totale || 0);
                }
                callback(null, true, maxCapienza, row?.totale || 0);
            }
        );
    });
}

app.post('/api/oggetti', verificaToken, (req, res) => {
    try {
        const { nome, descrizione, tipo, fragile, quantita, rif_box, rif_catalogo = null } = req.body || {};
        if (!nome || !rif_box) return res.status(400).json({ error: "nome e rif_box obbligatori." });
        verificaAccessoBoxScrittura(rif_box, req.user.id, res, () => {
            verificaCapienzaBox(rif_box, quantita || 1, (err, consentito, maxCap, totAttuale) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!consentito) {
                    return res.status(400).json({
                        error: `Limite di capienza raggiunto. La box può contenere al massimo ${maxCap} elementi (attualmente ${totAttuale}). Rimuovi qualche oggetto prima di aggiungerne altri.`
                    });
                }
                db.run(`INSERT INTO oggetti (nome, descrizione, tipo, fragile, quantita, rif_box, rif_catalogo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [nome, descrizione, tipo, fragile ? 1 : 0, quantita || 1, rif_box, rif_catalogo], function(err2) {
                    if (err2) return res.status(500).json({ error: err2.message });
                    inserisciLogBox(rif_box, 'oggetto_aggiunto', `Aggiunto "${nome}" (q.tà: ${quantita || 1})`, { oggetto_id: this.lastID, nome, quantita: quantita || 1 });
                    res.status(201).json({ id: this.lastID });
                });
            });
        });
    } catch (err) {
        console.error('POST /api/oggetti - Unexpected error:', err);
        res.status(500).json({ error: err.message || 'Errore interno del server.' });
    }
});

// ── FIX: era mancante la ) di chiusura del return res.status(400) ──
app.put('/api/oggetti/sposta', verificaToken, (req, res) => {
    const { oggetti_ids, box_destinazione_id } = req.body;

    if (!Array.isArray(oggetti_ids) || oggetti_ids.length === 0 || !box_destinazione_id) {
        return res.status(400).json({ error: "oggetti_ids (array) e box_destinazione_id sono obbligatori." });
    }

    verificaAccessoBoxScrittura(box_destinazione_id, req.user.id, res, () => {
        const placeholders = oggetti_ids.map(() => '?').join(', ');
        db.all(
            `SELECT id, nome, quantita, rif_box FROM oggetti WHERE id IN (${placeholders})`,
            [...oggetti_ids],
            (selErr, oggetti) => {
                if (selErr) return res.status(500).json({ error: selErr.message });

                const totaleDaSpostare = (oggetti || []).reduce((sum, o) => sum + (Number(o.quantita) || 1), 0);
                verificaCapienzaBox(box_destinazione_id, totaleDaSpostare, (capErr, consentito, maxCap, totAttuale) => {
                    if (capErr) return res.status(500).json({ error: capErr.message });
                    if (!consentito) {
                        return res.status(400).json({
                            error: `Limite di capienza raggiunto. La box può contenere al massimo ${maxCap} elementi (attualmente ${totAttuale}). Rimuovi oggetti prima di spostarne altri.`
                        });
                    }

                    db.run(
                        `UPDATE oggetti SET rif_box = ? WHERE id IN (${placeholders})`,
                        [box_destinazione_id, ...oggetti_ids],
                        function(err) {
                            if (err) return res.status(500).json({ error: err.message });
                            const names = (oggetti || []).map(o => o.nome).join(', ');
                            const sorgenteIds = [...new Set((oggetti || []).map(o => o.rif_box).filter(Boolean))];
                            inserisciLogBox(box_destinazione_id, 'oggetto_spostato', `Arrivati: ${names}`, { oggetti_ids, provenienti: sorgenteIds });
                            sorgenteIds.forEach(srcId => {
                                if (srcId && Number(srcId) !== Number(box_destinazione_id)) {
                                    inserisciLogBox(srcId, 'oggetto_spostato_via', `Partiti: ${names}`, { oggetti_ids, destinazione: box_destinazione_id });
                                }
                            });
                            res.json({ message: `${this.changes} oggetti spostati.`, changes: this.changes });
                        }
                    );
                });
            }
        );
    });
});

app.put('/api/oggetti/:id', verificaToken, (req, res) => {
    db.get('SELECT rif_box, nome, quantita FROM oggetti WHERE id = ?', [req.params.id], (err, oggetto) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oggetto) return res.status(404).json({ error: "Oggetto non trovato." });

        verificaAccessoBoxScrittura(oggetto.rif_box, req.user.id, res, () => {
            const { nome, descrizione, tipo, fragile, quantita } = req.body;
            const nuovaQuantita = quantita !== undefined ? Number(quantita) : (oggetto.quantita || 1);
            const delta = nuovaQuantita - (oggetto.quantita || 1);
            if (delta > 0) {
                verificaCapienzaBox(oggetto.rif_box, delta, (capErr, consentito, maxCap, totAttuale) => {
                    if (capErr) return res.status(500).json({ error: capErr.message });
                    if (!consentito) {
                        return res.status(400).json({
                            error: `Limite di capienza raggiunto. La box può contenere al massimo ${maxCap} elementi (attualmente ${totAttuale}).`
                        });
                    }
                    eseguiAggiornamento();
                });
            } else {
                eseguiAggiornamento();
            }
            function eseguiAggiornamento() {
                db.run(
                    `UPDATE oggetti SET nome = COALESCE(?, nome), descrizione = COALESCE(?, descrizione),
                     tipo = COALESCE(?, tipo), fragile = COALESCE(?, fragile),
                     quantita = COALESCE(?, quantita)
                     WHERE id = ?`,
                    [nome || null, descrizione || null, tipo || null,
                     fragile !== undefined ? (fragile ? 1 : 0) : null,
                     quantita || null, req.params.id],
                    function(err) {
                        if (err) return res.status(500).json({ error: err.message });
                        inserisciLogBox(oggetto.rif_box, 'oggetto_modificato', `Modificato "${nome || oggetto.nome}"`, { oggetto_id: Number(req.params.id) });
                        res.json({ message: "Oggetto aggiornato!" });
                    }
                );
            }
        });
    });
});

// ─── Soft-delete: sposta l'oggetto nel cestino ────────────────
app.delete('/api/oggetti/:id', verificaToken, (req, res) => {
    db.get('SELECT rif_box, nome FROM oggetti WHERE id = ?', [req.params.id], (err, oggetto) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oggetto) return res.status(404).json({ error: "Oggetto non trovato." });

        verificaAccessoBoxScrittura(oggetto.rif_box, req.user.id, res, () => {
            db.run("UPDATE oggetti SET data_eliminazione = datetime('now') WHERE id = ?", [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                inserisciLogBox(oggetto.rif_box, 'oggetto_eliminato', `Eliminato "${oggetto.nome}"`, { oggetto_id: Number(req.params.id) });
                console.log(`[DELETE /api/oggetti/${req.params.id}] Soft-delete eseguito.`);
                res.json({ message: "Oggetto spostato nel cestino!" });
            });
        });
    });
});

// ─── Ripristina oggetto dal cestino ──────────────────────────
app.put('/api/oggetti/:id/ripristina', verificaToken, (req, res) => {
    db.get('SELECT rif_box FROM oggetti WHERE id = ?', [req.params.id], (err, oggetto) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oggetto) return res.status(404).json({ error: "Oggetto non trovato." });

        verificaAccessoBoxScrittura(oggetto.rif_box, req.user.id, res, () => {
            db.run('UPDATE oggetti SET data_eliminazione = NULL WHERE id = ?', [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Oggetto ripristinato!" });
            });
        });
    });
});

// ─── Eliminazione definitiva oggetto ─────────────────────────
app.delete('/api/oggetti/:id/definitivo', verificaToken, (req, res) => {
    db.get('SELECT rif_box FROM oggetti WHERE id = ?', [req.params.id], (err, oggetto) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!oggetto) return res.status(404).json({ error: "Oggetto non trovato." });

        verificaAccessoBoxScrittura(oggetto.rif_box, req.user.id, res, () => {
            db.run('DELETE FROM oggetti WHERE id = ?', [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "Oggetto eliminato definitivamente!" });
            });
        });
    });
});

// ─── Svuota box: soft-delete di tutti gli oggetti ────────────
app.delete('/api/box/:boxId/oggetti', verificaToken, (req, res) => {
    const boxId = req.params.boxId;
    verificaAccessoBoxScrittura(boxId, req.user.id, res, () => {
        const now = new Date().toISOString();
        db.run(`UPDATE oggetti SET data_eliminazione = ? WHERE rif_box = ? AND data_eliminazione IS NULL`,
            [now, boxId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                inserisciLogBox(boxId, 'box_svuotata', `Svuotati ${this.changes} oggetti`, { count: this.changes });
                res.json({ message: `${this.changes} oggetti rimossi.` });
            }
        );
    });
});

// ─── Elenco oggetti nel cestino per utente ───────────────────
app.get('/api/oggetti/eliminate/:utenteId', verificaToken, (req, res) => {
    if (String(req.user.id) !== String(req.params.utenteId))
        return res.status(403).json({ error: "Non autorizzato." });
    const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const utenteId = req.params.utenteId;
    const sql = `
        SELECT o.*, b.nome AS box_nome
        FROM oggetti o
        JOIN box b ON b.id = o.rif_box
        JOIN armadi a ON a.id = b.rif_armadio
        WHERE o.data_eliminazione IS NOT NULL
          AND a.rif_utente = ?
          AND o.data_eliminazione >= ?
        ORDER BY o.data_eliminazione DESC
    `;
    console.log(`[GET oggetti/eliminate] utenteId=${utenteId}, trentaGiorniFa=${trentaGiorniFa}`);
    db.all(sql, [utenteId, trentaGiorniFa], (err, rows) => {
        if (err) {
            console.error('[GET oggetti/eliminate] ERRORE:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[GET oggetti/eliminate] Trovati ${rows.length} oggetti.`);
        res.json({ oggetti_eliminati: rows });
    });
});

// ─────────────────────────────────────────────
// RICERCA GLOBALE
// ─────────────────────────────────────────────

app.get('/api/cerca', verificaToken, (req, res) => {
    const q = `%${req.query.q || ''}%`;
    const userId = req.user.id;

    const armadiCondivisi = `SELECT rif_armadio FROM condivisioni JOIN box ON condivisioni.rif_box = box.id WHERE rif_ospite = ? AND stato = 'accettata'`;

    const sqlBox = `
        SELECT box.id, box.nome, box.descrizione, box.data_creazione, box.is_preferito, 'box' as tipo, armadi.nome as contesto, armadi.nome as nome_armadio
        FROM box
        JOIN armadi ON box.rif_armadio = armadi.id
        WHERE (armadi.rif_utente = ? OR armadi.id IN (${armadiCondivisi}))
          AND box.data_eliminazione IS NULL
          AND box.nome LIKE ?
        LIMIT 20
    `;

    const sqlOggetti = `
        SELECT oggetti.id, oggetti.nome, 'oggetto' as tipo, box.nome as contesto
        FROM oggetti
        JOIN box ON oggetti.rif_box = box.id
        JOIN armadi ON box.rif_armadio = armadi.id
        WHERE (armadi.rif_utente = ? OR armadi.id IN (${armadiCondivisi}))
          AND box.data_eliminazione IS NULL
          AND oggetti.nome LIKE ?
        LIMIT 30
    `;

    db.all(sqlBox, [userId, userId, q], (errBox, boxes) => {
        if (errBox) return res.status(500).json({ error: errBox.message });
        db.all(sqlOggetti, [userId, userId, q], (errOgg, oggetti) => {
            if (errOgg) return res.status(500).json({ error: errOgg.message });
            res.json({ risultati: [...(boxes || []), ...(oggetti || [])] });
        });
    });
});

// ─────────────────────────────────────────────
// QR TOKEN
// ─────────────────────────────────────────────

app.get('/api/box/:id/qr-token', verificaToken, (req, res) => {
    const boxId = req.params.id;
    const token = jwt.sign({ box_id: boxId }, SECRET_KEY, { expiresIn: '30d' });
    res.json({ token });
});

app.get('/api/scan/:boxId', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Token mancante." });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (String(decoded.box_id) !== String(req.params.boxId))
            return res.status(403).json({ error: "Token non valido per questa box." });
        db.get('SELECT box.*, armadi.nome as nome_armadio FROM box JOIN armadi ON box.rif_armadio = armadi.id WHERE box.id = ?',
            [req.params.boxId], (err, row) => {
                if (err || !row) return res.status(404).json({ error: "Box non trovata." });
                res.json({ box: row });
            });
    } catch (e) {
        res.status(403).json({ error: "Token scaduto o non valido." });
    }
});

// ─────────────────────────────────────────────
// CONDIVISIONE BOX
// ─────────────────────────────────────────────

// GET pending count (usato dalla login)
app.get('/api/condivisioni/pending/:utenteId', verificaToken, (req, res) => {
    db.get('SELECT COUNT(*) as count FROM condivisioni WHERE rif_ospite = ? AND stato = ?',
        [req.params.utenteId, 'in_attesa'], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ pending: row?.count || 0 });
        });
});

// GET richieste in attesa per un utente
app.get('/api/condivisioni/in-attesa/:utenteId', verificaToken, (req, res) => {
    const sql = `
        SELECT c.id as condivisione_id, c.rif_box as box_id, b.nome as box_nome,
               CONCAT(a.nome, ' / ', b.nome) as percorso,
               u.username as proprietario_username, c.ruolo, c.creato_il, c.stato
        FROM condivisioni c
        JOIN box b ON b.id = c.rif_box
        JOIN armadi a ON a.id = b.rif_armadio
        JOIN utenti u ON u.id = c.rif_proprietario
        WHERE c.rif_ospite = ? AND c.stato = ?
        ORDER BY c.id DESC
    `;
    db.all(sql, [req.params.utenteId, 'in_attesa'], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ condivisioni: rows });
    });
});

// GET box ricevute in condivisione (con parametro utenteId — compatibilità frontend)
app.get('/api/condivisioni/ricevute/:utenteId', verificaToken, (req, res) => {
    const sql = `
        SELECT c.id as condivisione_id, c.rif_box as box_id, c.ruolo, c.stato, c.creato_il,
               b.nome as box_nome, a.nome as armadio_nome, u.username as proprietario_username
        FROM condivisioni c
        JOIN box b ON b.id = c.rif_box
        JOIN armadi a ON a.id = b.rif_armadio
        JOIN utenti u ON u.id = c.rif_proprietario
        WHERE c.rif_ospite = ?
        ORDER BY c.id DESC
    `;
    db.all(sql, [req.params.utenteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ condivisioni: rows });
    });
});

// GET ospiti di una box
app.get('/api/condivisioni/:boxId', verificaToken, (req, res) => {
    const sql = `
        SELECT c.id, c.ruolo, c.stato, c.creato_il,
               u.username as ospite_username, u.email as ospite_email
        FROM condivisioni c
        JOIN utenti u ON u.id = c.rif_ospite
        WHERE c.rif_box = ?
        ORDER BY c.id DESC
    `;
    db.all(sql, [req.params.boxId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ condivisioni: rows });
    });
});

// PUT aggiorna ruolo
app.put('/api/condivisioni/:id/ruolo', verificaToken, (req, res) => {
    const { ruolo } = req.body;
    if (!['viewer', 'editor'].includes(ruolo)) return res.status(400).json({ error: "ruolo non valido." });
    db.get('SELECT * FROM condivisioni WHERE id = ? AND rif_proprietario = ?',
        [req.params.id, req.user.id], (err, row) => {
            if (err || !row) return res.status(404).json({ error: "Condivisione non trovata." });
            db.run('UPDATE condivisioni SET ruolo = ? WHERE id = ?', [ruolo, req.params.id], function(runErr) {
                if (runErr) return res.status(500).json({ error: runErr.message });
                res.json({ message: "Ruolo aggiornato!" });
            });
        });
});

app.post('/api/condivisioni', verificaToken, (req, res) => {
    const { rif_box, email_ospite, ruolo = 'viewer' } = req.body;
    if (!rif_box || !email_ospite) return res.status(400).json({ error: "rif_box e email_ospite obbligatori." });
    if (!['viewer', 'editor'].includes(ruolo)) return res.status(400).json({ error: "ruolo non valido." });

    db.get('SELECT id FROM utenti WHERE email = ?', [email_ospite], (err, ospite) => {
        if (err || !ospite) return res.status(404).json({ error: "Utente ospite non trovato." });
        if (String(ospite.id) === String(req.user.id)) return res.status(400).json({ error: "Non puoi condividere con te stesso." });

        db.get('SELECT box.id, armadi.rif_utente FROM box JOIN armadi ON box.rif_armadio = armadi.id WHERE box.id = ?',
            [rif_box], (errB, box) => {
                if (errB || !box) return res.status(404).json({ error: "Box non trovata." });
                if (String(box.rif_utente) !== String(req.user.id)) return res.status(403).json({ error: "Non sei il proprietario di questa box." });

                db.get('SELECT id FROM condivisioni WHERE rif_box = ? AND rif_ospite = ?',
                    [rif_box, ospite.id], (errC, existing) => {
                        if (existing) return res.status(409).json({ error: "Condivisione già esistente per questo utente." });

                        db.run('INSERT INTO condivisioni (rif_box, rif_proprietario, rif_ospite, ruolo, stato) VALUES (?, ?, ?, ?, ?)',
                            [rif_box, req.user.id, ospite.id, ruolo, 'in_attesa'], function(runErr) {
                                if (runErr) return res.status(500).json({ error: runErr.message });
                                res.status(201).json({ id: this.lastID, message: "Invito inviato!" });
                            });
                    });
            });
    });
});

app.get('/api/condivisioni/ricevute', verificaToken, (req, res) => {
    const sql = `
        SELECT c.*, b.nome as nome_box, u.username as nome_proprietario
        FROM condivisioni c
        JOIN box b ON b.id = c.rif_box
        JOIN utenti u ON u.id = c.rif_proprietario
        WHERE c.rif_ospite = ?
        ORDER BY c.id DESC
    `;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ condivisioni: rows });
    });
});

app.get('/api/condivisioni/inviate', verificaToken, (req, res) => {
    const sql = `
        SELECT c.*, b.nome as nome_box, u.username as nome_ospite
        FROM condivisioni c
        JOIN box b ON b.id = c.rif_box
        JOIN utenti u ON u.id = c.rif_ospite
        WHERE c.rif_proprietario = ?
        ORDER BY c.id DESC
    `;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ condivisioni: rows });
    });
});

app.put('/api/condivisioni/:id/accetta', verificaToken, (req, res) => {
    db.get('SELECT * FROM condivisioni WHERE id = ? AND rif_ospite = ?',
        [req.params.id, req.user.id], (err, row) => {
            if (err || !row) return res.status(404).json({ error: "Condivisione non trovata." });
            db.run('UPDATE condivisioni SET stato = ? WHERE id = ?', ['accettata', req.params.id], function(runErr) {
                if (runErr) return res.status(500).json({ error: runErr.message });
                res.json({ message: "Condivisione accettata!" });
            });
        });
});

app.put('/api/condivisioni/:id/rifiuta', verificaToken, (req, res) => {
    db.get('SELECT * FROM condivisioni WHERE id = ? AND rif_ospite = ?',
        [req.params.id, req.user.id], (err, row) => {
            if (err || !row) return res.status(404).json({ error: "Condivisione non trovata." });
            db.run('UPDATE condivisioni SET stato = ? WHERE id = ?', ['rifiutata', req.params.id], function(runErr) {
                if (runErr) return res.status(500).json({ error: runErr.message });
                res.json({ message: "Condivisione rifiutata." });
            });
        });
});

app.delete('/api/condivisioni/:id', verificaToken, (req, res) => {
    db.run('DELETE FROM condivisioni WHERE id = ? AND (rif_proprietario = ? OR rif_ospite = ?)',
        [req.params.id, req.user.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: "Condivisione non trovata." });
            res.json({ message: "Condivisione rimossa." });
        });
});

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────

app.get('/api/admin/utenti', verificaAdmin, (req, res) => {
    db.all(`
        SELECT 
            u.*,
            COALESCE(armadi_count.armadi, 0) as num_armadi,
            COALESCE(box_count.box, 0) as num_box,
            COALESCE(oggetti_count.oggetti, 0) as num_oggetti
        FROM utenti u
        LEFT JOIN (
            SELECT rif_utente, COUNT(*) as armadi 
            FROM armadi 
            GROUP BY rif_utente
        ) armadi_count ON u.id = armadi_count.rif_utente
        LEFT JOIN (
            SELECT a.rif_utente, COUNT(*) as box 
            FROM box b
            JOIN armadi a ON b.rif_armadio = a.id
            WHERE b.data_eliminazione IS NULL
            GROUP BY a.rif_utente
        ) box_count ON u.id = box_count.rif_utente
        LEFT JOIN (
            SELECT a.rif_utente, COUNT(*) as oggetti 
            FROM oggetti o
            JOIN box b ON o.rif_box = b.id
            JOIN armadi a ON b.rif_armadio = a.id
            WHERE o.data_eliminazione IS NULL
            GROUP BY a.rif_utente
        ) oggetti_count ON u.id = oggetti_count.rif_utente
        ORDER BY u.id ASC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ utenti: rows });
    });
});

// ─────────────────────────────────────────────
// SEGNALAZIONI UTENTI (FEEDBACK/REPORT)
// ─────────────────────────────────────────────

// Invia una nuova segnalazione/feedback
app.post('/api/segnalazioni', verificaToken, (req, res) => {
    const { tipo, titolo, descrizione, priorita } = req.body;
    
    if (!tipo || !titolo) {
        return res.status(400).json({ error: "Tipo e titolo sono obbligatori." });
    }
    
    // Validazione tipo
    const tipiValidi = ['feedback', 'report', 'suggerimento'];
    if (!tipiValidi.includes(tipo)) {
        return res.status(400).json({ error: "Tipo non valido. Usa: feedback, report o suggerimento." });
    }
    
    // Validazione priorità
    const prioritaValide = ['bassa', 'media', 'alta'];
    if (priorita && !prioritaValide.includes(priorita)) {
        return res.status(400).json({ error: "Priorità non valida. Usa: bassa, media o alta." });
    }
    
    const sql = `INSERT INTO segnalazioni_utenti (rif_utente, tipo, titolo, descrizione, priorita) 
                 VALUES (?, ?, ?, ?, ?)`;
                 
    db.run(sql, [req.user.id, tipo, titolo, descrizione || null, priorita || 'bassa'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ 
            id: this.lastID,
            message: "Segnalazione inviata con successo!" 
        });
    });
});

// Ottieni tutte le segnalazioni (solo per admin)
app.get('/api/admin/segnalazioni', verificaAdmin, (req, res) => {
    const sql = `
        SELECT su.*, u.username, u.email
        FROM segnalazioni_utenti su
        JOIN utenti u ON su.rif_utente = u.id
        ORDER BY 
            CASE su.priorita 
                WHEN 'alta' THEN 3
                WHEN 'media' THEN 2
                WHEN 'bassa' THEN 1
            END DESC,
            su.timestamp DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ segnalazioni: rows || [] });
    });
});

// Aggiorna lo stato di una segnalazione (solo per admin)
app.patch('/api/admin/segnalazioni/:id/stato', verificaAdmin, (req, res) => {
    const { stato } = req.body;
    const statiValidi = ['nuova', 'in_lavorazione', 'risolta', 'chiusa'];
    
    if (!stato || !statiValidi.includes(stato)) {
        return res.status(400).json({ error: "Stato non valido. Usa: nuova, in_lavorazione, risolta o chiusa." });
    }
    
    db.run('UPDATE segnalazioni_utenti SET stato = ? WHERE id = ?', [stato, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: "Segnalazione non trovata." });
        }
        res.json({ message: "Stato segnalazione aggiornato!" });
    });
});

// Elimina una segnalazione (solo per admin)
app.delete('/api/admin/segnalazioni/:id', verificaAdmin, (req, res) => {
    db.run('DELETE FROM segnalazioni_utenti WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: "Segnalazione non trovata." });
        }
        res.json({ message: "Segnalazione eliminata definitivamente!" });
    });
});

// Rispondi a una segnalazione (solo per admin) — crea un messaggio nella posta dell'utente
app.post('/api/admin/segnalazioni/:id/rispondi', verificaAdmin, (req, res) => {
    const { risposta } = req.body;
    if (!risposta || !risposta.trim()) {
        return res.status(400).json({ error: "Il corpo della risposta è obbligatorio." });
    }
    db.get('SELECT * FROM segnalazioni_utenti WHERE id = ?', [req.params.id], (err, segnalazione) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!segnalazione) return res.status(404).json({ error: "Segnalazione non trovata." });
        db.run(
            `INSERT INTO messaggi_utenti (rif_utente, tipo, mittente, oggetto, corpo, importante) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                segnalazione.rif_utente,
                'supporto',
                'Assistenza PeekBox',
                `Risposta alla tua segnalazione: ${segnalazione.titolo}`,
                risposta.trim(),
                1
            ],
            function (insertErr) {
                if (insertErr) return res.status(500).json({ error: insertErr.message });
                db.run('UPDATE segnalazioni_utenti SET stato = ? WHERE id = ?', ['risolta', req.params.id]);
                res.status(201).json({ message: "Risposta inviata all'utente!", messaggio_id: this.lastID });
            }
        );
    });
});

// Ottieni le segnalazioni dell'utente loggato
app.get('/api/segnalazioni/mie', verificaToken, (req, res) => {
    const sql = `
        SELECT * FROM segnalazioni_utenti 
        WHERE rif_utente = ?
        ORDER BY timestamp DESC
    `;
    
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ segnalazioni: rows || [] });
    });
});

app.get('/api/admin/stats', verificaAdmin, (req, res) => {
    const q = `
        SELECT
            (SELECT COUNT(*) FROM utenti) AS tot_utenti,
            (SELECT COUNT(*) FROM box WHERE data_eliminazione IS NULL) AS tot_box,
            (SELECT COUNT(*) FROM oggetti WHERE data_eliminazione IS NULL) AS tot_oggetti,
            (SELECT COUNT(*) FROM segnalazioni_utenti) AS tot_segnalazioni,
            (SELECT COUNT(*) FROM segnalazioni_utenti WHERE stato = 'nuova') AS nuove_segnalazioni,
            (SELECT COUNT(*) FROM condivisioni) AS tot_condivisioni,
            (SELECT COUNT(*) FROM checkpoint_gps) AS tot_checkpoint
    `;
    db.get(q, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.put('/api/admin/utenti/:id/admin', verificaAdmin, (req, res) => {
    const { is_admin } = req.body;
    if (is_admin !== 0 && is_admin !== 1) return res.status(400).json({ error: "is_admin deve essere 0 o 1." });
    if (Number(req.params.id) === Number(req.user.id))
        return res.status(400).json({ error: "Non puoi rimuovere i tuoi stessi permessi admin." });
    db.run('UPDATE utenti SET is_admin = ? WHERE id = ?', [is_admin, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Utente non trovato." });
        res.json({ message: `Admin status aggiornato.` });
    });
});

app.get('/api/admin/utenti/:id/dettaglio', verificaAdmin, (req, res) => {
    db.get('SELECT id, username, email, tipo_profilo, is_admin, data_registrazione FROM utenti WHERE id = ?',
        [req.params.id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: "Utente non trovato." });
            const armadiQ = `SELECT COUNT(*) as tot FROM armadi WHERE rif_utente = ?`;
            const boxQ = `SELECT COUNT(*) as tot FROM box b JOIN armadi a ON b.rif_armadio = a.id WHERE a.rif_utente = ? AND b.data_eliminazione IS NULL`;
            db.get(armadiQ, [req.params.id], (e1, arm) => {
                db.get(boxQ, [req.params.id], (e2, bx) => {
                    user.num_armadi = arm?.tot || 0;
                    user.num_box = bx?.tot || 0;
                    res.json({ utente: user });
                });
            });
        });
});

// ─────────────────────────────────────────────
// MESSAGGI UTENTI (bacheca messaggi sistema/supporto)
// ─────────────────────────────────────────────

app.get('/api/messaggi/non-letto', verificaToken, (req, res) => {
    db.get('SELECT COUNT(*) as count FROM messaggi_utenti WHERE rif_utente = ? AND letto = 0',
        [req.user.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ count: row?.count || 0 });
        });
});

app.get('/api/messaggi', verificaToken, (req, res) => {
    db.all(`SELECT * FROM messaggi_utenti WHERE rif_utente = ? ORDER BY importante DESC, timestamp DESC`,
        [req.user.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ messaggi: rows });
        });
});

app.patch('/api/messaggi/:id/letta', verificaToken, (req, res) => {
    db.run('UPDATE messaggi_utenti SET letto = 1 WHERE id = ? AND rif_utente = ?',
        [req.params.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, changes: this.changes });
        });
});

app.patch('/api/messaggi/:id/importante', verificaToken, (req, res) => {
    db.run(`UPDATE messaggi_utenti SET importante = CASE WHEN importante = 1 THEN 0 ELSE 1 END WHERE id = ? AND rif_utente = ?`,
        [req.params.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, changes: this.changes });
        });
});

app.patch('/api/messaggi/:id/archivia', verificaToken, (req, res) => {
    db.run(`UPDATE messaggi_utenti SET archiviato = CASE WHEN archiviato = 1 THEN 0 ELSE 1 END WHERE id = ? AND rif_utente = ?`,
        [req.params.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, changes: this.changes });
        });
});

app.get('/api/messaggi/archiviati', verificaToken, (req, res) => {
    db.all(`SELECT * FROM messaggi_utenti WHERE rif_utente = ? AND archiviato = 1 ORDER BY timestamp DESC`,
        [req.user.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ messaggi: rows });
        });
});

app.delete('/api/messaggi/:id', verificaToken, (req, res) => {
    db.run('DELETE FROM messaggi_utenti WHERE id = ? AND rif_utente = ?',
        [req.params.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, changes: this.changes });
        });
});

app.post('/api/messaggi', verificaToken, (req, res) => {
    const { tipo, oggetto, corpo } = req.body;
    if (!oggetto || !corpo) return res.status(400).json({ error: 'Oggetto e corpo richiesti.' });
    db.run(`INSERT INTO messaggi_utenti (rif_utente, tipo, mittente, oggetto, corpo, direzione) VALUES (?, ?, ?, ?, ?, 1)`,
        [req.user.id, tipo || 'supporto', 'Assistenza PeekBox', oggetto, corpo], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true });
        });
});

// ─── RISPOSTE RAPIDE ─────────────────────────
app.get('/api/risposte-rapide', verificaToken, (req, res) => {
    db.all(`SELECT * FROM risposte_rapide WHERE rif_utente = ? ORDER BY timestamp DESC`,
        [req.user.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ risposte: rows });
        });
});

app.post('/api/risposte-rapide', verificaToken, (req, res) => {
    const { titolo, corpo } = req.body;
    if (!titolo || !corpo) return res.status(400).json({ error: 'Titolo e corpo richiesti.' });
    db.run(`INSERT INTO risposte_rapide (rif_utente, titolo, corpo) VALUES (?, ?, ?)`,
        [req.user.id, titolo, corpo], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, id: this.lastID });
        });
});

app.delete('/api/risposte-rapide/:id', verificaToken, (req, res) => {
    db.run('DELETE FROM risposte_rapide WHERE id = ? AND rif_utente = ?',
        [req.params.id, req.user.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ok: true, changes: this.changes });
        });
});

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLER (cattura errori da body-parser e route handlers)
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Errore interno del server.' });
});

// ─────────────────────────────────────────────
// AVVIO SERVER
// ─────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server PeekBox attivo su http://${HOST}:${PORT}`);
});
