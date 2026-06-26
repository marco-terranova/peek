
export interface UtenteLogin {
  id: number;
  username: string;
  email: string;
  tipo_profilo: 'personal' | 'business';
  is_admin: number | boolean;
  data_registrazione?: string;
}

export interface LoginResponse {
  token: string;
  user: UtenteLogin;
}

export interface PendingResponse {
  pending: number;
}


export interface Box {
  id: number;
  nome: string;
  rif_armadio: number | string;
  is_preferito: boolean;
  moving_mode: boolean;
  num_oggetti?: number;
  data_eliminazione?: string;
  data_creazione?: string;
  contiene_fragili?: number;
  ruolo_condivisione?: string | null;
}

export interface BoxListResponse {
  box: Box[];
}

export interface BoxEliminateResponse {
  box_eliminate: Box[];
}


export interface Oggetto {
  id?: number;
  nome: string;
  descrizione?: string;
  quantita?: number;
  categoria?: string;
  tag?: string;
  rif_box?: number;
  foto_url?: string;
}


export interface ArchivioCondiviso {
  id: number;
  nome: string;
  ruolo: 'viewer' | 'editor';
}

export interface ArchivioCondivisiResponse {
  archivi_condivisi: ArchivioCondiviso[];
}

export interface RichiestaCondivisione {
  id: number;
  armadio_id: number;
  nome_archivio: string;
  nome_proprietario: string;
  ruolo: 'viewer' | 'editor';
  data_invio: string;
}

export interface CondivisioniInAttesaResponse {
  richieste: RichiestaCondivisione[];
}

export interface OggettiBoxCondivisaResponse {
  oggetti: Oggetto[];
  ruolo_corrente: string;
}


export interface Messaggio {
  id: number;
  rif_utente: number;
  tipo: 'sistema' | 'supporto' | 'condivisione' | 'geofence';
  mittente: string;
  oggetto: string;
  corpo: string;
  letto: number;
  importante: number;
  direzione?: number;
  timestamp: string;
  /** Se presente, il messaggio è una notifica geofence mappata */
  geofence_id?: number;
  geofence_box_id?: number;
  geofence_armadio_id?: number;
}

export interface MessaggiResponse {
  messaggi: Messaggio[];
}

export interface GeofenceNotifica {
  id: number;
  rif_box: number;
  rif_armadio: number;
  rif_utente: number;
  latitudine: number;
  longitudine: number;
  messaggio: string;
  letto: number;
  nome_archivio: string;
  nome_box: string;
  timestamp: string;
}

export interface GeofenceNotificheResponse {
  notifiche: GeofenceNotifica[];
}

export interface RispostaRapida {
  id: number;
  rif_utente: number;
  titolo: string;
  corpo: string;
  timestamp: string;
}

export interface RisposteRapideResponse {
  risposte: RispostaRapida[];
}
