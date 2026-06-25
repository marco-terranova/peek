import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  AlertController, ToastController,
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon, IonBadge, IonSpinner, IonCard,
  IonCardHeader, IonCardTitle, IonCardContent, IonFooter,
  IonSegment, IonSegmentButton, IonList, IonLabel,
  IonInput
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline, closeCircleOutline, archiveOutline,
  timeOutline, personOutline, homeOutline, arrowBackOutline,
  refreshOutline, mailOpenOutline, shareSocialOutline, qrCodeOutline, chatbubblesOutline,
  peopleOutline, locationOutline, warningOutline, alertCircleOutline,
  trashOutline, personAddOutline, mailOutline, checkmarkOutline,
  chevronForwardOutline, closeOutline, optionsOutline, addOutline,
  home, add, search, person
} from 'ionicons/icons';
import { DatabaseService } from '../services/database';
import { NavigationHistoryService } from '../services/navigation-history';
import { PbDropdownComponent } from '../components/pb-dropdown/pb-dropdown.component';
import * as L from 'leaflet';

@Component({
  selector: 'app-box-ricevute',
  templateUrl: './box-ricevute.page.html',
  styleUrls: ['./box-ricevute.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon, IonBadge, IonSpinner, IonCard,
    IonCardHeader, IonCardTitle, IonCardContent, IonFooter,
    IonSegment, IonSegmentButton, IonList, IonLabel,
    IonInput,
    PbDropdownComponent,
  ]
})
export class BoxRicevutePage implements OnInit {

  mostraSpazi = false;
  isLoading = true;
  utenteId: string | null = null;
  nomeUtente: string = '';
  tipoProfilo: string = 'personal';

  get contatoreNonLette(): number {
    return this.notificheGeofence.filter(n => !n.letto).length;
  }

  richiestePending: any[] = [];
  archiviAccettati: any[] = [];

  mieiArmadi: any[] = [];
  activeGuestsMap: { [key: number]: any[] } = {};

  notificheGeofence: any[] = [];

  emailOspite: string = '';
  ruoloSelezionato: 'viewer' | 'editor' = 'viewer';
  armadioSelezionato: number | null = null;
  isInviting = false;

  ruoloOptions = [
    { value: 'viewer', label: 'Sola Lettura' },
    { value: 'editor', label: 'Lettura e Scrittura' },
  ];

  private map: L.Map | null = null;
  private checkpointMarkers: L.Marker[] = [];
  checkpointsMappa: any[] = [];

  constructor(
    private dbService: DatabaseService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navHistory: NavigationHistoryService
  ) {
    addIcons({
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
      'archive-outline': archiveOutline,
      'time-outline': timeOutline,
      'person-outline': personOutline,
      'home-outline': homeOutline,
      'arrow-back-outline': arrowBackOutline,
      'refresh-outline': refreshOutline,
      'mail-open-outline': mailOpenOutline,
      'share-social-outline': shareSocialOutline,
      'chatbubbles-outline': chatbubblesOutline,
      'qr-code-outline': qrCodeOutline,
      'people-outline': peopleOutline,
      'location-outline': locationOutline,
      'warning-outline': warningOutline,
      'alert-circle-outline': alertCircleOutline,
      'trash-outline': trashOutline,
      'person-add-outline': personAddOutline,
      'mail-outline': mailOutline,
      'checkmark-outline': checkmarkOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'close-outline': closeOutline,
      'options-outline': optionsOutline,
      'add-outline': addOutline,
      'home': home,
      'add': add,
      'search': search,
      'person': person
    });
  }

  ngOnInit() {
    this.utenteId = localStorage.getItem('utente_id');
    this.nomeUtente = localStorage.getItem('utente_nome') || 'Utente';
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
    this.caricaTutto();
  }

  ionViewWillEnter() {
    this.caricaTutto();
  }

  toggleView() {
    this.mostraSpazi = !this.mostraSpazi;
  }

