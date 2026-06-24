module.exports = (db) => ({
    trovaSingolaConArmadio(id, cb) {
        const sql = `
            SELECT box.*, armadi.nome as nome_armadio, armadi.rif_utente
            FROM box
            JOIN armadi ON box.rif_armadio = armadi.id
            WHERE box.id = ?
        `;
        db.get(sql, [id], cb);
    },

    trovaPerUtente(utenteId, cb) {
        const sql = `
            SELECT box.*,
                   CASE WHEN box.data_eliminazione IS NOT NULL THEN 1 ELSE 0 END as is_eliminated,
                   CASE WHEN box.data_eliminazione IS NOT NULL THEN 1 ELSE 0 END as in_cestino,
                   GROUP_CONCAT(DISTINCT oggetti.tipo) as categorie_presenti,
                   MAX(oggetti.fragile) as contiene_fragili,
                   COUNT(oggetti.id) as num_oggetti,
                   COALESCE(SUM(oggetti.quantita), 0) as totale_pezzi,
                   NULL as ruolo_condivisione
            FROM box
            JOIN armadi ON box.rif_armadio = armadi.id
            LEFT JOIN oggetti ON oggetti.rif_box = box.id AND oggetti.data_eliminazione IS NULL
            WHERE armadi.rif_utente = ?
              AND box.data_eliminazione IS NULL
            GROUP BY box.id

            UNION

            SELECT box.*,
                   CASE WHEN box.data_eliminazione IS NOT NULL THEN 1 ELSE 0 END as is_eliminated,
                   CASE WHEN box.data_eliminazione IS NOT NULL THEN 1 ELSE 0 END as in_cestino,
                   GROUP_CONCAT(DISTINCT oggetti.tipo) as categorie_presenti,
                   MAX(oggetti.fragile) as contiene_fragili,
                   COUNT(oggetti.id) as num_oggetti,
                   COALESCE(SUM(oggetti.quantita), 0) as totale_pezzi,
                   c.ruolo as ruolo_condivisione
            FROM box
            JOIN armadi ON box.rif_armadio = armadi.id
            JOIN condivisioni c ON c.rif_box = box.id
            LEFT JOIN oggetti ON oggetti.rif_box = box.id AND oggetti.data_eliminazione IS NULL
            WHERE c.rif_ospite = ?
              AND box.data_eliminazione IS NULL
            GROUP BY box.id
        `;
        db.all(sql, [utenteId, utenteId], cb);
    },

    crea(dati, cb) {
        const sql = `INSERT INTO box (nome, descrizione, rif_armadio, is_preferito, moving_mode, dimensione, data_creazione) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [dati.nome, dati.descrizione, dati.rif_armadio, dati.is_preferito, dati.moving_mode, dati.dimensione, dati.data_creazione], cb);
    },

    aggiornaPreferito(id, isPreferito, cb) {
        db.run('UPDATE box SET is_preferito = ? WHERE id = ?', [isPreferito, id], cb);
    },

    aggiornaMovingMode(id, movingMode, cb) {
        db.run('UPDATE box SET moving_mode = ? WHERE id = ?', [movingMode, id], cb);
    },

    eliminaSoft(id, dataEliminazione, cb) {
        db.run('UPDATE box SET data_eliminazione = ? WHERE id = ?', [dataEliminazione, id], cb);
    },

    elimina(id, cb) {
        db.run('DELETE FROM box WHERE id = ?', [id], cb);
    },

    ripristina(id, cb) {
        db.run('UPDATE box SET data_eliminazione = NULL WHERE id = ?', [id], cb);
    },

    trovaEliminate(utenteId, dataLimite, cb) {
        const sql = `
            SELECT box.*, armadi.nome as nome_armadio, COUNT(oggetti.id) as num_oggetti
            FROM box
            JOIN armadi ON box.rif_armadio = armadi.id
            LEFT JOIN oggetti ON oggetti.rif_box = box.id
            WHERE armadi.rif_utente = ?
              AND box.data_eliminazione IS NOT NULL
              AND box.data_eliminazione >= ?
            GROUP BY box.id
            ORDER BY box.data_eliminazione DESC
        `;
        db.all(sql, [utenteId, dataLimite], cb);
    },

    pulisciCestino(dataLimite, cb) {
        db.run('DELETE FROM box WHERE data_eliminazione IS NOT NULL AND data_eliminazione < ?', [dataLimite], cb);
    },

    trovaLog(boxId, cb) {
        db.all('SELECT * FROM box_log WHERE rif_box = ? ORDER BY creato_il DESC LIMIT 50', [boxId], cb);
    },

    verificaProprietario(id, utenteId, cb) {
        const sql = `
            SELECT box.id FROM box
            JOIN armadi ON box.rif_armadio = armadi.id
            WHERE box.id = ? AND armadi.rif_utente = ?
              AND box.data_eliminazione IS NOT NULL
        `;
        db.get(sql, [id, utenteId], cb);
    }
});
