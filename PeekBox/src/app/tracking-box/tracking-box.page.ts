import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { GpsService } from '../services/gps';
import { MapService } from '../services/map';
import * as L from 'leaflet';

@Component({
  selector: 'app-tracking-box',
  templateUrl: './tracking-box.page.html',
  styleUrls: ['./tracking-box.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class TrackingBoxPage implements OnInit, AfterViewInit, OnDestroy {
  utenteId = '';
  tipoProfilo = 'personal';
  allCheckpoints: any[] = [];
  isLoading = false;

  @ViewChild('mapContainer') mapContainerRef!: ElementRef<HTMLElement>;
  private leafletMap: L.Map | null = null;
  private geofenceCircles: Map<number, L.Circle> = new Map();

  constructor(
    private router: Router,
    private dbService: DatabaseService,
    private gpsService: GpsService,
    private mapService: MapService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    this.utenteId = localStorage.getItem('utente_id') || '';
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
  }

  private geofenceListener = ((e: CustomEvent) => {
    const { id, lat, lng, nome } = e.detail;
    this.apriGeofenceDialog(id, lat, lng, nome);
  }) as EventListener;

  ngAfterViewInit() {
    if (this.tipoProfilo === 'business' && this.utenteId) {
      setTimeout(() => {
        this.inizializzaMappa();
        this.caricaTuttiCheckpoints();
      }, 200);
    }
    window.addEventListener('tb-geofence', this.geofenceListener);
  }

  ngOnDestroy() {
    window.removeEventListener('tb-geofence', this.geofenceListener);
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
  }

  private inizializzaMappa() {
    if (!this.mapContainerRef?.nativeElement) return;
    this.leafletMap = this.mapService.inizializzaMappa(
      this.mapContainerRef.nativeElement,
      [41.9028, 12.4964],
      6
    );
    this.mapService.creaTileLayer(this.leafletMap, {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr: '&copy; OpenStreetMap'
    });
  }

  caricaTuttiCheckpoints() {
    if (!this.utenteId) return;
    this.isLoading = true;
    this.dbService.getTuttiCheckpoint(this.utenteId).subscribe({
      next: (res: any) => {
        this.allCheckpoints = res.checkpoints || [];
        this.isLoading = false;
        this.posizionaMarkers();
        this.caricaGeofenceEsistenti();
      },
      error: () => { this.isLoading = false; }
    });
  }

  private posizionaMarkers() {
    if (!this.leafletMap || this.allCheckpoints.length === 0) return;
    const bounds = L.latLngBounds([]);
    this.allCheckpoints.forEach((cp, i) => {
      const latlng = L.latLng(cp.latitudine, cp.longitudine);
      bounds.extend(latlng);
      const marker = this.mapService.creaMarkerNumerato(
        latlng, i + 1, '#3AABDB'
      );
      marker.addTo(this.leafletMap!);
      const boxNome = cp.box_nome || cp.nome_box || `Box #${cp.rif_box}`;
      const label = cp.label || '';
      const ts = cp.timestamp ? new Date(cp.timestamp).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : '';

      marker.bindPopup(`
        <div style="font-family:Outfit,sans-serif;min-width:160px">
          <strong style="font-size:0.9rem">${boxNome}</strong>
          ${label ? `<br><span style="color:#4A7A94;font-size:0.78rem">${label}</span>` : ''}
          ${ts ? `<br><span style="color:#94A3B8;font-size:0.72rem">${ts}</span>` : ''}
          <br><button onclick="window.dispatchEvent(new CustomEvent('tb-geofence',{detail:{id:${cp.id},lat:${cp.latitudine},lng:${cp.longitudine},nome:'${boxNome.replace(/'/g, "\\'")}'}}))"
            style="margin-top:8px;padding:6px 14px;border:none;border-radius:8px;background:linear-gradient(135deg,#7DC740,#3AABDB);color:#fff;font-family:Outfit,sans-serif;font-size:0.75rem;font-weight:700;cursor:pointer">
            Imposta Geofence
          </button>
        </div>
      `);
    });
    if (bounds.isValid()) {
      this.leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  private caricaGeofenceEsistenti() {
    if (!this.utenteId) return;
    this.dbService.getGeofenceCheckpointUtente(this.utenteId).subscribe({
      next: (res: any) => {
        const geofences = res.geofences || [];
        geofences.forEach((gf: any) => {
          if (gf.attivo && this.leafletMap) {
            const circle = this.mapService.creaCerchioGeofence(
              [gf.latitudine, gf.longitudine],
              gf.raggio_m
            );
            circle.addTo(this.leafletMap!);
            this.geofenceCircles.set(gf.rif_checkpoint, circle);
          }
        });
      },
      error: () => {}
    });
  }

  async apriGeofenceDialog(cpId: number, lat: number, lng: number, nome: string) {
    const alert = await this.alertCtrl.create({
      cssClass: 'tb-alert',
      header: `Geofence: ${nome}`,
      message: 'Imposta il raggio del geofence per questo checkpoint (0 - 5 km).',
      inputs: [{
        name: 'raggio',
        type: 'number',
        placeholder: 'Raggio in metri (es. 500)',
        min: 0,
        max: 5000,
        value: 500,
      }],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Salva',
          handler: (data: any) => {
            const raggio = Math.min(5000, Math.max(0, Number(data.raggio) || 100));
            this.dbService.impostaGeofenceCheckpoint(cpId, lat, lng, raggio, true).subscribe({
              next: async () => {
                if (this.geofenceCircles.has(cpId)) {
                  this.leafletMap?.removeLayer(this.geofenceCircles.get(cpId)!);
                }
                if (this.leafletMap && raggio > 0) {
                  const circle = this.mapService.creaCerchioGeofence([lat, lng], raggio);
                  circle.addTo(this.leafletMap);
                  this.geofenceCircles.set(cpId, circle);
                }
                const t = await this.toastCtrl.create({
                  message: `Geofence impostato: ${raggio}m`, duration: 2000, color: 'success', position: 'bottom'
                });
                await t.present();
              },
              error: async () => {
                const t = await this.toastCtrl.create({
                  message: 'Errore nel salvare il geofence.', duration: 2000, color: 'danger', position: 'bottom'
                });
                await t.present();
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  tornaIndietro() {
    this.router.navigate(['/home']);
  }
}
