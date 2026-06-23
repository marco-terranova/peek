import { Injectable } from '@angular/core';
import { DatabaseService } from './database';
import { firstValueFrom } from 'rxjs';

interface CercaRisultato {
  id: number;
  nome: string;
  tipo: 'box' | 'oggetto';
  contesto: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotEngineService {

  constructor(private dbService: DatabaseService) {}

  // ─── PUBLIC API ─────────────────────────────────────────

  async processMessage(msg: string): Promise<string> {
    const lower = msg.toLowerCase().trim();
    const utenteId = localStorage.getItem('utente_id');

    if (!utenteId) {
      return 'Sembra che tu non abbia effettuato l\'accesso. Accedi per usare l\'assistente.';
    }

    if (lower === 'aiuto' || lower === 'help' || lower === 'cosa sai fare' || lower === 'comandi' || lower === 'cosa puoi fare' || lower === 'comando' || lower === 'funzioni' || lower === 'help!') {
      return this.helpResponse();
    }

    if (lower.includes('ciao') || lower.includes('salve') || lower.includes('buongiorn') || lower.includes('buonasera') || lower.includes('buona sera') || lower.includes('hey') || lower.includes('ehi') || lower === 'ciao' || lower === 'salve') {
      const hour = new Date().getHours();
      let greeting = 'Ciao';
      if (hour < 12) greeting = 'Buongiorno';
      else if (hour < 18) greeting = 'Buon pomeriggio';
      else greeting = 'Buonasera';
      return `${greeting}! 👋 Come posso aiutarti? Digita "aiuto" per vedere cosa posso fare.`;
    }

    if (lower.includes('grazie') || lower.includes('grazie mille') || lower.includes('ti ringrazio') || lower.includes('grazie tante') || lower.includes('thanks') || lower.includes('thank')) {
      return 'Prego! 😊 Sono qui per aiutarti. Se hai altre domande, chiedi pure!';
    }

    if (lower.includes('come stai') || lower.includes('come va') || lower.includes('tutto bene') || lower.includes('come butta')) {
      return 'Tutto bene, grazie! 🚀 Pronto ad aiutarti con le tue box e i tuoi oggetti. Tu come stai?';
    }

    if (lower.includes('chi sei') || lower.includes('chi ti ha creato') || lower.includes('che sei')) {
      return 'Sono l\'assistente virtuale di PeekBox 🤖\n\nSono stato creato per aiutarti a gestire il tuo profilo, le tue box, i tuoi oggetti e molto altro. Sono sempre qui quando hai bisogno!';
    }

    if (lower.includes('messaggi') || lower.includes('centro messaggi') || lower.includes('supporto') || lower.includes('contatta') || lower.includes('assistenza') || lower.includes('aiut') && lower.includes('contatt')) {
      return '📬 **Centro Messaggi**\n\nPuoi trovare tutti i tuoi messaggi, le risposte rapide e il modulo di contatto supporto nella sezione "Messaggi" del tuo profilo.\n\nVai su Profilo → Messaggi per:\n- Leggere la posta in arrivo\n- Gestire messaggi importanti\n- Contattare il supporto\n- Usare le risposte rapide\n\nVuoi che ti dica di più?';
    }

    const cercaMatch = this.estraiTermineRicerca(lower);
    if (cercaMatch) {
      if (lower.includes('dov') || lower.includes('posizione') || lower.includes('dove sta')) {
        return await this.doveSiTrovaOggettoResponse(utenteId, cercaMatch);
      }
      return await this.cercaOggettiResponse(utenteId, cercaMatch);
    }

    if (lower.includes('cestin') || lower.includes('eliminat') || lower.includes('cancell') || lower.includes('cestino') || lower.includes('cancellat')) {
      return await this.cestinoResponse(utenteId);
    }

    if (lower.includes('preferit') || lower.includes('preferite') || lower.includes('preferiti') || lower.includes('preferito')) {
      return await this.preferiteResponse(utenteId);
    }

    if (lower.includes('transit') || lower.includes('moving') || lower.includes('in moviment') || lower.includes('spostament')) {
      return await this.transitResponse(utenteId);
    }

    if ((lower.includes('box') || lower.includes('scatol')) && (lower.includes('quant') || lower.includes('conta') || lower.includes('total') || lower.includes('ho') || lower === 'box')) {
      return await this.boxResponse(utenteId);
    }

    if (lower.includes('oggett') || lower.includes('articol') || lower.includes('cose che ho') || lower.includes('quanti') || (lower.includes('quanti') && !lower.includes('box'))) {
      return await this.oggettiResponse(utenteId);
    }

    if (lower.includes('condivis') || lower.includes('condivid') || lower.includes('con chi') || lower.includes('condivision') || lower.includes('in comune')) {
      return await this.condivisioniResponse(utenteId);
    }

    if (lower.includes('spazi') || lower.includes('armadi') || lower.includes('archivi') || lower.includes('luoghi') || lower.includes('dove tengo') || lower.includes('miei spazi') || lower.includes('miei armadi') || lower.includes('miei archivi')) {
      return await this.spaziResponse(utenteId);
    }

    if (lower.includes('profilo') || lower.includes('account') || lower.includes('miei dati') || lower.includes('informazioni')) {
      return '👤 **Il tuo profilo**\n\nNella sezione Profilo puoi:\n- Modificare nome, email e password\n- Cambiare foto profilo\n- Regolare le notifiche\n- Vedere i tuoi messaggi\n- Gestire le condivisioni\n- Monitorare lo spazio utilizzato\n\nVai su Profilo per gestire tutto!';
    }

    if (lower.includes('notific') || lower.includes('notifica') || lower.includes('alert') || lower.includes('avvis')) {
      return '🔔 **Notifiche**\n\nPuoi gestire le tue notifiche dalla pagina "Informazioni Account" nel tuo profilo. Lì puoi scegliere quali notifiche ricevere.\n\nAl momento sono disponibili notifiche per:\n- Movimenti delle box\n- Condivisioni\n- Messaggi dal supporto\n- Promemoria';
    }

    if (lower.includes('nome') && (lower.includes('mio') || lower.includes('utente') || lower.includes('username') || lower.includes('visualizz')) || lower === 'nome' || lower === 'nome utente') {
      return await this.nomeUtenteResponse(utenteId);
    }

    if (lower.includes('buio') || lower.includes('tema') || lower.includes('dark') || lower.includes('modalit') || lower.includes('scur') || lower.includes('tema scuro') || lower.includes('dark mode')) {
      return '🎨 **Tema**\n\nPeekBox supporta la modalità scura! Puoi attivarla dalle impostazioni del tuo dispositivo o dall\'app. Il tema scuro riduce l\'affaticamento degli occhi e consuma meno batteria sui display OLED.';
    }

    if (lower.includes('totali') || lower.includes('riepilog') || lower.includes('stat') || lower.includes('dashboard') || lower.includes('sommario') || lower.includes('riassunto') || lower.includes('numeri')) {
      return await this.totaliResponse(utenteId);
    }

    if (lower.includes('posizion') || lower.includes('checkpoint') || (lower.includes('ultim') && lower.includes('box'))) {
      return await this.posizioneBoxResponse(utenteId);
    }

    if (lower.includes('recuper') || lower.includes('ripristin') || lower.includes('tornare') || (lower.includes('box') && lower.includes('eliminate'))) {
      return '🗑️ **Box eliminate**\n\nLe box eliminate vengono conservate nel cestino per 30 giorni prima della rimozione definitiva.\n\nPer visualizzarle: "Cestino?"\n\nSe vuoi ripristinare una box, vai nella sezione "Cestino" dal menu principale e clicca sul pulsante di ripristino.';
    }

    if (lower === 'box' || (lower.includes('box') && !lower.includes('quant') && !lower.includes('preferit'))) {
      return await this.boxResponse(utenteId);
    }

    return (
      'Non ho capito la tua richiesta.\n\n' +
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

  suggerisciDomande(msg: string, risposta: string): string[] {
    const lower = msg.toLowerCase().trim();

    if (risposta.includes('Non ho capito') || risposta.includes('non autenticato')) {
      return ['Aiuto', 'Quante box ho?', 'Totali', 'Messaggi?'];
    }

    if (risposta.includes('grazie') || risposta.includes('Prego')) {
      return ['Quante box ho?', 'Totali?', 'Aiuto'];
    }

    if (risposta.includes('come stai') || risposta.includes('come va')) {
      return ['Quante box ho?', 'Aiuto', 'Messaggi?'];
    }

    if (risposta.includes('assistente virtuale') || risposta.includes('chi sei')) {
      return ['Quante box ho?', 'Aiuto', 'Totali?'];
    }

    if (risposta.includes('Messaggi') || risposta.includes('supporto')) {
      return ['Quante box ho?', 'Spazi?', 'Totali?', 'Aiuto'];
    }

    if (risposta.includes('profilo') || risposta.includes('Informazioni')) {
      return ['Quante box ho?', 'Notifiche?', 'Aiuto'];
    }

    if (risposta.includes('Notifiche')) {
      return ['Profilo?', 'Quante box ho?', 'Totali?'];
    }

    if (risposta.includes('Tema') || risposta.includes('modalità scura')) {
      return ['Quante box ho?', 'Profilo?', 'Aiuto'];
    }

    if (lower === 'aiuto' || lower === 'help' || lower === 'cosa sai fare' || lower === 'comandi') {
      return ['Quante box ho?', 'Quanti oggetti ho?', 'Condivisioni?', 'Messaggi?'];
    }

    if (lower.includes('ciao') || lower.includes('salve') || lower.includes('buongiorn') || lower.includes('buonasera') || lower.includes('hey') || lower === 'ciao') {
      return ['Quante box ho?', 'Aiuto', 'Messaggi?'];
    }

    if (lower.includes('grazie')) {
      return ['Quante box ho?', 'Spazi?', 'Totali?'];
    }

    if (lower.includes('cestin') || lower.includes('eliminat') || lower.includes('cancell')) {
      return ['Quante box ho?', 'Box preferite?', 'Recuperare box?'];
    }

    if (lower.includes('preferit')) {
      return ['Quante box ho?', 'Box in transito?', 'Totali?'];
    }

    if (lower.includes('transit') || lower.includes('moving') || lower.includes('spostament')) {
      return ['Quante box ho?', 'Box preferite?', 'Cestino?'];
    }

    if (lower.includes('condivis')) {
      return ['Spazi?', 'Totali?', 'Quante box ho?'];
    }

    if (lower.includes('spazi') || lower.includes('armadi') || lower.includes('archivi') || lower.includes('luoghi')) {
      return ['Quante box ho?', 'Totali?', 'Condivisioni?'];
    }

    if (lower.includes('totali') || lower.includes('riepilog') || lower.includes('stat') || lower.includes('riassunto') || lower.includes('sommario') || lower.includes('dashboard')) {
      return ['Quante box ho?', 'Spazi?', 'Condivisioni?', 'Profilo?'];
    }

    if (lower.includes('dov') || lower.includes('posizion') || lower.includes('checkpoint') || lower.includes('gps')) {
      return ['Quante box ho?', 'Totali?', 'Box in transito?'];
    }

    if (lower.includes('cerca') || lower.includes('trova') || lower.includes('dove trovo')) {
      return ['Dove si trova?', 'Totali?', 'Aiuto', 'Messaggi?'];
    }

    if (lower.includes('box') || lower.includes('scatol')) {
      return ['Box preferite?', 'Box in transito?', 'Cestino?', 'Totali?'];
    }

    if (lower.includes('oggett') || lower.includes('articol')) {
      return ['Cerca un oggetto', 'Quante box ho?', 'Totali?', 'Aiuto'];
    }

    if (lower.includes('messaggi') || lower.includes('supporto') || lower.includes('assistenza')) {
      return ['Quante box ho?', 'Spazi?', 'Aiuto'];
    }

    if (lower.includes('profilo') || lower.includes('account')) {
      return ['Quante box ho?', 'Notifiche?', 'Aiuto'];
    }

    if (lower.includes('notific') || lower.includes('notifica')) {
      return ['Profilo?', 'Quante box ho?', 'Aiuto'];
    }

    if (lower.includes('nome') && (lower.includes('mio') || lower.includes('utente'))) {
      return ['Quante box ho?', 'Profilo?', 'Totali?'];
    }

    return ['Aiuto', 'Quante box ho?', 'Totali?', 'Messaggi?'];
  }

  // ─── HELP ─────────────────────────────────────────────────

  private helpResponse(): string {
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
      '  "Cerca [nome]?" — cerca oggetto o box\n' +
      '  "Dove si trova [oggetto]?" — posizione esatta\n\n' +
      '🤝 **Condivisioni**\n' +
      '  "Condivisioni?" — chi condivide con te\n\n' +
      '🏠 **Spazi**\n' +
      '  "Spazi?" — i tuoi armadi e archivi\n\n' +
      '📊 **Riepilogo**\n' +
      '  "Totali?" — statistiche complete del profilo\n\n' +
      '👤 **Profilo**\n' +
      '  "Profilo?" — info sul tuo account\n' +
      '  "Nome?" — il tuo nome utente\n' +
      '  "Notifiche?" — gestione notifiche\n\n' +
      '✉️ **Messaggi**\n' +
      '  "Messaggi?" — centro messaggi e supporto\n\n' +
      '💬 **Altro**\n' +
      '  "Chi sei?" — info sull\'assistente\n' +
      '  "Tema?" — modalità scura\n\n' +
      'Digita una delle domande per iniziare!'
    );
  }

  // ─── INTENT PARSING ──────────────────────────────────────

  private estraiTermineRicerca(lower: string): string | null {
    const pattern = /(?:cerca|trova|dov'[eè]|dove\s+(?:si\s+)?trova|dov[ée]\s+|dov[ée]\s*[èe]\s*|che\s+cos'[eè]\s*|cos'[eè]\s+)(.+)/i;
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

  // ─── BOX ──────────────────────────────────────────────────

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
        'Per maggiori dettagli prova: "box preferite", "box in transito" o "cestino".'
      );
    } catch {
      return 'Errore nel recupero delle box. Riprova piu tardi.';
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
        return 'Il cestino e vuoto. Nessuna box eliminata.';
      }

      const nomi = eliminate.map((b: any, i: number) => `${i + 1}. ${b.nome}`).join('\n');
      return `🗑️ Box Eliminate (${eliminate.length})\n\n${nomi}\n\nVerranno rimosse definitivamente dopo 30 giorni dall'eliminazione.`;
    } catch {
      return 'Errore nel recupero del cestino.';
    }
  }

