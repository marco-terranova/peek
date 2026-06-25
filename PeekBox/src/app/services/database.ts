import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

function port(): string {
  return environment.backendPort ? `:${environment.backendPort}` : '';
}

import {
  LoginResponse, PendingResponse,
  BoxListResponse, BoxEliminateResponse,
  Oggetto, ArchivioCondivisiResponse,
  CondivisioniInAttesaResponse, OggettiBoxCondivisaResponse
} from '../../types/models';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private get apiUrl(): string {
    return `${window.location.protocol}//${window.location.hostname}${port()}/api`;
  }

  constructor(private http: HttpClient) { }


  registraUtente(username: string, email: string, pass: string, tipo_profilo: 'personal' | 'business' = 'personal') {
    return this.http.post(`${this.apiUrl}/registrazione`, {
      username, email, password: pass, tipo_profilo
    });
  }

  loginUtente(email: string, pass: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password: pass });
  }

  aggiornaProfiloUtente(utenteId: string, dati: { nome?: string; cognome?: string; email?: string }) {
    return this.http.put(
      `${this.apiUrl}/utenti/${utenteId}`,
      dati
    );
  }

  aggiornaPassword(utenteId: string, vecchia_password: string, nuova_password: string) {
    return this.http.put(
      `${this.apiUrl}/utenti/${utenteId}/password`,
      { vecchia_password, nuova_password }
    );
  }


  getArmadi(utenteId: string) {
    return this.http.get(`${this.apiUrl}/armadi/${utenteId}`);
  }

  creaArmadio(nome: string, utenteId: string) {
    return this.http.post(`${this.apiUrl}/armadi`, { nome, rif_utente: utenteId });
  }

  aggiornaArmadio(id: number, nome: string) {
    return this.http.put(`${this.apiUrl}/armadi/${id}`, { nome });
  }

  eliminaArmadio(id: number) {
    return this.http.delete(`${this.apiUrl}/armadi/${id}`);
  }

  getBoxOrfane(utenteId: string) {
    return this.http.get(`${this.apiUrl}/box/orfane/${utenteId}`);
  }

  riallocaBox(boxId: number, rif_armadio: number) {
    return this.http.put(`${this.apiUrl}/box/${boxId}/rialloca`, { rif_armadio });
  }


  getBoxSingola(id: number) {
    return this.http.get(`${this.apiUrl}/box/singola/${id}`);
  }

  getBox(utenteId: string) {
    return this.http.get<BoxListResponse>(`${this.apiUrl}/box/${utenteId}`);
  }

  creaBox(nome: string, rif_armadio: string, is_preferito: boolean, moving_mode: boolean = false, descrizione: string = '', dimensione: string = 'piccola') {
    return this.http.post(`${this.apiUrl}/box`, { nome, descrizione: descrizione || null, rif_armadio, is_preferito, moving_mode, dimensione });
  }

  updatePreferito(id: number, is_preferito: boolean) {
    return this.http.put(`${this.apiUrl}/box/preferito/${id}`, { is_preferito });
  }

  eliminaBox(id: number) {
    return this.http.delete(`${this.apiUrl}/box/${id}`);
  }

  eliminaBoxDefinitivo(id: number) {
    return this.http.delete(`${this.apiUrl}/box/${id}/definitivo`);
  }

  ripristinaBox(id: number) {
    return this.http.put(`${this.apiUrl}/box/${id}/ripristina`, {});
  }

  getBoxEliminate(utenteId: string) {
    return this.http.get<BoxEliminateResponse>(`${this.apiUrl}/box/eliminate/${utenteId}`);
  }


  salvaCheckpoint(rif_box: number, latitudine: number, longitudine: number, accuratezza?: number, label?: string) {
    return this.http.post(`${this.apiUrl}/checkpoint`, {
      rif_box, latitudine, longitudine, accuratezza, label
    });
  }

  getCheckpoints(boxId: number) {
    return this.http.get(`${this.apiUrl}/checkpoint/${boxId}`);
  }

  getUltimoCheckpoint(boxId: number) {
    return this.http.get(`${this.apiUrl}/checkpoint/${boxId}/ultimo`);
  }

  getTuttiCheckpoint(utenteId: string) {
    return this.http.get(`${this.apiUrl}/checkpoint/tutti/${utenteId}`);
  }

  getTuttiCheckpointAttivi(utenteId: string) {
    return this.http.get(`${this.apiUrl}/checkpoint/tutti-attivi/${utenteId}`);
  }

  getQrToken(boxId: number) {
    return this.http.get(`${this.apiUrl}/box/${boxId}/qr-token`);
  }

  buildQrUrl(boxId: number, token: string): string {
    const base = `${window.location.protocol}//${window.location.hostname}${port()}`;
    return `${base}/scan?box=${boxId}&t=${token}`;
  }



  getOggettiPerBox(boxId: number) {
    return this.http.get(`${this.apiUrl}/oggetti/${boxId}`);
  }

  creaOggetto(dati: Oggetto) {
    return this.http.post(`${this.apiUrl}/oggetti`, dati);
  }

  aggiornaOggetto(id: number, dati: Partial<Oggetto>) {
    return this.http.put(`${this.apiUrl}/oggetti/${id}`, dati);
  }

  eliminaOggetto(id: number) {
    return this.http.delete(`${this.apiUrl}/oggetti/${id}`);
  }

  getOggettiEliminati(utenteId: string) {
    return this.http.get(`${this.apiUrl}/oggetti/eliminate/${utenteId}`);
  }

  ripristinaOggetto(id: number) {
    return this.http.put(`${this.apiUrl}/oggetti/${id}/ripristina`, {});
  }

  eliminaOggettoDefinitivo(id: number) {
    return this.http.delete(`${this.apiUrl}/oggetti/${id}/definitivo`);
  }

  svuotaBox(boxId: number) {
    return this.http.delete(`${this.apiUrl}/box/${boxId}/oggetti`);
  }


  getCategorie() {
    return this.http.get(`${this.apiUrl}/categorie`);
  }

  creaCategoria(nome: string) {
    return this.http.post(`${this.apiUrl}/categorie`, { nome });
  }

  eliminaCategoria(id: number) {
    return this.http.delete(`${this.apiUrl}/categorie/${id}`);
  }



  spostaOggetto(idOgg: number, boxDestinazioneId: number) {
    const id   = Number(idOgg);
    const dest = Number(boxDestinazioneId);
    if (!id || isNaN(id) || id <= 0) throw new Error('ID oggetto non valido');
    if (!dest || isNaN(dest) || dest <= 0) throw new Error('ID box destinazione non valido');
    return this.http.put(
      `${this.apiUrl}/oggetti/sposta`,
      { oggetti_ids: [id], box_destinazione_id: dest }
    );
  }


  cercaOggetti(termine: string) {
    return this.http.get(
      `${this.apiUrl}/cerca?q=${encodeURIComponent(termine)}`
    );
  }


  condividiArchivio(box_id: number, email_ospite: string, ruolo: 'viewer' | 'editor') {
    return this.http.post(`${this.apiUrl}/condivisioni`,
      { rif_box: box_id, email_ospite, ruolo });
  }

  getCondivisioniArchivio(boxId: number) {
    return this.http.get(`${this.apiUrl}/condivisioni/${boxId}`);
  }

  getCategorieOggetti(utenteId: string) {
    return this.http.get<any>(`${this.apiUrl}/oggetti/categorie/${utenteId}`);
  }

  getArchividCondivisiConMe(utenteId: string) {
    return this.http.get<ArchivioCondivisiResponse>(
      `${this.apiUrl}/condivisioni/ricevute/${utenteId}`);
  }

  revocaCondivisione(condivisioneId: number) {
    return this.http.delete(`${this.apiUrl}/condivisioni/${condivisioneId}`);
  }

  aggiornaRuoloCondivisione(condivisioneId: number, ruolo: 'viewer' | 'editor') {
    return this.http.put(`${this.apiUrl}/condivisioni/${condivisioneId}/ruolo`,
      { ruolo });
  }

  getCondivisioniPending(utenteId: string) {
    return this.http.get<PendingResponse>(
      `${this.apiUrl}/condivisioni/pending/${utenteId}`);
  }

  getCondivisioniInAttesa(utenteId: string) {
    return this.http.get<CondivisioniInAttesaResponse>(
      `${this.apiUrl}/condivisioni/in-attesa/${utenteId}`);
  }

  accettaCondivisione(condivisioneId: number) {
    return this.http.put(
      `${this.apiUrl}/condivisioni/${condivisioneId}/accetta`,
      {});
  }

  rifiutaCondivisione(condivisioneId: number) {
    return this.http.put(
      `${this.apiUrl}/condivisioni/${condivisioneId}/rifiuta`,
      {});
  }


  impostaGeofence(armadio_id: number, latitudine: number, longitudine: number, raggio_m: number = 100, attivo: boolean = true) {
    return this.http.post(`${this.apiUrl}/geofence`,
      { armadio_id, latitudine, longitudine, raggio_m, attivo });
  }

  getGeofence(armadioId: number) {
    return this.http.get(`${this.apiUrl}/geofence/${armadioId}`);
  }

  eliminaGeofence(armadioId: number) {
    return this.http.delete(`${this.apiUrl}/geofence/${armadioId}`);
  }

  verificaGeofence(armadio_id: number, latitudine: number, longitudine: number) {
    return this.http.post(`${this.apiUrl}/geofence/verifica`,
      { armadio_id, latitudine, longitudine });
  }

  getNotificheGeofence() {
    return this.http.get(`${this.apiUrl}/geofence/notifiche`);
  }

  segnaNotificaComeLetta(id: number) {
    return this.http.patch(`${this.apiUrl}/geofence/notifiche/${id}/letta`,
      {});
  }

  eliminaNotificaGeofence(id: number) {
    return this.http.delete(`${this.apiUrl}/geofence/notifiche/${id}`);
  }

  getGeofenceCheckpoints(armadioId: number) {
    return this.http.get(`${this.apiUrl}/geofence/${armadioId}/checkpoints`);
  }


  impostaGeofenceCheckpoint(checkpoint_id: number, latitudine: number, longitudine: number, raggio_m: number = 100, attivo: boolean = true) {
    return this.http.post(`${this.apiUrl}/geofence-checkpoint`, { checkpoint_id, latitudine, longitudine, raggio_m, attivo });
  }

  getGeofenceCheckpointSingolo(checkpointId: number) {
    return this.http.get(`${this.apiUrl}/geofence-checkpoint/${checkpointId}`);
  }

  getGeofenceCheckpointUtente(utenteId: string) {
    return this.http.get(`${this.apiUrl}/geofence-checkpoint/utente/${utenteId}`);
  }


  getMessaggi(utenteId: string) {
    return this.http.get<{ messaggi: any[] }>(`${this.apiUrl}/messaggi`);
  }

  getMessaggiNonLetto() {
    return this.http.get<{ count: number }>(`${this.apiUrl}/messaggi/non-letto`);
  }

  segnaMessaggioLetto(id: number) {
    return this.http.patch(`${this.apiUrl}/messaggi/${id}/letta`, {});
  }

  toggleMessaggioImportante(id: number) {
    return this.http.patch(`${this.apiUrl}/messaggi/${id}/importante`, {});
  }

  eliminaMessaggio(id: number) {
    return this.http.delete(`${this.apiUrl}/messaggi/${id}`);
  }

  inviaMessaggio(data: { tipo: string; oggetto: string; corpo: string }) {
    return this.http.post(`${this.apiUrl}/messaggi`, data);
  }

  inviaSegnalazione(data: { tipo: 'feedback' | 'report' | 'suggerimento'; titolo: string; descrizione?: string; priorita?: 'bassa' | 'media' | 'alta' }) {
    return this.http.post(`${this.apiUrl}/segnalazioni`, data);
  }


  adminGetUtenti() {
    return this.http.get(`${this.apiUrl}/admin/utenti`);
  }

  adminEliminaUtente(id: number) {
    return this.http.delete(`${this.apiUrl}/admin/utenti/${id}`);
  }

  adminGetStats() {
    return this.http.get(`${this.apiUrl}/admin/stats`);
  }

  adminToggleUserAdmin(id: number, is_admin: number) {
    return this.http.put(`${this.apiUrl}/admin/utenti/${id}/admin`, { is_admin });
  }

  adminGetUserDetail(id: number) {
    return this.http.get(`${this.apiUrl}/admin/utenti/${id}/dettaglio`);
  }

  adminGetSegnalazioni() {
    return this.http.get(`${this.apiUrl}/admin/segnalazioni`);
  }

  adminUpdateSegnalazioneStatus(id: number, stato: string) {
    return this.http.patch(`${this.apiUrl}/admin/segnalazioni/${id}/stato`, { stato });
  }

  adminEliminaSegnalazione(id: number) {
    return this.http.delete(`${this.apiUrl}/admin/segnalazioni/${id}`);
  }

  adminRispondiSegnalazione(id: number, risposta: string) {
    return this.http.post(`${this.apiUrl}/admin/segnalazioni/${id}/rispondi`, { risposta });
  }
}
