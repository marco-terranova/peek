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

  // ─── AUTENTICAZIONE ───────────────────────────────────────

  registraUtente(username: string, email: string, pass: string, tipo_profilo: 'personal' | 'business' = 'personal') {
    return this.http.post(`${this.apiUrl}/registrazione`, {
      username, email, password: pass, tipo_profilo
    });
  }

  loginUtente(email: string, pass: string) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password: pass });
  }

  aggiornaTipoProfilo(utenteId: string, tipo_profilo: 'personal' | 'business') {
    return this.http.put(`${this.apiUrl}/utenti/${utenteId}/profilo`,
      { tipo_profilo });
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

  // ─── ARMADI ───────────────────────────────────────────────

  getArmadi(utenteId: string) {
    return this.http.get(`${this.apiUrl}/armadi/${utenteId}`);
  }

  creaArmadio(nome: string, utenteId: string) {
    return this.http.post(`${this.apiUrl}/armadi`, { nome, rif_utente: utenteId });
  }

  eliminaArmadio(id: number) {
    return this.http.delete(`${this.apiUrl}/armadi/${id}`);
  }

  // ─── BOX ──────────────────────────────────────────────────

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

  updateMovingMode(id: number, moving_mode: boolean) {
    return this.http.put(`${this.apiUrl}/box/moving-mode/${id}`, { moving_mode });
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

  // ─── CHECKPOINT GPS ───────────────────────────────────────

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

  eliminaCheckpoints(boxId: number) {
    return this.http.delete(`${this.apiUrl}/checkpoint/${boxId}`);
  }

  aggiornaCheckpointLabel(id: number, boxId: number, label: string) {
    return this.http.patch(`${this.apiUrl}/checkpoint/${id}/label`, { label });
  }

  // ─── SEGNALAZIONI GUEST ───────────────────────────────────

  getSegnalazioni(boxId: number) {
    return this.http.get(`${this.apiUrl}/box/${boxId}/segnalazioni`);
  }

  getQrToken(boxId: number) {
    return this.http.get(`${this.apiUrl}/box/${boxId}/qr-token`);
  }

  buildQrUrl(boxId: number, token: string): string {
    const base = `${window.location.protocol}//${window.location.hostname}${port()}`;
    return `${base}/scan?box=${boxId}&t=${token}`;
  }

  // ─── DASHBOARD BUSINESS ───────────────────────────────────

  getDashboardBusiness(utenteId: string) {
    return this.http.get(`${this.apiUrl}/dashboard/business/${utenteId}`);
  }

  // ─── OGGETTI ──────────────────────────────────────────────

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

  /** Recupera gli oggetti nel cestino per un utente */
  getOggettiEliminati(utenteId: string) {
    return this.http.get(`${this.apiUrl}/oggetti/eliminate/${utenteId}`);
  }

  /** Ripristina un oggetto dal cestino */
  ripristinaOggetto(id: number) {
    return this.http.put(`${this.apiUrl}/oggetti/${id}/ripristina`, {});
  }

  /** Elimina definitivamente un oggetto dal cestino */
  eliminaOggettoDefinitivo(id: number) {
    return this.http.delete(`${this.apiUrl}/oggetti/${id}/definitivo`);
  }

  svuotaBox(boxId: number) {
    return this.http.delete(`${this.apiUrl}/box/${boxId}/oggetti`);
  }

  // ─── CATALOGO ELEMENTI ────────────────────────────────────

  getCatalogoCategorie() {
    return this.http.get(`${this.apiUrl}/catalogo/categorie`);
  }

  creaCategoria(nome: string) {
    return this.http.post(`${this.apiUrl}/catalogo/categorie`, { nome });
  }

  getCatalogoElementi(filtri: { q?: string; categoria?: string; tag?: string; sort?: string } = {}) {
    const params = new URLSearchParams();
    if (filtri.q) params.set('q', filtri.q);
    if (filtri.categoria) params.set('categoria', filtri.categoria);
    if (filtri.tag) params.set('tag', filtri.tag);
    if (filtri.sort) params.set('sort', filtri.sort);
    const query = params.toString();
    const url = query ? `${this.apiUrl}/catalogo/elementi?${query}` : `${this.apiUrl}/catalogo/elementi`;
    return this.http.get(url);
  }

  aggiungiElementoCatalogo(boxId: number, catalogoId: number, quantita: number = 1) {
    return this.http.post(
      `${this.apiUrl}/box/${boxId}/catalogo/${catalogoId}/aggiungi`,
      { quantita }
    );
  }

  // ─── TRANSIT ZONE ─────────────────────────────────────────

  spostaOggetti(oggettiIds: number[], boxDestinazioneId: number) {
    const idsPuliti = oggettiIds.map(Number).filter(id => !isNaN(id) && id > 0);
    const destId    = Number(boxDestinazioneId);
    if (idsPuliti.length === 0) throw new Error('ID oggetti non validi');
    if (!destId || isNaN(destId) || destId <= 0) throw new Error('ID box destinazione non valido');
    return this.http.put(
      `${this.apiUrl}/oggetti/sposta`,
      { oggetti_ids: idsPuliti, box_destinazione_id: destId }
    );
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

  // ─── TIPOLOGIE ────────────────────────────────────────────

  getTipologie(utenteId: string) {
    return this.http.get(`${this.apiUrl}/tipologie/${utenteId}`);
  }

  creaTipologia(nome: string, utenteId: string) {
    return this.http.post(`${this.apiUrl}/tipologie`, { nome, rif_utente: utenteId });
  }

  eliminaTipologia(id: number) {
    return this.http.delete(`${this.apiUrl}/tipologie/${id}`);
  }

  // ─── RICERCA ──────────────────────────────────────────────

  cercaOggetti(termine: string) {
    return this.http.get(
      `${this.apiUrl}/cerca?q=${encodeURIComponent(termine)}`
    );
  }

  // ─── CONDIVISIONI ARCHIVIO (RBAC) ─────────────────────────

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

  getBoxArchivioCondiviso(armadioId: number) {
    return this.http.get(`${this.apiUrl}/condivisioni/armadio/${armadioId}/box`);
  }

  getOggettiBoxCondivisa(boxId: number) {
    return this.http.get<OggettiBoxCondivisaResponse>(
      `${this.apiUrl}/condivisioni/box/${boxId}/oggetti`);
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

  // ─── GEOFENCING ───────────────────────────────────────────

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

  salvaCheckpointSicuro(rif_box: number, latitudine: number, longitudine: number, accuratezza?: number, label?: string) {
    return this.http.post(`${this.apiUrl}/checkpoint/sicuro`,
      { rif_box, latitudine, longitudine, accuratezza, label });
  }

  getBoxLog(boxId: number) {
    return this.http.get(`${this.apiUrl}/box/${boxId}/log`);
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

  // ─── GEOFENCE PER CHECKPOINT ────────────────────────────

  impostaGeofenceCheckpoint(checkpoint_id: number, latitudine: number, longitudine: number, raggio_m: number = 100, attivo: boolean = true) {
    return this.http.post(`${this.apiUrl}/geofence-checkpoint`, { checkpoint_id, latitudine, longitudine, raggio_m, attivo });
  }

  getGeofenceCheckpointSingolo(checkpointId: number) {
    return this.http.get(`${this.apiUrl}/geofence-checkpoint/${checkpointId}`);
  }

  eliminaGeofenceCheckpoint(checkpointId: number) {
    return this.http.delete(`${this.apiUrl}/geofence-checkpoint/${checkpointId}`);
  }

  getGeofenceCheckpointUtente(utenteId: string) {
    return this.http.get(`${this.apiUrl}/geofence-checkpoint/utente/${utenteId}`);
  }

  // ─── EXPORT ───────────────────────────────────────────────

  getExportJson(utenteId: string) {
    return this.http.get(`${this.apiUrl}/export/json/${utenteId}`, { responseType: 'blob' });
  }

  getExportCsv(utenteId: string) {
    return this.http.get(`${this.apiUrl}/export/csv/${utenteId}`, { responseType: 'blob' });
  }

  getEtichetteBox(boxId: number) {
    return this.http.get(`${this.apiUrl}/export/etichette/${boxId}`);
  }

  // ─── MESSAGGI ─────────────────────────────────────────────

  getMessaggi(utenteId: string) {
    return this.http.get<{ messaggi: any[] }>(`${this.apiUrl}/messaggi`);
  }

  getMessaggiArchiviati(utenteId: string) {
    return this.http.get<{ messaggi: any[] }>(`${this.apiUrl}/messaggi/archiviati`);
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

  archiviaMessaggio(id: number) {
    return this.http.patch(`${this.apiUrl}/messaggi/${id}/archivia`, {});
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

  // ─── RISPOSTE RAPIDE ──────────────────────────────────────

  getRisposteRapide() {
    return this.http.get<{ risposte: any[] }>(`${this.apiUrl}/risposte-rapide`);
  }

  creaRispostaRapida(data: { titolo: string; corpo: string }) {
    return this.http.post(`${this.apiUrl}/risposte-rapide`, data);
  }

  eliminaRispostaRapida(id: number) {
    return this.http.delete(`${this.apiUrl}/risposte-rapide/${id}`);
  }

  // ─── ADMIN ────────────────────────────────────────────────

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