  // ─── OGGETTI ──────────────────────────────────────────────

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

  // ─── CONDIVISIONI ─────────────────────────────────────────

  private async condivisioniResponse(utenteId: string): Promise<string> {
    try {
      const [condRes, pendingRes, ricevuteRes]: any[] = await Promise.all([
        firstValueFrom(this.dbService.getArmadi(utenteId)),
        firstValueFrom(this.dbService.getCondivisioniPending(utenteId)),
        firstValueFrom(this.dbService.getArchividCondivisiConMe(utenteId)),
      ]);

      const armadi = condRes?.armadi || [];
      const condivisiDaMe = armadi.filter((a: any) => a.ruolo_condivisione === null);
      const pending = pendingRes?.pending || 0;
      const ricevute = ricevuteRes?.archivi_condivisi || [];

      let lines = '🤝 Condivisioni\n\n';

      if (condivisiDaMe.length === 0 && ricevute.length === 0 && pending === 0) {
        lines += 'Non hai ancora condiviso nulla. Condividi un archivio dalla sezione "Gestione Spazi".';
        return lines;
      }

      if (condivisiDaMe.length > 0) {
        lines += `I tuoi archivi:\n`;
        for (const a of condivisiDaMe) {
          lines += `  ${a.nome}\n`;
        }
        lines += '\n';
      }

      if (ricevute.length > 0) {
        lines += `Archivi condivisi con te:\n`;
        for (const r of ricevute) {
          lines += `  ${r.nome} (${r.ruolo === 'editor' ? 'modifica' : 'solo lettura'})\n`;
        }
        lines += '\n';
      }

      if (pending > 0) {
        lines += `Hai ${pending} richiesta${pending > 1 ? 'e' : ''} di condivisione in attesa.\n\n`;
      }

      lines += 'Vai su "Gestione Spazi" per gestire le condivisioni.';
      return lines;
    } catch {
      return 'Errore nel recupero delle condivisioni.';
    }
  }

