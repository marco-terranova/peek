import { Injectable } from '@angular/core';
import { DatabaseService } from './database';
import { firstValueFrom } from 'rxjs';

interface CercaRisultato {
  id: number;
  nome: string;
  tipo: 'box' | 'oggetto';
  contesto: string;
}

interface Contesto {
  intent: string;
  dati?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotEngineService {

  private ultimoContesto: Contesto | null = null;

  constructor(private dbService: DatabaseService) {}

  async processMessage(msg: string): Promise<string> {
    const lower = msg.toLowerCase().trim();
    const utenteId = localStorage.getItem('utente_id');

    if (!utenteId) {
      return 'Sembra che tu non abbia effettuato l\'accesso. Accedi per usare l\'assistente.';
    }

    const risposta = await this.matchIntent(lower, utenteId);
    return risposta;
  }

  private async matchIntent(lower: string, utenteId: string): Promise<string> {
    if (this.is(lower, ['ciao', 'salve', 'buongiorno', 'buonasera', 'buona sera', 'hey', 'ehi', 'buona giornata', 'buona serata', 'buona giornat', 'saluti', 'salutami'])) {
      return this.greetingResponse();
    }

    if (this.hasAny(lower, ['grazie mille', 'ti ringrazio', 'grazie tante', 'grazie', 'thanks', 'thank', 'sei gentile', 'sei unico', 'ti ringrazio tanto', 'grazie infinite', 'grazie mille'])) {
      return 'Prego! 😊 Sono qui per questo. Se hai bisogno di altro, chiedi pure!';
    }

    if (this.hasAny(lower, ['come stai', 'come va', 'tutto bene', 'come butta', 'come ti senti', 'tutto ok', 'tutto a posto', 'come procede', 'come va la vita'])) {
      return 'Tutto a posto! 🚀 Sempre pronto a darti una mano con box, oggetti e tutto il resto. Tu dimmi!';
    }

    if (this.hasAny(lower, ['chi sei', 'chi ti ha creato', 'che sei', 'chi sei tu', 'cosa sei', 'da chi sei stato creato', 'chi ha fatto', 'che cosa sei'])) {
      return 'Sono l\'assistente virtuale di PeekBox 🤖\n\nSono stato creato per aiutarti a gestire il tuo profilo, le tue box, i tuoi oggetti, gli spazi e le condivisioni. Conosciamoci meglio: dimmi cosa ti serve!';
    }

    if (this.is(lower, ['aiuto', 'help', 'cosa sai fare', 'comandi', 'cosa puoi fare', 'comando', 'funzioni', 'help!', 'cosa fai', 'che sai fare', 'cosa posso chiederti', 'di cosa sei capace', 'cosa posso fare', 'lista comandi', 'elenco comandi'])) {
      return this.helpResponse();
    }

    if (this.hasAny(lower, ['messaggi', 'centro messaggi', 'supporto', 'contatta', 'assistenza', 'parlare con', 'contattare', 'servizio clienti', 'reclamo', 'problema', 'segnala', 'segnalare', 'bug', 'errore', 'assist']) ||
        (lower.includes('aiut') && lower.includes('contatt'))) {
      this.ultimoContesto = { intent: 'messaggi' };
      return this.messaggiResponse();
    }

    const cercaMatch = this.estraiTermineRicerca(lower);
    if (cercaMatch) {
      if (this.hasAny(lower, ['dov', 'posizione', 'dove sta', 'dov\'', 'posizion', 'checkpoint', 'gps', 'coordinate'])) {
        this.ultimoContesto = { intent: 'dove', dati: { termine: cercaMatch } };
        return await this.doveSiTrovaOggettoResponse(utenteId, cercaMatch);
      }
      this.ultimoContesto = { intent: 'cerca', dati: { termine: cercaMatch } };
      return await this.cercaOggettiResponse(utenteId, cercaMatch);
    }

    if (this.hasAny(lower, ['cestin', 'eliminat', 'cancell', 'cestino', 'cancellat', 'eliminato', 'eliminate', 'cancellate', 'eliminati', 'cancellati', 'box eliminate', 'cestino delle box', 'cestino box'])) {
      this.ultimoContesto = { intent: 'cestino' };
      return await this.cestinoResponse(utenteId);
    }

    if (this.hasAny(lower, ['preferit', 'preferite', 'preferiti', 'preferito', 'stelle', 'star', 'preferenze', 'preferita', 'preferiti', 'box preferite', 'box preferiti'])) {
      this.ultimoContesto = { intent: 'preferite' };
      return await this.preferiteResponse(utenteId);
    }

    if (this.hasAny(lower, ['transit', 'moving', 'in moviment', 'spostament', 'spostate', 'spostato', 'viaggio', 'in viaggio', 'in corso', 'moving mode', 'spostamento in corso', 'box in transito', 'in trasporto'])) {
      this.ultimoContesto = { intent: 'transito' };
      return await this.transitResponse(utenteId);
    }

    if (this.hasAny(lower, ['mostra', 'elenco', 'lista', 'voglio vedere', 'fammi vedere', 'apri', 'visualizza', 'vedi', 'vediamo', 'elencami'])) {
      if (this.hasAny(lower, ['preferit', 'preferite'])) {
        this.ultimoContesto = { intent: 'preferite' };
        return await this.preferiteResponse(utenteId);
      }
      if (this.hasAny(lower, ['cestin', 'eliminat', 'cancell'])) {
        this.ultimoContesto = { intent: 'cestino' };
        return await this.cestinoResponse(utenteId);
      }
      if (this.hasAny(lower, ['transit', 'spostament', 'moviment'])) {
        this.ultimoContesto = { intent: 'transito' };
        return await this.transitResponse(utenteId);
      }
      if (this.hasAny(lower, ['condivis', 'condivid'])) {
        this.ultimoContesto = { intent: 'condivisioni' };
        return await this.condivisioniResponse(utenteId);
      }
      if (this.hasAny(lower, ['box', 'scatol'])) {
        this.ultimoContesto = { intent: 'box' };
        return await this.boxResponse(utenteId);
      }
      if (this.hasAny(lower, ['oggett', 'articol'])) {
        this.ultimoContesto = { intent: 'oggetti' };
        return await this.oggettiResponse(utenteId);
      }
      if (this.hasAny(lower, ['spazi', 'armadi', 'archivi'])) {
        this.ultimoContesto = { intent: 'spazi' };
        return await this.spaziResponse(utenteId);
      }
      // "mostra" senza argomento: usa il contesto precedente
      if (this.ultimoContesto) {
        const ctxRisposta = await this.handleContext(lower, utenteId);
        if (ctxRisposta) return ctxRisposta;
      }
      return 'Cosa vuoi vedere? Prova con: "Mostra box", "Mostra preferite", "Mostra spazi", "Mostra condivisioni".';
    }

    if ((this.hasAny(lower, ['box', 'scatol']) && (this.hasAny(lower, ['quant', 'conta', 'total', 'ho', 'quante', 'quanti', 'numero', 'conteggio', 'tante', 'tutte', 'mie', 'miei']))) ||
        lower === 'box' || lower === 'scatole' || lower === 'le mie box' || lower === 'le scatole' || lower === 'tutte le box') {
      this.ultimoContesto = { intent: 'box' };
      return await this.boxResponse(utenteId);
    }

    if (this.hasAny(lower, ['oggett', 'articol', 'cose che ho', 'cose', 'elementi', 'pezzi', 'beni', 'prodotti', 'merce', 'inventario', 'catalogo', 'collezione'])) {
      this.ultimoContesto = { intent: 'oggetti' };
      return await this.oggettiResponse(utenteId);
    }
    if (lower.includes('quanti') && !this.hasAny(lower, ['box', 'scatol', 'spazi', 'armadi', 'giorni', 'tempo', 'mesi', 'volte'])) {
      this.ultimoContesto = { intent: 'oggetti' };
      return await this.oggettiResponse(utenteId);
    }

    if (this.hasAny(lower, ['condivis', 'condivid', 'con chi', 'condivision', 'in comune', 'ospiti', 'inviti', 'invitato', 'chi condivide', 'condivisa', 'condivise', 'condiviso', 'condivider', 'share', 'sharing', 'chi ha accesso', 'permessi', 'autorizzaz'])) {
      this.ultimoContesto = { intent: 'condivisioni' };
      return await this.condivisioniResponse(utenteId);
    }

    if (this.hasAny(lower, ['spazi', 'armadi', 'archivi', 'luoghi', 'dove tengo', 'miei spazi', 'miei armadi', 'miei archivi', 'scaffali', 'ripiani', 'locali', 'stanze', 'magazzini', 'depositi', 'dove sono le box', 'dove sono le scatole', 'spazio', 'archivio'])) {
      this.ultimoContesto = { intent: 'spazi' };
      return await this.spaziResponse(utenteId);
    }

    if (this.hasAny(lower, ['profilo', 'account', 'miei dati', 'informazioni', 'informazioni account', 'impostazioni', 'impostazione', 'impostaz', 'dati account', 'dati personali'])) {
      this.ultimoContesto = { intent: 'profilo' };
      return '👤 **Il tuo profilo**\n\nNella sezione Profilo puoi:\n- Modificare nome, email e password\n- Cambiare foto profilo\n- Regolare le notifiche\n- Vedere i tuoi messaggi\n- Gestire le condivisioni\n- Monitorare lo spazio utilizzato\n\nVai su Profilo per gestire tutto!';
    }

    if (this.hasAny(lower, ['notific', 'notifica', 'alert', 'avvis', 'avviso', 'promemoria', 'notifiche', 'notificato', 'notificata', 'ricevere notifiche', 'avvisi'])) {
      this.ultimoContesto = { intent: 'notifiche' };
      return '🔔 **Notifiche**\n\nPuoi gestire le tue notifiche dalla pagina "Informazioni Account" nel tuo profilo. Lì puoi scegliere quali notifiche ricevere.\n\nAl momento sono disponibili notifiche per:\n- Movimenti delle box\n- Condivisioni\n- Messaggi dal supporto\n- Promemoria';
    }

    if (this.hasAny(lower, ['buio', 'tema', 'dark', 'modalit', 'scur', 'tema scuro', 'dark mode', 'tema chiaro', 'light', 'tema scura', 'colori', 'modalità scura', 'tema scuro', 'light mode', 'tema light'])) {
      this.ultimoContesto = { intent: 'tema' };
      return '🎨 **Tema**\n\nPeekBox supporta la modalità scura! Puoi attivarla dalle impostazioni del tuo dispositivo o dall\'app. Il tema scuro riduce l\'affaticamento degli occhi e consuma meno batteria sui display OLED.';
    }

    if (this.hasAny(lower, ['totali', 'riepilog', 'stat', 'dashboard', 'sommario', 'riassunto', 'numeri', 'statistiche', 'statistico', 'dati', 'report', 'resoconto', 'quadro', 'situazione', 'panoramica', 'riepilogo', 'summary', 'stats'])) {
      this.ultimoContesto = { intent: 'totali' };
      return await this.totaliResponse(utenteId);
    }

    if ((this.hasAny(lower, ['posizion', 'checkpoint', 'gps', 'coordinate', 'mappa', 'dove sono', 'ultima posizione', 'ultimo', 'ubicazion']) ||
         (lower.includes('dov') && !cercaMatch)) &&
        this.hasAny(lower, ['box', 'scatol', 'mia', 'mie', 'mio'])) {
      this.ultimoContesto = { intent: 'posizione' };
      return await this.posizioneBoxResponse(utenteId);
    }

    if (this.hasAny(lower, ['posizion', 'checkpoint', 'gps', 'coordinate', 'mappa', 'dove sono', 'ultima posizione', 'ultimo', 'ubicazion'])) {
      this.ultimoContesto = { intent: 'posizione' };
      return await this.posizioneBoxResponse(utenteId);
    }

    if (this.hasAny(lower, ['non funziona', 'non va', 'non carica', 'non si apre', 'bug', 'errore', 'si blocca', 'crasha', 'problema tecnico', 'problemi', 'non riesco', 'non parte', 'non risponde', 'non fa niente'])) {
      return 'Mi dispiace per l\'inconveniente 🙁\n\nTi consiglio di:\n1. Controllare la connessione internet\n2. Riavviare l\'app\n3. Se il problema persiste, contattare il supporto dalla sezione "Messaggi" nel profilo.\n\nSe vuoi, posso aiutarti con altro!';
    }

    if (this.hasAny(lower, ['recuper', 'ripristin', 'tornare', 'ripristina', 'recupera', 'annulla', 'undo', 'ripristinare']) &&
        this.hasAny(lower, ['box', 'scatol', 'cancell', 'eliminat'])) {
      return '🗑️ **Recuperare una box**\n\nLe box eliminate vengono conservate nel cestino per 30 giorni prima della rimozione definitiva.\n\nPer visualizzarle: "Mostra cestino" o "Cestino?"\n\nSe vuoi ripristinare una box, vai nella sezione "Cestino" dal menu principale e clicca sul pulsante di ripristino.';
    }

    if (this.hasAny(lower, ['crea', 'creare', 'nuova', 'aggiungi', 'aggiungere', 'nuovo', 'creazione', 'creo', 'creiamo', 'crearne']) &&
        this.hasAny(lower, ['box', 'scatol', 'archivi', 'armadi'])) {
      return '📦 **Creare una nuova box**\n\nPer creare una nuova box:\n1. Vai nella sezione "Crea Box" dal menu\n2. Scegli un nome e una descrizione\n3. Seleziona l\'armadio dove archiviarla\n4. Clicca "Registra nel Sistema"\n\nVai su "Crea Box" per iniziare!';
    }

    if (this.hasAny(lower, ['crea', 'creare', 'nuovo', 'aggiungi', 'aggiungere', 'creazione', 'creo']) &&
        this.hasAny(lower, ['spazi', 'armadi', 'archivi', 'spazio', 'luogo', 'locale', 'stanza'])) {
      return '🏠 **Creare un nuovo spazio**\n\nPer creare un nuovo armadio:\n1. Vai su "Gestione Spazi" dal menu\n2. Clicca il pulsante "+" in basso\n3. Inserisci il nome dell\'armadio\n4. Conferma la creazione\n\nVai su "Gestione Spazi" per iniziare!';
    }

    if (this.hasAny(lower, ['come si fa', 'come faccio', 'come posso', 'come si', 'si può', 'è possibile', 'vorrei', 'vorrei sapere', 'spiegami', 'insegnami', 'guida', 'tutorial', 'come fare per', 'come devo'])) {
      if (this.hasAny(lower, ['condivid', 'condivis', 'invit', 'ospit'])) {
        return '🤝 **Come condividere una box**\n\nVai su "Condividi Box" dal profilo. Scegli la box, seleziona il permesso (Visualizzatore/Editor), inserisci l\'email dell\'ospite e clicca "Invita". L\'ospite riceverà una notifica per accettare o rifiutare.';
      }
      if (this.hasAny(lower, ['scansion', 'qr', 'scan', 'leggere', 'inquadr', 'codice', 'barcode', 'qr code'])) {
        return '📷 **Come scansionare un QR code**\n\nVai su "Scansiona QR" dal menu principale. Inquadra il QR code della box con la fotocamera. La box verrà aperta automaticamente per visualizzarne o modificarne il contenuto.';
      }
      if (this.hasAny(lower, ['cerc', 'trov', 'cerca', 'ricerca'])) {
        return '🔍 **Come cercare oggetti**\n\nPuoi cercare oggetti in due modi:\n- Usa la barra di ricerca nella home\n- Chiedimi direttamente: "Cerca [nome oggetto]"\nTi mostrerò dove si trova ogni oggetto!';
      }
      if (this.hasAny(lower, ['cancell', 'elimin', 'rimuov', 'cestin'])) {
        return '🗑️ **Come eliminare una box**\n\nApri la box che vuoi eliminare, clicca sul menu (tre puntini) e seleziona "Elimina". La box finirà nel cestino, dove resterà per 30 giorni prima della rimozione definitiva.';
      }
      if (this.hasAny(lower, ['spazi', 'armadi', 'archivi', 'spazio'])) {
        return '🏠 **Come gestire gli spazi**\n\nVai su "Gestione Spazi" dal menu. Qui puoi creare nuovi armadi, modificarli o eliminarli. Per creare un nuovo armadio, clicca il pulsante "+" in basso.';
      }
      if (this.hasAny(lower, ['profil', 'impostaz', 'cambia', 'modific', 'aggiorn'])) {
        return '👤 **Come modificare il profilo**\n\nVai su "Profilo" e poi su "Informazioni Account". Qui puoi cambiare nome, email, password e foto profilo.';
      }
      return this.helpResponse();
    }

    if (this.ultimoContesto) {
      const ctxRisposta = await this.handleContext(lower, utenteId);
      if (ctxRisposta) return ctxRisposta;
    }

    const fallback = await this.fallbackResponse(lower, utenteId);
    if (fallback) return fallback;

    this.ultimoContesto = null;
    return (
      'Non ho capito bene la tua richiesta.\n\n' +
      'Prova con una di queste:\n' +
      '- "Quante box ho?"\n' +
      '- "Quanti oggetti ho?"\n' +
      '- "Spazi?"\n' +
      '- "Condivisioni?"\n' +
      '- "Totali?"\n' +
      '- "Messaggi?"\n' +
      '- "Aiuto" (per l\'elenco completo)'
    );
  }

  private async fallbackResponse(lower: string, utenteId: string): Promise<string | null> {
    if (this.hasAny(lower, ['quant', 'quanti', 'quante', 'conta', 'numero', 'totali', 'conteggio'])) {
      this.ultimoContesto = { intent: 'totali' };
      return await this.totaliResponse(utenteId);
    }
    if (this.hasAny(lower, ['sì', 'si', 'ok', 'okay', 'va bene', 'd\'accordo', 'certamente', 'certo', 'sicuro', 'perfetto', 'grande', 'ottimo', 'bene'])) {
      if (this.ultimoContesto) {
        return 'Bene! Cosa vuoi fare ora? Puoi chiedermi qualunque cosa sulle tue box, oggetti, spazi e condivisioni.';
      }
      return 'Ok! Dimmi cosa posso fare per te.';
    }
    if (this.hasAny(lower, ['no', 'niente', 'nulla', 'nessuno', 'mai', 'non voglio', 'non mi serve', 'basta', 'stop', 'fermo', 'lascia stare', 'lascia perdere'])) {
      this.ultimoContesto = null;
      return 'Va bene, se hai bisogno di me, sono qui! Basta scrivermi. 😊';
    }
    return null;
  }

  private async handleContext(lower: string, utenteId: string): Promise<string | null> {
    if (!this.ultimoContesto) return null;

    const ctx = this.ultimoContesto;
    const currentIntent = ctx.intent;

    if (this.hasAny(lower, ['preferit', 'preferite', 'preferiti', 'preferito', 'stelle', 'preferenze'])) {
      this.ultimoContesto = { intent: 'preferite' };
      return await this.preferiteResponse(utenteId);
    }
    if (this.hasAny(lower, ['transit', 'moving', 'spostament', 'in moviment', 'viaggio', 'in corso', 'in transito'])) {
      this.ultimoContesto = { intent: 'transito' };
      return await this.transitResponse(utenteId);
    }
    if (this.hasAny(lower, ['cestin', 'eliminat', 'cancell', 'cestino', 'cancellat', 'eliminate'])) {
      this.ultimoContesto = { intent: 'cestino' };
      return await this.cestinoResponse(utenteId);
    }
    if (this.hasAny(lower, ['totali', 'riepilog', 'stat', 'numeri', 'sommario', 'riassunto', 'riepilogo', 'statistiche'])) {
      this.ultimoContesto = { intent: 'totali' };
      return await this.totaliResponse(utenteId);
    }
    if (this.hasAny(lower, ['condivis', 'condivid', 'ospiti', 'inviti', 'con chi', 'condivision'])) {
      this.ultimoContesto = { intent: 'condivisioni' };
      return await this.condivisioniResponse(utenteId);
    }
    if (this.hasAny(lower, ['spazi', 'armadi', 'archivi', 'luoghi', 'locali', 'spazio'])) {
      this.ultimoContesto = { intent: 'spazi' };
      return await this.spaziResponse(utenteId);
    }
    if (this.hasAny(lower, ['box', 'scatol', 'mie box']) &&
        (this.hasAny(lower, ['quant', 'conta', 'total', 'ho', 'quante', 'quanti', 'numero', 'tutte']))) {
      this.ultimoContesto = { intent: 'box' };
      return await this.boxResponse(utenteId);
    }
    if (this.hasAny(lower, ['oggett', 'articol', 'cose', 'elementi', 'pezzi']) &&
        (this.hasAny(lower, ['quant', 'conta', 'total', 'ho', 'quanti', 'quante', 'numero']))) {
      this.ultimoContesto = { intent: 'oggetti' };
      return await this.oggettiResponse(utenteId);
    }

    const richiedeDettagli = this.hasAny(lower, ['dimmi', 'dettagli', 'approfondisci', 'spiega meglio', 'altro', 'ancora', 'inoltre', 'poi', 'e poi', 'continua', 'vai avanti', 'di più', 'più informazioni', 'descrivi', 'più dettagli']);

    if (richiedeDettagli) {
      switch (currentIntent) {
        case 'box':
          return 'Ecco cosa puoi approfondire:\n- "Box preferite?" — quelle che hai contrassegnato\n- "Box in transito?" — quelle in movimento\n- "Cestino?" — quelle eliminate\n- "Totali?" — riepilogo completo';
        case 'oggetti':
          return 'Per i tuoi oggetti puoi:\n- "Cerca [nome]" — trovare un oggetto specifico\n- "Dove si trova [nome]?" — posizione esatta\n- "Totali?" — statistiche complete';
        case 'condivisioni':
          return 'Per le condivisioni puoi:\n- "Inviti?" — richieste in attesa\n- "Spazi?" — i tuoi armadi\n- "Totali?" — riepilogo completo';
        case 'totali':
          return 'Per maggiori dettagli:\n- "Box?" — tutte le box\n- "Oggetti?" — tutti gli oggetti\n- "Spazi?" — armadi e archivi\n- "Condivisioni?" — chi condivide con te';
        case 'cestino':
          return 'Le box eliminate:\n- Vengono conservate per 30 giorni\n- Dopo 30 giorni sono rimosse definitivamente\n- Puoi ripristinarle dal cestino\n\n"Recupera box?" per sapere come ripristinare.';
        case 'preferite':
          return 'Per gestire le preferite:\n- Apri una box e clicca sulla stellina\n- Puoi vederle tutte qui: "Mostra preferite"\n- Scopri le box in transito: "Transito?"';
        default:
          return await this.totaliResponse(utenteId);
      }
    }

    if (this.hasAny(lower, ['e queste', 'e quelli', 'e queste?', 'e quelli?', 'e quelle', 'e quelle?', 'quali', 'quali sono', 'come'])) {
      switch (currentIntent) {
        case 'box':
          return await this.boxResponse(utenteId);
        case 'oggetti':
          return await this.oggettiResponse(utenteId);
        case 'spazi':
          return await this.spaziResponse(utenteId);
        case 'condivisioni':
          return await this.condivisioniResponse(utenteId);
        default:
          return await this.totaliResponse(utenteId);
      }
    }

    return null;
  }

  suggerisciDomande(msg: string, risposta: string): string[] {
    const lower = msg.toLowerCase().trim();

    if (risposta.includes('Non ho capito') || risposta.includes('non autenticato')) {
      return ['Aiuto', 'Quante box ho?', 'Totali', 'Messaggi?'];
    }

    if (risposta.includes('Prego') || risposta.includes('grazie') || risposta.includes('prego')) {
      return ['Quante box ho?', 'Totali?', 'Aiuto'];
    }

    if (risposta.includes('come stai') || risposta.includes('come va') || risposta.includes('Tutto a posto')) {
      return ['Quante box ho?', 'Aiuto', 'Totali?'];
    }

    if (risposta.includes('assistente virtuale') || risposta.includes('chi sei')) {
      return ['Quante box ho?', 'Aiuto', 'Totali?', 'Condivisioni?'];
    }

    if (risposta.includes('Messaggi') || risposta.includes('supporto') || this.ultimoContesto?.intent === 'messaggi') {
      return ['Quante box ho?', 'Spazi?', 'Totali?', 'Aiuto'];
    }

    if (risposta.includes('profilo') || risposta.includes('Informazioni') || risposta.includes('Profilo') || this.ultimoContesto?.intent === 'profilo') {
      return ['Notifiche?', 'Quante box ho?', 'Totali?', 'Aiuto'];
    }

    if (risposta.includes('Notifiche') || this.ultimoContesto?.intent === 'notifiche') {
      return ['Profilo?', 'Quante box ho?', 'Totali?'];
    }

    if (risposta.includes('Tema') || risposta.includes('modalità scura') || this.ultimoContesto?.intent === 'tema') {
      return ['Quante box ho?', 'Profilo?', 'Aiuto'];
    }

    if (this.ultimoContesto?.intent === 'aiuto' || lower === 'aiuto' || lower === 'help' || lower === 'cosa sai fare' || lower === 'comandi') {
      return ['Quante box ho?', 'Quanti oggetti ho?', 'Condivisioni?', 'Totali?'];
    }

    if (this.hasAny(lower, ['ciao', 'salve', 'buongiorn', 'buonasera', 'hey', 'buona sera', 'ehi'])) {
      return ['Quante box ho?', 'Aiuto', 'Totali?'];
    }

    if (this.ultimoContesto?.intent === 'cestino') {
      return ['Quante box ho?', 'Box preferite?', 'Recuperare box?', 'Totali?'];
    }

    if (this.ultimoContesto?.intent === 'preferite') {
      return ['Quante box ho?', 'Box in transito?', 'Totali?', 'Box preferite?'];
    }

    if (this.ultimoContesto?.intent === 'transito') {
      return ['Quante box ho?', 'Box preferite?', 'Cestino?', 'Totali?'];
    }

    if (this.ultimoContesto?.intent === 'condivisioni') {
      return ['Spazi?', 'Totali?', 'Quante box ho?', 'Inviti?'];
    }

    if (this.ultimoContesto?.intent === 'spazi') {
      return ['Quante box ho?', 'Totali?', 'Condivisioni?', 'Crea spazio?'];
    }

    if (this.ultimoContesto?.intent === 'totali') {
      return ['Quante box ho?', 'Spazi?', 'Condivisioni?', 'Profilo?'];
    }

    if (this.ultimoContesto?.intent === 'posizione' || this.hasAny(lower, ['dov', 'posizion', 'checkpoint', 'gps', 'mappa'])) {
      return ['Quante box ho?', 'Totali?', 'Box in transito?', 'Aiuto'];
    }

    if (this.ultimoContesto?.intent === 'cerca' || this.hasAny(lower, ['cerca', 'trova', 'dove trovo'])) {
      return ['Dove si trova?', 'Totali?', 'Aiuto'];
    }

    if (this.ultimoContesto?.intent === 'dove' || this.hasAny(lower, ['dove si trova', 'posizione'])) {
      return ['Cerca altro', 'Totali?', 'Quante box ho?', 'Aiuto'];
    }

    if (this.ultimoContesto?.intent === 'box' || this.hasAny(lower, ['box', 'scatol'])) {
      return ['Box preferite?', 'Box in transito?', 'Cestino?', 'Totali?'];
    }

    if (this.ultimoContesto?.intent === 'oggetti' || this.hasAny(lower, ['oggett', 'articol'])) {
      return ['Cerca un oggetto', 'Quante box ho?', 'Totali?', 'Spazi?'];
    }

    if (this.hasAny(lower, ['come si fa', 'come faccio', 'come posso', 'guida', 'tutorial'])) {
      if (this.hasAny(lower, ['condivid', 'condivis'])) return ['Condivisioni?', 'Quante box ho?', 'Aiuto'];
      if (this.hasAny(lower, ['qr', 'scansion', 'codice'])) return ['Quante box ho?', 'Aiuto', 'Totali?'];
      if (this.hasAny(lower, ['cerc', 'trov', 'ricerca'])) return ['Cerca un oggetto', 'Quante box ho?', 'Aiuto'];
      if (this.hasAny(lower, ['spazi', 'armadi'])) return ['Spazi?', 'Quante box ho?', 'Aiuto'];
      return ['Aiuto', 'Quante box ho?', 'Totali?'];
    }

    if (risposta.includes('Recuperare') || this.hasAny(lower, ['recuper', 'ripristin'])) {
      return ['Cestino?', 'Quante box ho?', 'Aiuto'];
    }

    if (risposta.includes('Creare') || risposta.includes('Creazione') ||
        this.hasAny(lower, ['crea', 'creare', 'nuova', 'aggiungi'])) {
      return ['Quante box ho?', 'Spazi?', 'Aiuto'];
    }

    if (risposta.includes('funziona') || risposta.includes('inconveniente') ||
        this.hasAny(lower, ['non funziona', 'non va', 'errore', 'problema'])) {
      return ['Messaggi?', 'Aiuto', 'Quante box ho?'];
    }

    if (risposta.includes('Bene!') || risposta.includes('Ok!') || risposta.includes('Va bene')) {
      return ['Quante box ho?', 'Aiuto', 'Totali?', 'Condivisioni?'];
    }

    return ['Aiuto', 'Quante box ho?', 'Totali?', 'Messaggi?'];
  }


  private is(lower: string, matches: string[]): boolean {
    return matches.some(m => lower === m || lower.startsWith(m + ' ') || lower.startsWith(m + '?') || lower.startsWith(m + ',') || lower.startsWith(m + '.') || lower.startsWith(m + '!'));
  }

  private hasAny(lower: string, keywords: string[]): boolean {
    return keywords.some(k => lower.includes(k));
  }

  private normalizzaTesto(testo: string): string {
    return testo
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ÀÁÂÃÄÅ]/g, 'A')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ÌÍÎÏ]/g, 'I')
      .replace(/[ÒÓÔÕÖ]/g, 'O')
      .replace(/[ÙÚÛÜ]/g, 'U');
  }

  private greetingResponse(): string {
    const hour = new Date().getHours();
    let greeting = 'Ciao';
    if (hour < 12) greeting = 'Buongiorno';
    else if (hour < 18) greeting = 'Buon pomeriggio';
    else greeting = 'Buonasera';
    return `${greeting}! 👋 Come posso aiutarti? Digita "aiuto" per vedere cosa posso fare.`;
  }


  private helpResponse(): string {
    this.ultimoContesto = { intent: 'aiuto' };
    return (
      'Ecco tutto ciò che posso fare per te:\n\n' +
      '📦 **Box**\n' +
      '  "Quante box ho?" — numero totale di box\n' +
      '  "Box preferite?" — elenco delle tue box preferite\n' +
      '  "Box in transito?" — box in modalità moving\n' +
      '  "Cestino?" — box eliminate\n' +
      '  "Posizione box?" — ultima posizione GPS\n\n' +
      '📋 **Oggetti**\n' +
      '  "Quanti oggetti ho?" — totale articoli\n' +
      '  "Cerca [nome]" — cerca oggetto o box\n' +
      '  "Dove si trova [nome]?" — posizione esatta\n\n' +
      '🤝 **Condivisioni**\n' +
      '  "Condivisioni?" — chi condivide con te\n' +
      '  "Inviti?" — richieste in attesa\n\n' +
      '🏠 **Spazi**\n' +
      '  "Spazi?" — i tuoi armadi e archivi\n\n' +
      '📊 **Riepilogo**\n' +
      '  "Totali?" — statistiche complete del profilo\n\n' +
      '👤 **Profilo**\n' +
      '  "Profilo?" — info sul tuo account\n' +
      '  "Notifiche?" — gestione notifiche\n\n' +
      '✉️ **Messaggi**\n' +
      '  "Messaggi?" — centro messaggi e supporto\n\n' +
      '💬 **Altro**\n' +
      '  "Chi sei?" — info sull\'assistente\n' +
      '  "Tema?" — modalità scura\n' +
      '  "Come si fa...?" — guide rapide\n\n' +
      'Digita una delle domande per iniziare!'
    );
  }

  private messaggiResponse(): string {
    return '📬 **Centro Messaggi**\n\nPuoi trovare tutti i tuoi messaggi, le risposte rapide e il modulo di contatto supporto nella sezione "Messaggi" del tuo profilo.\n\nVai su Profilo → Messaggi per:\n- Leggere la posta in arrivo\n- Gestire messaggi importanti\n- Contattare il supporto\n- Usare le risposte rapide\n\nVuoi che ti dica di più?';
  }


  private estraiTermineRicerca(lower: string): string | null {
    const pattern = /(?:cerca|trova|dov'[eè]|dove\s+(?:si\s+)?trova|dov[ée]\s+|dov[ée]\s*[èe]\s*|che\s+cos'[eè]\s*|cos'[eè]\s+|dov[ée]\s+si\s+trova|trova\s+il\s+mio|dov[ée]\s+posso\s+trovare)(.+)/i;
    const match = lower.match(pattern);
    if (match && match[1].trim().length >= 2) {
      return match[1].trim();
    }
    if (lower.includes('posizione') || lower.includes('dove sta')) {
      const after = lower.replace(/posizione\s+(di\s+)?/, '').replace(/dove\s+sta\s+/, '').trim();
      if (after.length >= 2) return after;
    }
    return null;
  }


  private async boxResponse(utenteId: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.getBox(utenteId));
      const boxes = res?.box || [];
      const totale = boxes.length;
      const preferite = boxes.filter((b: any) => b.is_preferito).length;
      const inTransito = boxes.filter((b: any) => b.moving_mode).length;

      if (totale === 0) {
        return 'Non hai ancora creato nessuna box. Vai su "Crea Box" per iniziare!';
      }

      return (
        `Hai ${totale} box in totale.\n` +
        `⭐ ${preferite} preferite\n` +
        `🚚 ${inTransito} in transito\n` +
        `📁 ${totale - preferite - inTransito} standard\n\n` +
        'Per maggiori dettagli prova: "Box preferite?", "Box in transito?" o "Cestino?".'
      );
    } catch {
      return 'Errore nel recupero delle box. Riprova più tardi.';
    }
  }

  private async preferiteResponse(utenteId: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.getBox(utenteId));
      const preferite = (res?.box || []).filter((b: any) => b.is_preferito);

      if (preferite.length === 0) {
        return 'Non hai box preferite. Apri una box e clicca sulla stellina per aggiungerla ai preferiti.';
      }

      const nomi = preferite.map((b: any, i: number) => `${i + 1}. ${b.nome}`).join('\n');
      return `⭐ Box Preferite (${preferite.length})\n\n${nomi}`;
    } catch {
      return 'Errore nel recupero delle box preferite.';
    }
  }

  private async transitResponse(utenteId: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.getBox(utenteId));
      const inTransito = (res?.box || []).filter((b: any) => b.moving_mode);

      if (inTransito.length === 0) {
        return 'Nessuna box in transito al momento.';
      }

      const nomi = inTransito.map((b: any, i: number) => `${i + 1}. ${b.nome}`).join('\n');
      return `🚚 Box in Transito (${inTransito.length})\n\n${nomi}\n\nLe box in transito sono quelle che hai spostato o stai spostando da un luogo all'altro.`;
    } catch {
      return 'Errore nel recupero delle box in transito.';
    }
  }

  private async cestinoResponse(utenteId: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.getBoxEliminate(utenteId));
      const eliminate = res?.box_eliminate || [];

      if (eliminate.length === 0) {
        return 'Il cestino è vuoto. Nessuna box eliminata.';
      }

      const nomi = eliminate.map((b: any, i: number) => `${i + 1}. ${b.nome}`).join('\n');
      return `🗑️ Box Eliminate (${eliminate.length})\n\n${nomi}\n\nVerranno rimosse definitivamente dopo 30 giorni dall'eliminazione. Puoi ripristinarle dal cestino.`;
    } catch {
      return 'Errore nel recupero del cestino.';
    }
  }


  private async oggettiResponse(utenteId: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.getBox(utenteId));
      const boxes = res?.box || [];
      const totaleOggetti = boxes.reduce((sum: number, b: any) => sum + (b.num_oggetti || 0), 0);
      const boxConOggetti = boxes.filter((b: any) => (b.num_oggetti || 0) > 0).length;

      if (totaleOggetti === 0) {
        return 'Non hai ancora inserito oggetti nelle tue box. Aggiungili dalla sezione box!';
      }

      return (
        `Hai ${totaleOggetti} oggetti in totale.\n` +
        `Distribuiti in ${boxConOggetti} box su ${boxes.length}.\n` +
        `Media di ~${boxes.length > 0 ? Math.round(totaleOggetti / boxes.length) : 0} oggetti per box.\n\n` +
        'Per cercare un oggetto specifico, prova: "Cerca [nome oggetto]".'
      );
    } catch {
      return 'Errore nel conteggio degli oggetti.';
    }
  }


  private async condivisioniResponse(utenteId: string): Promise<string> {
    try {
      const [condRes, pendingRes, ricevuteRes]: any[] = await Promise.all([
        firstValueFrom(this.dbService.getArmadi(utenteId)),
        firstValueFrom(this.dbService.getCondivisioniPending(utenteId)),
        firstValueFrom(this.dbService.getArchividCondivisiConMe(utenteId)),
      ]);

      const armadi = condRes?.armadi || [];
      const mieiArmadi = armadi.filter((a: any) => a.ruolo_condivisione === null);
      const pending = pendingRes?.pending || 0;
      const ricevute = ricevuteRes?.archivi_condivisi || [];

      let lines = '🤝 Condivisioni\n\n';

      if (mieiArmadi.length === 0 && ricevute.length === 0 && pending === 0) {
        lines += 'Non hai ancora condiviso nulla. Condividi un archivio dalla sezione "Gestione Spazi".';
        return lines;
      }

      if (mieiArmadi.length > 0) {
        lines += `I tuoi archivi (${mieiArmadi.length}):\n`;
        for (const a of mieiArmadi) {
          lines += `  📁 ${a.nome}\n`;
        }
        lines += '\n';
      }

      if (ricevute.length > 0) {
        lines += `Archivi condivisi con te (${ricevute.length}):\n`;
        for (const r of ricevute) {
          lines += `  📂 ${r.nome} (${r.ruolo === 'editor' ? '✏️ modifica' : '👁️ solo lettura'})\n`;
        }
        lines += '\n';
      }

      if (pending > 0) {
        lines += `⏳ Hai ${pending} richiesta${pending > 1 ? 'e' : ''} di condivisione in attesa.\n\n`;
      }

      lines += 'Vai su "Gestione Spazi" per gestire le condivisioni.';
      return lines;
    } catch {
      return 'Errore nel recupero delle condivisioni.';
    }
  }


  private async spaziResponse(utenteId: string): Promise<string> {
    try {
      const [armadiRes, boxRes]: any[] = await Promise.all([
        firstValueFrom(this.dbService.getArmadi(utenteId)),
        firstValueFrom(this.dbService.getBox(utenteId)),
      ]);

      const armadi = armadiRes?.armadi || [];
      const boxes = boxRes?.box || [];

      if (armadi.length === 0) {
        return 'Non hai ancora creato spazi. Vai su "Gestione Spazi" per crearne uno.';
      }

      let lines = `🏠 I tuoi spazi (${armadi.length})\n\n`;
      for (const a of armadi) {
        const boxCount = boxes.filter((b: any) => String(b.rif_armadio) === String(a.id)).length;
        const proprietario = a.ruolo_condivisione ? ` (di ${a.proprietario_username})` : '';
        lines += `  ${a.nome}${proprietario} — ${boxCount} box\n`;
      }

      return lines;
    } catch {
      return 'Errore nel recupero degli spazi.';
    }
  }


  private async totaliResponse(utenteId: string): Promise<string> {
    try {
      const [boxRes, armadiRes]: any[] = await Promise.all([
        firstValueFrom(this.dbService.getBox(utenteId)),
        firstValueFrom(this.dbService.getArmadi(utenteId)),
      ]);

      const boxes = boxRes?.box || [];
      const armadi = armadiRes?.armadi || [];
      const totOggetti = boxes.reduce((sum: number, b: any) => sum + (b.num_oggetti || 0), 0);
      const preferite = boxes.filter((b: any) => b.is_preferito).length;
      const inTransito = boxes.filter((b: any) => b.moving_mode).length;

      if (boxes.length === 0 && armadi.length === 0) {
        return 'Il tuo profilo è ancora vuoto. Crea un armadio e aggiungi le tue box per iniziare!';
      }

      return (
        '📊 Riepilogo del tuo profilo\n\n' +
        `🏠 Spazi: ${armadi.length}\n` +
        `📦 Box totali: ${boxes.length}\n` +
        `⭐ Preferite: ${preferite}\n` +
        `🚚 In transito: ${inTransito}\n` +
        `📋 Oggetti totali: ${totOggetti}\n` +
        `📦 Media oggetti/box: ${boxes.length > 0 ? Math.round(totOggetti / boxes.length) : 0}`
      );
    } catch {
      return 'Errore nel recupero dei dati. Riprova più tardi.';
    }
  }


  private async cercaOggettiResponse(utenteId: string, termine: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.cercaOggetti(termine));
      const risultati: CercaRisultato[] = res?.risultati || [];

      if (risultati.length === 0) {
        const normalizzato = this.normalizzaTesto(termine);
        if (normalizzato !== termine) {
          const res2: any = await firstValueFrom(this.dbService.cercaOggetti(normalizzato));
          const risultati2: CercaRisultato[] = res2?.risultati || [];
          if (risultati2.length > 0) {
            return await this.formattaRisultatiRicerca(risultati2, termine, utenteId);
          }
        }
        return `Non ho trovato nulla per "${termine}".\n\nProva con un termine diverso o verifica di aver scritto correttamente il nome.`;
      }

      return await this.formattaRisultatiRicerca(risultati, termine, utenteId);
    } catch {
      return 'Errore durante la ricerca. Riprova più tardi.';
    }
  }

  private async formattaRisultatiRicerca(risultati: CercaRisultato[], termine: string, utenteId: string): Promise<string> {
    const oggetti = risultati.filter(r => r.tipo === 'oggetto');
    const boxes = risultati.filter(r => r.tipo === 'box');

    let lines = `Ho trovato ${risultati.length} risultato${risultati.length > 1 ? 'i' : ''} per "${termine}":\n\n`;

    if (oggetti.length > 0) {
      lines += `📋 Oggetti (${oggetti.length}):\n`;
      for (const o of oggetti) {
        lines += `  ${o.nome} — si trova in "${o.contesto}"\n`;
      }
      lines += '\n';
    }

    if (boxes.length > 0) {
      lines += `📦 Box (${boxes.length}):\n`;
      for (const b of boxes) {
        lines += `  ${b.nome} — archivio: "${b.contesto}"\n`;
      }
      lines += '\n';
    }

    lines += 'Per sapere dove si trova un oggetto nel dettaglio, scrivi: "Dove si trova [nome oggetto]?".';
    return lines;
  }

  private async doveSiTrovaOggettoResponse(utenteId: string, termine: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.cercaOggetti(termine));
      const risultati: CercaRisultato[] = res?.risultati || [];
      const oggetti = risultati.filter(r => r.tipo === 'oggetto');

      if (oggetti.length === 0) {
        const boxes = risultati.filter(r => r.tipo === 'box');
        if (boxes.length > 0) {
          return `"${termine}" corrisponde a una box, non a un oggetto.\n\nLa box "${boxes[0].nome}" si trova nell'archivio "${boxes[0].contesto}".\n\nPer cercare oggetti, usa: "Cerca [nome oggetto]".`;
        }

        // tentativo con normalizzazione
        const normalizzato = this.normalizzaTesto(termine);
        if (normalizzato !== termine) {
          return await this.doveSiTrovaOggettoResponse(utenteId, normalizzato);
        }

        return `Non ho trovato nessun oggetto chiamato "${termine}".\n\nProva con un termine diverso.`;
      }

      if (oggetti.length === 1) {
        const o = oggetti[0];
        return await this.dettaglioPosizioneOggetto(utenteId, o);
      }

      let lines = `Ho trovato ${oggetti.length} oggetti per "${termine}":\n\n`;
      for (const o of oggetti) {
        lines += `  ${o.nome} — si trova in "${o.contesto}"\n`;
      }
      lines += '\nSe vuoi più dettagli, specifica meglio il nome dell\'oggetto.';
      return lines;
    } catch {
      return 'Errore durante la ricerca. Riprova più tardi.';
    }
  }

  private async dettaglioPosizioneOggetto(utenteId: string, oggetto: CercaRisultato): Promise<string> {
    try {
      const boxRes: any = await firstValueFrom(this.dbService.getBox(utenteId));
      const boxes = boxRes?.box || [];
      const boxTrovata = boxes.find((b: any) => b.nome.toLowerCase() === oggetto.contesto.toLowerCase());

      if (!boxTrovata) {
        return `L'oggetto "${oggetto.nome}" si trova nella box "${oggetto.contesto}".`;
      }

      let risposta = `📍 **${oggetto.nome}** si trova:\n\n`;

      try {
        const singolaRes: any = await firstValueFrom(this.dbService.getBoxSingola(boxTrovata.id));
        const dettagli = singolaRes?.box;
        if (dettagli) {
          risposta += `📦 Box: **${dettagli.nome}**\n`;
          risposta += `🏠 Archivio: **${dettagli.nome_armadio}**\n`;
        }
      } catch {
        risposta += `📦 Box: **${oggetto.contesto}**\n`;
      }

      try {
        const cpRes: any = await firstValueFrom(this.dbService.getUltimoCheckpoint(boxTrovata.id));
        if (cpRes && cpRes.latitudine) {
          const lat = cpRes.latitudine;
          const lng = cpRes.longitudine;
          const label = cpRes.label || '';
          risposta += `📍 Posizione: ${lat}, ${lng}${label ? ` (${label})` : ''}\n`;
          risposta += `🕐 Ultimo aggiornamento: ${cpRes.timestamp ? new Date(cpRes.timestamp).toLocaleString('it-IT') : 'N/D'}`;
        } else {
          risposta += `📍 Nessuna posizione GPS registrata per questa box.`;
        }
      } catch {
        risposta += `📍 Nessuna posizione GPS registrata per questa box.`;
      }

      return risposta;
    } catch {
      return `L'oggetto "${oggetto.nome}" si trova nella box "${oggetto.contesto}".`;
    }
  }


  private async posizioneBoxResponse(utenteId: string): Promise<string> {
    try {
      const cpRes: any = await firstValueFrom(this.dbService.getTuttiCheckpoint(utenteId));
      const checkpoints = cpRes?.checkpoints || [];

      if (checkpoints.length === 0) {
        return 'Nessuna posizione GPS registrata. Scansiona il QR code di una box per registrarne la posizione.';
      }

      const perBox = new Map<string, any>();
      for (const cp of checkpoints) {
        if (!perBox.has(cp.box_nome) || new Date(cp.timestamp) > new Date(perBox.get(cp.box_nome).timestamp)) {
          perBox.set(cp.box_nome, cp);
        }
      }

      let lines = `📍 Ultime posizioni (${perBox.size} box)\n\n`;
      let idx = 1;
      for (const [nome, cp] of perBox) {
        const label = cp.label ? ` (${cp.label})` : '';
        lines += `${idx}. **${nome}**\n   Archivio: ${cp.armadio_nome}\n   Posizione: ${cp.latitudine}, ${cp.longitudine}${label}\n\n`;
        idx++;
      }

      return lines.trim();
    } catch {
      return 'Errore nel recupero delle posizioni. Riprova più tardi.';
    }
  }
}
