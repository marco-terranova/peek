const DIMENSIONI_VALIDE = ['piccola', 'media', 'grande', 'pallet'];

module.exports = (boxRepository) => ({
    creaBox(dati, cb) {
        if (!DIMENSIONI_VALIDE.includes(dati.dimensione)) {
            return cb(new Error("Dimensione non valida. Usa: piccola, media, grande o pallet."));
        }
        if (dati.dimensione === 'pallet' && dati.tipoProfilo !== 'business') {
            return cb(new Error("Dimensione pallet riservata ai profili Business."));
        }
        if (!dati.nome || !dati.rif_armadio) {
            return cb(new Error("nome e rif_armadio obbligatori."));
        }

        const boxData = {
            nome: dati.nome,
            descrizione: dati.descrizione || null,
            rif_armadio: dati.rif_armadio,
            is_preferito: dati.is_preferito ? 1 : 0,
            moving_mode: dati.moving_mode ? 1 : 0,
            dimensione: dati.dimensione,
            data_creazione: new Date().toISOString().slice(0, 10)
        };
        boxRepository.crea(boxData, function (err) {
            if (err) return cb(err);
            cb(null, { lastID: this.lastID });
        });
    },

    ottieniBoxUtente(utenteId, cb) {
        boxRepository.trovaPerUtente(utenteId, (err, rows) => {
            if (err) return cb(err);
            cb(null, rows || []);
        });
    },

    ottieniBoxSingola(id, cb) {
        boxRepository.trovaSingolaConArmadio(id, (err, row) => {
            if (err) return cb(err);
            cb(null, row);
        });
    },

    aggiornaPreferito(id, isPreferito, cb) {
        boxRepository.aggiornaPreferito(id, isPreferito ? 1 : 0, function (err) {
            if (err) return cb(err);
            cb(null, { message: "Stato preferito aggiornato!" });
        });
    },

    aggiornaMovingMode(id, movingMode, cb) {
        boxRepository.aggiornaMovingMode(id, movingMode ? 1 : 0, function (err) {
            if (err) return cb(err);
            cb(null, { message: `Moving Mode ${movingMode ? 'attivato' : 'disattivato'}!`, moving_mode: movingMode ? 1 : 0 });
        });
    },

    eliminaBox(id, cb) {
        const now = new Date().toISOString();
        boxRepository.eliminaSoft(id, now, function (err) {
            if (err) return cb(err);
            cb(null, { message: "Box spostata nel cestino!" });
        });
    },

    eliminaBoxDefinitivo(id, cb) {
        boxRepository.elimina(id, function (err) {
            if (err) return cb(err);
            cb(null, { message: "Box eliminata definitivamente.", id: Number(id) });
        });
    },

    ripristinaBox(id, cb) {
        boxRepository.ripristina(id, function (err) {
            if (err) return cb(err);
            cb(null, { message: "Box ripristinata con successo!" });
        });
    },

    ottieniBoxEliminate(utenteId, cb) {
        const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        boxRepository.trovaEliminate(utenteId, trentaGiorniFa, (err, rows) => {
            if (err) return cb(err);
            cb(null, rows || []);
        });
    },

    pulisciCestino(cb) {
        const trentaGiorniFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        boxRepository.pulisciCestino(trentaGiorniFa, function (err) {
            if (err) return cb(err);
            cb(null, { message: `Rimosse ${this.changes} box scadute.` });
        });
    },

    ottieniLog(boxId, cb) {
        boxRepository.trovaLog(boxId, (err, rows) => {
            if (err) return cb(err);
            cb(null, rows || []);
        });
    },

    verificaProprietario(id, utenteId, cb) {
        boxRepository.verificaProprietario(id, utenteId, cb);
    }
});
