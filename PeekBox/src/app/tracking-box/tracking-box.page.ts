import { Component, ViewChild, ElementRef, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { DatabaseService } from '../services/database';
import { MapService } from '../services/map';
import * as L from 'leaflet';

@Component({
  selector: 'app-tracking-box',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './tracking-box.page.html',
  styleUrls: ['./tracking-box.page.scss'],
})
export class TrackingBoxPage implements OnDestroy {
  utenteId = '';
  tipoProfilo = 'personal';

  mappaAperta = false;
  boxAttive: any[] = [];
  isLoading = false;
  hasError = false;

  selectedBox: any = null;
  geofenceRadius = 500;
  isSaving = false;

  @ViewChild('mapContainer') mapContainerRef!: ElementRef<HTMLElement>;

  private leafletMap: L.Map | null = null;
  private markers: L.Marker[] = [];
  private geofenceCircles: Map<number, L.Circle> = new Map();
  private selectedCircle: L.Circle | null = null;
  private selectedMarkerRef: L.Marker | null = null;

  constructor(
    private router: Router,
    private dbService: DatabaseService,
    private mapService: MapService,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
  ) {}

  ionViewWillEnter() {
    this.utenteId = localStorage.getItem('utente_id') || '';
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
  }

  ionViewWillLeave() {
    this.distruggiMappa();
    this.mappaAperta = false;
    this.selectedBox = null;
  }

  ngOnDestroy() {
    this.distruggiMappa();
  }

  tornaIndietro() {
    this.router.navigate(['/profilo']);
  }

  toggleMappa() {
    this.mappaAperta = !this.mappaAperta;

    if (this.mappaAperta) {
      if (!this.utenteId) return;
      this.isLoading = true;
      this.hasError = false;
      this.dbService.getTuttiCheckpointAttivi(this.utenteId).subscribe({
        next: (res: any) => {
          this.boxAttive = res.checkpoints || [];
          this.isLoading = false;
          setTimeout(() => {
            this.ngZone.run(() => {
              this.inizializzaMappa();
              if (this.boxAttive.length > 0) {
                this.posizionaMarkers();
                this.caricaGeofenceEsistenti();
              }
            });
          }, 600);
        },
        error: () => {
          this.isLoading = false;
          this.hasError = true;
        }
      });
    } else {
      this.selectedBox = null;
      this.distruggiMappa();
    }
  }

  private distruggiMappa() {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
    this.markers = [];
    this.geofenceCircles.clear();
    this.selectedCircle = null;
    this.selectedMarkerRef = null;
  }

  private inizializzaMappa() {
    const el = this.mapContainerRef?.nativeElement;
    if (!el) return;
    if (this.leafletMap) {
      this.leafletMap.invalidateSize();
      return;
    }

    this.leafletMap = L.map(el, {
      center: [41.9028, 12.4964],
      zoom: 6,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.leafletMap);

    this.leafletMap.invalidateSize();
    setTimeout(() => this.leafletMap?.invalidateSize(), 300);
  }

  private posizionaMarkers() {
    if (!this.leafletMap || this.boxAttive.length === 0) return;
    const bounds = L.latLngBounds([]);

    this.boxAttive.forEach((cp, i) => {
      const latlng = L.latLng(cp.latitudine, cp.longitudine);
      bounds.extend(latlng);

      const marker = this.mapService.creaMarkerNumerato(latlng, i + 1, '#7DC740');
      marker.addTo(this.leafletMap!);
      this.markers.push(marker);

      const boxNome = cp.box_nome || `Box #${cp.rif_box}`;
      const label = cp.label || '';
      const ts = cp.timestamp ? new Date(cp.timestamp).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : '';

      marker.bindPopup(`
        <div style="font-family:Outfit,sans-serif;min-width:160px;padding:4px 0">
          <strong style="font-size:0.88rem;color:#0F172A">${boxNome}</strong>
          ${label ? `<br><span style="color:#4A7A94;font-size:0.76rem">${label}</span>` : ''}
          ${ts ? `<br><span style="color:#94A3B8;font-size:0.7rem">${ts}</span>` : ''}
          <br>
          <button class="tb-popup-btn" data-box-idx="${i}" style="margin-top:8px">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
            Imposta geofence
          </button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.querySelector(`.tb-popup-btn[data-box-idx="${i}"]`);
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            marker.closePopup();
            this.ngZone.run(() => this.selezionaBox(cp, marker));
          });
        }
      });
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

  selezionaBox(cp: any, marker?: L.Marker) {
    this.selectedBox = cp;
    this.selectedMarkerRef = marker || null;

    this.dbService.getGeofenceCheckpointSingolo(cp.id).subscribe({
      next: (res: any) => {
        this.geofenceRadius = res?.geofence?.raggio_m ?? 500;
        this.mostraGeofencePreviewSuMappa();
      },
      error: () => {
        this.geofenceRadius = 500;
        this.mostraGeofencePreviewSuMappa();
      }
    });

    if (this.leafletMap && cp.latitudine && cp.longitudine) {
      this.leafletMap.setView([cp.latitudine, cp.longitudine], 14, { animate: true });
    }
  }

  deselezionaBox() {
    this.selectedBox = null;
    this.rimuoviGeofencePreview();
  }

  private mostraGeofencePreviewSuMappa() {
    if (!this.leafletMap || !this.selectedBox) return;
    this.rimuoviGeofencePreview();
    if (this.geofenceRadius > 0) {
      this.selectedCircle = this.mapService.creaCerchioGeofence(
        [this.selectedBox.latitudine, this.selectedBox.longitudine],
        this.geofenceRadius,
        { colore: '#7DC740', fillOpacity: 0.12, dashArray: '6 4' }
      );
      this.selectedCircle.addTo(this.leafletMap);
    }
  }

  private rimuoviGeofencePreview() {
    if (this.selectedCircle && this.leafletMap) {
      this.leafletMap.removeLayer(this.selectedCircle);
      this.selectedCircle = null;
    }
  }

  aggiornaGeofencePreview() {
    if (!this.leafletMap || !this.selectedBox) return;
    this.rimuoviGeofencePreview();
    if (this.geofenceRadius > 0) {
      this.selectedCircle = this.mapService.creaCerchioGeofence(
        [this.selectedBox.latitudine, this.selectedBox.longitudine],
        this.geofenceRadius,
        { colore: '#7DC740', fillOpacity: 0.12, dashArray: '6 4' }
      );
      this.selectedCircle.addTo(this.leafletMap);
    }
  }

  formatData(ts: string | number): string {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  salvaGeofence() {
    if (!this.selectedBox || this.isSaving) return;
    this.isSaving = true;
    const cp = this.selectedBox;
    const raggio = Math.min(5000, Math.max(0, Number(this.geofenceRadius) || 0));

    this.dbService.impostaGeofenceCheckpoint(cp.id, cp.latitudine, cp.longitudine, raggio, raggio > 0).subscribe({
      next: async () => {
        if (this.geofenceCircles.has(cp.id)) {
          this.leafletMap?.removeLayer(this.geofenceCircles.get(cp.id)!);
          this.geofenceCircles.delete(cp.id);
        }
        if (this.leafletMap && raggio > 0) {
          const circle = this.mapService.creaCerchioGeofence([cp.latitudine, cp.longitudine], raggio);
          circle.addTo(this.leafletMap);
          this.geofenceCircles.set(cp.id, circle);
        }
        this.isSaving = false;
        const t = await this.toastCtrl.create({
          message: `Geofence ${raggio > 0 ? 'impostato: ' + (raggio >= 1000 ? (raggio / 1000).toFixed(1) + ' km' : raggio + ' m') : 'disattivato'}`,
          duration: 2200, color: 'success', position: 'bottom'
        });
        await t.present();
        this.deselezionaBox();
      },
      error: async () => {
        this.isSaving = false;
        const t = await this.toastCtrl.create({
          message: 'Errore nel salvare il geofence.',
          duration: 2000, color: 'danger', position: 'bottom'
        });
        await t.present();
      }
    });
  }
}