  // ─── SPAZI ────────────────────────────────────────────────

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

  // ─── TOTALI ──────────────────────────────────────────────

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
        return 'Il tuo profilo e ancora vuoto. Crea un armadio e aggiungi le tue box per iniziare!';
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
      return 'Errore nel recupero dei dati. Riprova piu tardi.';
    }
  }

  // ─── NOME UTENTE ────────────────────────────────────────

  private async nomeUtenteResponse(utenteId: string): Promise<string> {
    const nome = localStorage.getItem('utente_nome') || '';
    const email = localStorage.getItem('utente_email') || '';

    if (nome || email) {
      let reply = `👤 Ecco le tue info:\n\n`;
      if (nome) reply += `Nome: ${nome}\n`;
      if (email) reply += `Email: ${email}\n`;
      reply += '\nPuoi modificare questi dati dalla sezione "Informazioni Account" nel tuo profilo.';
      return reply;
    }

    return 'Non ho trovato informazioni sul tuo profilo. Prova a visitare la pagina "Informazioni Account".';
  }

  // ─── CERCA OGGETTI ───────────────────────────────────────

  private async cercaOggettiResponse(utenteId: string, termine: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.cercaOggetti(termine));
      const risultati: CercaRisultato[] = res?.risultati || [];

      if (risultati.length === 0) {
        return `Non ho trovato nulla per "${termine}".\n\nProva con un termine diverso o verifica di aver scritto correttamente il nome.`;
      }

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
    } catch {
      return 'Errore durante la ricerca. Riprova piu tardi.';
    }
  }

  private async doveSiTrovaOggettoResponse(utenteId: string, termine: string): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.dbService.cercaOggetti(termine));
      const risultati: CercaRisultato[] = res?.risultati || [];
      const oggetti = risultati.filter(r => r.tipo === 'oggetto');

      if (oggetti.length === 0) {
        const boxes = risultati.filter(r => r.tipo === 'box');
        if (boxes.length > 0) {
          return `"${termine}" corrisponde a ${boxes.length > 0 ? 'una' : ''} box, non a un oggetto.\n\nLa box "${boxes[0].nome}" si trova nell'archivio "${boxes[0].contesto}".\n\nPer cercare oggetti, usa: "Cerca [nome oggetto]".`;
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
      lines += '\nSe vuoi piu dettagli, specifica meglio il nome dell\'oggetto.';
      return lines;
    } catch {
      return 'Errore durante la ricerca. Riprova piu tardi.';
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

      let risposta = `L'oggetto "${oggetto.nome}" si trova:\n\n`;

      try {
        const singolaRes: any = await firstValueFrom(this.dbService.getBoxSingola(boxTrovata.id));
        const dettagli = singolaRes?.box;
        if (dettagli) {
          risposta += `📦 Box: ${dettagli.nome}\n`;
          risposta += `🏠 Archivio: ${dettagli.nome_armadio}\n`;
        }
      } catch {
        risposta += `📦 Box: ${oggetto.contesto}\n`;
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

  // ─── POSIZIONE BOX ───────────────────────────────────────

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
        lines += `${idx}. ${nome}\n   Archivio: ${cp.armadio_nome}\n   Posizione: ${cp.latitudine}, ${cp.longitudine}${label}\n\n`;
        idx++;
      }

      return lines.trim();
    } catch {
      return 'Errore nel recupero delle posizioni. Riprova piu tardi.';
    }
  }
}
