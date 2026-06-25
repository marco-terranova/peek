import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonButton, IonIcon, IonItem, IonLabel,
  IonToggle, IonRange, IonSpinner, IonInput,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  locationOutline, shieldCheckmarkOutline, warningOutline,
  trashOutline, saveOutline, navigateOutline, refreshOutline,
  arrowForwardOutline, closeOutline, mapOutline, informationCircleOutline
} from 'ionicons/icons';
import { DatabaseService } from '../services/database';
import { NavigationHistoryService } from '../services/navigation-history';
import { GpsService } from '../services/gps';
import { MapService } from '../services/map';
import * as L from 'leaflet';

@Component({
  selector: 'app-geofence-armadio',
  templateUrl: './geofence-armadio.page.html',
  styleUrls: ['./geofence-armadio.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonIcon, IonItem, IonLabel,
    IonToggle, IonRange, IonSpinner, IonInput
  ]
})
export class GeofenceArmadioPage implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  armadioId!: number;
  armadioNome: string = '';

  latitudine: number | null = null;
  longitudine: number | null = null;
  raggioM: number = 100;
  attivo: boolean = true;

  geofenceEsistente: any = null;
  hasGeofence = false;

  verificaResult: any = null;
  isVerifying = false;

  get verificaRisultato(): boolean | null {
    if (this.verificaResult === null) return null;
    if (typeof this.verificaResult?.dentro_perimetro !== 'undefined') {
      return this.verificaResult.dentro_perimetro === true || this.verificaResult.dentro_perimetro === 1;
    }
    return null;
  }

  isLoading = false;
  isSaving = false;
  isGettingGps = false;

  private map: L.Map | null = null;
  private centerMarker: L.Marker | null = null;
  private circle: L.Circle | null = null;
  private checkpointMarkers: L.Marker[] = [];
  private userMarker: L.Marker | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dbService: DatabaseService,
    private gpsService: GpsService,
    private mapService: MapService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navHistory: NavigationHistoryService
  ) {
    addIcons({
      'location-outline': locationOutline,
      'shield-checkmark-outline': shieldCheckmarkOutline,
      'warning-outline': warningOutline,
      'warning': warningOutline,
      'trash-outline': trashOutline,
      'save-outline': saveOutline,
      'navigate-outline': navigateOutline,
      'refresh-outline': refreshOutline,
      'arrow-forward-outline': arrowForwardOutline,
      'close-outline': closeOutline,
      'map-outline': mapOutline,
      'information-circle-outline': informationCircleOutline
    });
  }

  boxId: number | null = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const parsedId = id ? Number(id) : NaN;

    const bId = this.route.snapshot.queryParamMap.get('boxId');
    this.boxId = bId ? Number(bId) : null;

    if (!parsedId || isNaN(parsedId) || parsedId <= 0) {
      this.mostraToast('ID archivio non valido. Torna indietro e riprova.', 'danger').then(() => {
        this.chiudi();
      });
      return;
    }

    this.armadioId = parsedId;
    this.armadioNome = this.route.snapshot.queryParamMap.get('nome') || `Archivio #${this.armadioId}`;
    this.caricaGeofence();
  }

  ngAfterViewInit() {
    setTimeout(() => this.inizializzaMappa(), 300);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private inizializzaMappa() {
    if (!this.mapContainer) return;
    const el = this.mapContainer.nativeElement;

    this.map = this.mapService.inizializzaMappa(el, [41.9028, 12.4964], 13);

    this.mapService.creaTileLayer(this.map, {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr: '',
    });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.latitudine = parseFloat(e.latlng.lat.toFixed(6));
      this.longitudine = parseFloat(e.latlng.lng.toFixed(6));
      this.aggiornaMarcatoreCentro();
    });

    if (this.latitudine && this.longitudine) {
      this.aggiornaMarcatoreCentro();
    }

    this.caricaCheckpoints();
  }

  private aggiornaMarcatoreCentro() {
    if (!this.map) return;
    if (this.centerMarker) {
      this.centerMarker.setLatLng([this.latitudine!, this.longitudine!]);
    } else {
      this.centerMarker = this.mapService.creaMarkerGeofence(
        [this.latitudine!, this.longitudine!],
        false,
        {
          html: '<div style="width: 20px; height: 20px; background: #3AABDB; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          className: '',
        },
      ).addTo(this.map);
    }

    if (this.circle) {
      this.circle.setLatLng([this.latitudine!, this.longitudine!]);
      this.circle.setRadius(this.raggioM);
    } else {
      this.circle = this.mapService.creaCerchioGeofence(
        [this.latitudine!, this.longitudine!],
        this.raggioM,
        { colore: '#3AABDB', fillOpacity: 0.1 },
      ).addTo(this.map);
    }

    this.map.setView([this.latitudine!, this.longitudine!], this.map.getZoom());
  }

  private caricaCheckpoints() {
    if (!this.armadioId) return;
    this.dbService.getGeofenceCheckpoints(this.armadioId).subscribe({
      next: (res: any) => {
        const checkpoints: any[] = res.checkpoints || [];
        this.aggiungiCheckpoints(checkpoints);
      },
      error: (err) => console.error('Errore caricamento checkpoints:', err)
    });
  }

  private aggiungiCheckpoints(checkpoints: any[]) {
    this.checkpointMarkers.forEach(m => m.remove());
    this.checkpointMarkers = [];

    if (!this.map) return;
    if (checkpoints.length === 0) return;

    const group = this.mapService.creaFeatureGroup();
    const cpIconOpts: { html: string; iconSize: [number, number]; iconAnchor: [number, number]; className: string } = {
      html: `<div style="width: 14px; height: 14px; background: #F59E0B; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      className: '',
    };

    checkpoints.forEach(cp => {
      if (cp.latitudine == null || cp.longitudine == null) return;
      const marker = this.mapService.creaMarkerGeofence(
        [cp.latitudine, cp.longitudine],
        false,
        cpIconOpts,
      ).bindPopup(`<b>${cp.nome_box || 'Box'}</b><br>${new Date(cp.timestamp).toLocaleString('it-IT')}${cp.label ? '<br>' + cp.label : ''}`);
      this.checkpointMarkers.push(marker);
      group.addLayer(marker);
    });

    group.addTo(this.map);

    if (this.latitudine && this.longitudine) {
      this.map.setView([this.latitudine, this.longitudine], this.map.getZoom());
    } else if (checkpoints.length > 0) {
      this.map.fitBounds(group.getBounds().pad(0.3));
    }
  }

  private aggiornaMappaUtente(lat: number, lng: number) {
    if (!this.map) return;
    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = this.mapService.creaMarkerGeofence(
        [lat, lng],
        false,
        {
          html: `<div style="width: 16px; height: 16px; background: #7DC840; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                   <div style="width: 6px; height: 6px; background: #fff; border-radius: 50%; margin: 2px auto;"></div>
                 </div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          className: '',
        },
      ).addTo(this.map);
    }
  }

  caricaGeofence() {
    this.isLoading = true;
    this.dbService.getGeofence(this.armadioId).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.geofenceEsistente = res.geofence;
        this.hasGeofence = !!res.geofence;
        if (res.geofence) {
          this.latitudine = res.geofence.latitudine;
          this.longitudine = res.geofence.longitudine;
          this.raggioM = res.geofence.raggio_m;
          this.attivo = res.geofence.attivo === 1;
          this.aggiornaMarcatoreCentro();
        }
      },
      error: () => { this.isLoading = false; }
    });
  }

  async usaPosizioneCorrente() {
    this.isGettingGps = true;
    try {
      const pos = await this.gpsService.getPosizione();
      this.latitudine = pos.latitudine;
      this.longitudine = pos.longitudine;
      this.aggiornaMarcatoreCentro();
      this.aggiornaMappaUtente(pos.latitudine, pos.longitudine);
      await this.mostraToast(`Posizione acquisita (±${Math.round(pos.accuratezza)} m)`, 'success');
    } catch (err: any) {
      await this.mostraToast('GPS non disponibile: ' + err.message, 'danger');
    } finally {
      this.isGettingGps = false;
    }
  }

  async salvaGeofence() {
    const lat = Number(this.latitudine);
    const lng = Number(this.longitudine);
    const raggio = Number(this.raggioM);

    if (isNaN(lat) || isNaN(lng) || this.latitudine === null || this.longitudine === null) {
      await this.mostraToast('Imposta le coordinate valide prima di salvare.', 'warning');
      return;
    }

    if (isNaN(raggio) || raggio < 10 || raggio > 50000) {
      await this.mostraToast('Il raggio deve essere tra 10 e 50.000 metri.', 'warning');
      return;
    }

    this.isSaving = true;
    this.dbService.impostaGeofence(this.armadioId, lat, lng, raggio, this.attivo).subscribe({
      next: async (res: any) => {
        this.isSaving = false;
        this.hasGeofence = true;
        this.geofenceEsistente = res.geofence || { armadio_id: this.armadioId, latitudine: lat, longitudine: lng, raggio_m: raggio, attivo: this.attivo ? 1 : 0 };
        await this.mostraToast('Geofence configurato con successo!', 'success');
        this.caricaGeofence();
      },
      error: async (err: any) => {
        this.isSaving = false;
        console.error('Errore salvataggio geofence:', err);
        await this.mostraToast(err.error?.message || err.error?.error || 'Errore durante il salvataggio.', 'danger');
      }
    });
  }

  async confermaElimina() {
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Elimina Geofence',
      message: 'Rimuovere il perimetro virtuale? Gli asset non saranno più monitorati.',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          role: 'destructive',
          handler: () => {
            this.dbService.eliminaGeofence(this.armadioId).subscribe({
              next: async () => {
                this.hasGeofence = false;
                this.geofenceEsistente = null;
                this.latitudine = null;
                this.longitudine = null;
                this.raggioM = 100;
                if (this.centerMarker) { this.centerMarker.remove(); this.centerMarker = null; }
                if (this.circle) { this.circle.remove(); this.circle = null; }
                this.checkpointMarkers.forEach(m => m.remove());
                this.checkpointMarkers = [];
                if (this.map) { this.map.setView([41.9028, 12.4964], 13); }
                await this.mostraToast('Geofence rimosso.', 'medium');
              },
              error: async () => { await this.mostraToast('Errore durante l\'eliminazione.', 'danger'); }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async verificaPosizioneLive() {
    if (!this.armadioId || isNaN(this.armadioId) || this.armadioId <= 0) {
      await this.mostraToast('ID archivio non disponibile.', 'warning');
      return;
    }
    this.isVerifying = true;
    this.verificaResult = null;
    try {
      const pos = await this.gpsService.getPosizione();
      this.aggiornaMappaUtente(pos.latitudine, pos.longitudine);
      this.dbService.verificaGeofence(this.armadioId, pos.latitudine, pos.longitudine).subscribe({
        next: (res: any) => {
          this.isVerifying = false;
          this.verificaResult = res;
        },
        error: () => { this.isVerifying = false; }
      });
    } catch (err: any) {
      this.isVerifying = false;
      await this.mostraToast('GPS non disponibile: ' + err.message, 'danger');
    }
  }

  apriInMappa() {
    if (this.latitudine == null || this.longitudine == null) return;
    const url = this.gpsService.buildGoogleMapsUrl(this.latitudine, this.longitudine);
    window.open(url, '_blank');
  }

  onRaggioChange() {
    if (this.circle && this.latitudine && this.longitudine) {
      this.circle.setRadius(this.raggioM);
    }
  }

  get raggioLabel(): string {
    if (this.raggioM < 1000) return `${this.raggioM} m`;
    return `${(this.raggioM / 1000).toFixed(1)} km`;
  }

  private async mostraToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }

  chiudi() {
    if (this.boxId) {
      this.navHistory.navTo(`/dettaglio-box/${this.boxId}`);
    } else {
      this.navHistory.navTo('/home');
    }
  }

  navTo(route: string) { this.navHistory.navTo(route); }

}