  caricaTutto() {
    if (!this.utenteId) return;
    this.isLoading = true;

    this.dbService.getCondivisioniInAttesa(this.utenteId).subscribe({
      next: (res: any) => { this.richiestePending = res.richieste || []; },
      error: (err) => console.error('Errore richieste pending:', err)
    });

    this.dbService.getArchividCondivisiConMe(this.utenteId).subscribe({
      next: (res: any) => {
        this.archiviAccettati = res.archivi_condivisi || [];
      },
      error: (err) => console.error('Errore archivi condivisi:', err)
    });

    this.dbService.getArmadi(this.utenteId).subscribe({
      next: (res: any) => {
        const armadiRows = res.armadi || [];
        this.mieiArmadi = armadiRows.filter((a: any) => a.ruolo_condivisione === null);
        this.mieiArmadi.forEach(armadio => { this.caricaOspitiArmadio(armadio.id); });
      },
      error: (err) => console.error('Errore caricamento armadi propri:', err)
    });

    if (this.tipoProfilo === 'business') {
      this.dbService.getNotificheGeofence().subscribe({
        next: (res: any) => {
          this.notificheGeofence = res.notifiche || [];
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Errore caricamento notifiche geofence:', err);
          this.isLoading = false;
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  private inizializzaMappa() {
    const el = document.querySelector<HTMLDivElement>('.geo-leaflet-map');
    if (!el || this.map) return;

    this.map = L.map(el, {
      center: [41.9028, 12.4964],
      zoom: 6,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(this.map);
  }

  caricaCheckpointMappa() {
    if (!this.utenteId) return;
    this.dbService.getTuttiCheckpoint(this.utenteId).subscribe({
      next: (res: any) => {
        this.checkpointsMappa = (res.checkpoints || []).map((cp: any) => {
          const display_lat = cp.latitudine ?? cp.geofence_lat;
          const display_lng = cp.longitudine ?? cp.geofence_lng;
          return {
            ...cp,
            display_lat,
            display_lng,
            haCheckpoint: cp.latitudine != null && cp.longitudine != null,
            haCoordinate: display_lat != null && display_lng != null
          };
        });
        this.aggiornaMarkerMappa();
      },
      error: (err) => console.error('Errore caricamento checkpoint mappa:', err)
    });
  }

  private aggiornaMarkerMappa() {
    if (!this.map) return;

    this.checkpointMarkers.forEach(m => m.remove());
    this.checkpointMarkers = [];

    const conCoordinate = this.checkpointsMappa.filter(cp => cp.display_lat != null && cp.display_lng != null);
    if (conCoordinate.length === 0) return;

    const group = L.featureGroup();

    conCoordinate.forEach((cp: any) => {
      const color = cp.haCheckpoint ? '#7DC840' : '#3AABDB';
      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: ''
      });

      const badge = cp.haCheckpoint
        ? '<br/><span style="display:inline-block;background:#7DC840;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin-top:4px;">🛡️ Geofence attivo</span>'
        : '<br/><span style="display:inline-block;background:#3AABDB;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin-top:4px;">📍 Centro geofence</span>';

      const data = cp.timestamp ? `<br/><small>${new Date(cp.timestamp).toLocaleString('it-IT')}</small>` : '<br/><small>Nessun checkpoint GPS</small>';

      const marker = L.marker([cp.display_lat, cp.display_lng], { icon })
        .bindPopup(`
          <b>${cp.box_nome || 'Box #' + cp.box_id}</b>
          <br/>${cp.armadio_nome || ''}${data}
          ${badge}
          <br/><a href="https://www.google.com/maps/search/?api=1&query=${cp.display_lat},${cp.display_lng}" target="_blank" style="color:#3AABDB;font-weight:700;text-decoration:none;">Apri in Google Maps →</a>
        `);

      this.checkpointMarkers.push(marker);
      group.addLayer(marker);
    });

    group.addTo(this.map);

    if (conCoordinate.length === 1) {
      this.map.setView([conCoordinate[0].display_lat, conCoordinate[0].display_lng], 13);
    } else {
      this.map.fitBounds(group.getBounds().pad(0.3));
    }
  }

  apriGoogleMaps(lat: number, lng: number) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  }

  caricaOspitiArmadio(armadioId: number) {
    this.dbService.getCondivisioniArchivio(armadioId).subscribe({
      next: (res: any) => { this.activeGuestsMap[armadioId] = res.condivisioni || []; },
      error: () => { this.activeGuestsMap[armadioId] = []; }
    });
  }


  async accetta(condivisione: any) {
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Accetta Condivisione',
      message: `Vuoi accettare l'accesso all'archivio <strong>"${condivisione.armadio_nome || condivisione.nome_archivio}"</strong> condiviso da <strong>${condivisione.proprietario_username}</strong>?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Accetta', handler: () => this.eseguiAccetta(condivisione) }
      ]
    });
    await alert.present();
  }

  private eseguiAccetta(condivisione: any) {
    const id = condivisione.condivisione_id || condivisione.id;
    this.dbService.accettaCondivisione(id).subscribe({
      next: async () => {
        this.richiestePending = this.richiestePending.filter(r => (r.condivisione_id || r.id) !== id);
        this.caricaTutto();
        const toast = await this.toastCtrl.create({ message: 'Condivisione accettata!', duration: 3000, color: 'success', position: 'bottom' });
        await toast.present();
      },
      error: async (err) => {
        const toast = await this.toastCtrl.create({ message: 'Errore nell\'accettare la condivisione.', duration: 3000, color: 'danger', position: 'bottom' });
        await toast.present();
      }
    });
  }

  async rifiuta(condivisione: any) {
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Rifiuta Condivisione',
      message: `Sei sicuro di voler rifiutare l'accesso all'archivio <strong>"${condivisione.armadio_nome || condivisione.nome_archivio}"</strong>?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Rifiuta', role: 'destructive', handler: () => this.eseguiRifiuta(condivisione) }
      ]
    });
    await alert.present();
  }

  private eseguiRifiuta(condivisione: any) {
    const id = condivisione.condivisione_id || condivisione.id;
    this.dbService.rifiutaCondivisione(id).subscribe({
      next: async () => {
        this.richiestePending = this.richiestePending.filter(r => (r.condivisione_id || r.id) !== id);
        this.caricaTutto();
        const toast = await this.toastCtrl.create({ message: 'Invito rifiutato.', duration: 2500, color: 'medium', position: 'bottom' });
        await toast.present();
      },
      error: async () => {
        const toast = await this.toastCtrl.create({ message: 'Errore nel rifiutare la condivisione.', duration: 3000, color: 'danger', position: 'bottom' });
        await toast.present();
      }
    });
  }


  async invitaNuovoOspite() {
    if (!this.armadioSelezionato) { this.mostraToast('Seleziona un archivio da condividere.', 'warning'); return; }
    if (!this.emailOspite.trim()) { this.mostraToast('Inserisci un indirizzo email valido.', 'warning'); return; }
    this.isInviting = true;
    this.dbService.condividiArchivio(this.armadioSelezionato, this.emailOspite.trim(), this.ruoloSelezionato).subscribe({
      next: async () => {
        this.isInviting = false;
        this.emailOspite = '';
        this.armadioSelezionato = null;
        this.caricaTutto();
        this.mostraToast('Invito inviato con successo!', 'success');
      },
      error: async (err) => {
        this.isInviting = false;
        this.mostraToast(err.error?.error || 'Impossibile inviare l\'invito.', 'danger');
      }
    });
  }

  async cambiaRuoloOspite(guest: any) {
    const nuovoRuolo: 'viewer' | 'editor' = guest.ruolo === 'editor' ? 'viewer' : 'editor';
    this.dbService.aggiornaRuoloCondivisione(guest.id, nuovoRuolo).subscribe({
      next: () => {
        guest.ruolo = nuovoRuolo;
        this.mostraToast(`Ruolo aggiornato a ${nuovoRuolo === 'editor' ? 'Editor' : 'Viewer'}`, 'success');
      },
      error: () => this.mostraToast('Impossibile aggiornare il ruolo.', 'danger')
    });
  }

  async revocaOspite(condivisioneId: number) {
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Revoca Accesso',
      message: 'Sei sicuro di voler revocare l\'accesso a questo ospite?',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Revoca', role: 'destructive', handler: () => {
          this.dbService.revocaCondivisione(condivisioneId).subscribe({
            next: () => { this.caricaTutto(); this.mostraToast('Accesso revocato.', 'success'); },
            error: () => this.mostraToast('Errore durante la revoca.', 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }


  segnaComeLetta(notifica: any) {
    this.dbService.segnaNotificaComeLetta(notifica.id).subscribe({
      next: () => { notifica.letto = 1; },
      error: (err) => console.error('Errore lettura notifica:', err)
    });
  }

  eliminaNotifica(notificaId: number, event: Event) {
    event.stopPropagation();
    this.dbService.eliminaNotificaGeofence(notificaId).subscribe({
      next: () => {
        this.notificheGeofence = this.notificheGeofence.filter(n => n.id !== notificaId);
        this.mostraToast('Notifica eliminata.', 'success');
      },
      error: () => this.mostraToast('Impossibile eliminare la notifica.', 'danger')
    });
  }

  mostraInMappa(notifica: any, event: Event) {
    event.stopPropagation();
    if (notifica.latitudine == null || notifica.longitudine == null) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${notifica.latitudine},${notifica.longitudine}`, '_blank');
    this.segnaComeLetta(notifica);
  }


  apriArchivioCondiviso(archivio: any) { this.router.navigate(['/home']); }

  apriConfigGeofence(armadio: any) {
    this.router.navigate(['/geofence-armadio', armadio.id], { queryParams: { nome: armadio.nome } });
  }

  apriDettagliSpazio(armadio: any) {
    this.router.navigate(['/gestione-spazi'], { queryParams: { armadio: armadio.id, nome: armadio.nome } });
  }

  tornaHome() { this.router.navigate(['/home']); }
  apriScanner() { this.router.navigate(['/scan-qr']); }
  navTo(route: string) { this.router.navigate([route]); }

  formattaData(data: string): string {
    if (!data) return '';
    return new Date(data).toLocaleString('it-IT', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  private async mostraToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }
}
