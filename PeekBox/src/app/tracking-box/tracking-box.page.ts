import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent, AlertController, ToastController } from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { GpsService } from '../services/gps';
import { MapService } from '../services/map';
import { WeatherService } from '../services/weather';
import { RouteExportService } from '../services/route-export';
import { RouteOptimizerService } from '../services/route-optimizer';
import * as L from 'leaflet';

interface TiledLayer { name: string; url: string; attr: string; }
interface StatItem { label: string; value: string; icon: string; }

@Component({
  selector: 'app-tracking-box',
  templateUrl: './tracking-box.page.html',
  styleUrls: ['./tracking-box.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, CommonModule]
})
export class TrackingBoxPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  boxId!: number;
  utenteId: string = '';
  tipoProfilo: string = 'personal';

  boxInfo: any = null;
  checkpoints: any[] = [];
  isLoading = false;
  movingModeAttivo = false;

  geofence: any = null;
  distanzaTotale: number = 0;

  liveAttivo: boolean = false;
  fullscreen: boolean = false;

  // ── Route decorations ──
  private segmentLabels: L.Marker[] = [];
  private directionArrows: L.Marker[] = [];

  // ── Geofence editor ──
  editingGeofence = false;
  gfLat: number | null = null;
  gfLng: number | null = null;
  gfRaggio: number = 100;
  gfAttivo: boolean = true;
  isSavingGeofence = false;

  // ── Route playback ──
  playing = false;
  playSpeed: number = 1;
  private playMarker: L.Marker | null = null;
  private playIndex: number = 0;
  private playAnimId: number = 0;

  // ── Distance measure ──
  measuring = false;
  private measurePoints: L.LatLng[] = [];
  private measureLine: L.Polyline | null = null;
  private measureMarkers: L.Marker[] = [];
  private measureLabel: L.Marker | null = null;
  measureDistance: number = 0;

  // ── Time range filter ──
  timeRangeStart: string = '';
  timeRangeEnd: string = '';
  showTimeFilter: boolean = false;

  // ── Checkpoint search ──
  searchQuery: string = '';
  showSearch: boolean = false;

  // ── Ambient tour ──
  ambientTour: boolean = false;
  private tourIndex: number = 0;
  private tourInterval: any = null;

  // ── Weather ──
  meteo: any = null;
  caricoMeteo: boolean = false;

  // ── Stats ──
  showStats: boolean = false;
  showExportMenu: boolean = false;

  // ── Map layers ──
  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  currentLayer: number = 0;
  readonly tileLayers: TiledLayer[] = [
    { name: 'Mappa', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap' },
    { name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri' },
    { name: 'Scuro', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '&copy; CARTO' },
  ];

  // ── Map objects ──
  private checkpointMarkers: L.Marker[] = [];
  private routePolyline: L.Polyline | null = null;
  private geofenceCircle: L.Circle | null = null;
  private geofenceCenterMarker: L.Marker | null = null;
  private geofenceEditMarker: L.Marker | null = null;
  private liveMarker: L.Marker | null = null;
  private liveAccuracyCircle: L.Circle | null = null;
  private liveWatchId: number | null = null;
  private optimizedPolyline: L.Polyline | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dbService: DatabaseService,
    private gpsService: GpsService,
    private mapService: MapService,
    private weatherService: WeatherService,
    private exportService: RouteExportService,
    private routeOptimizer: RouteOptimizerService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.boxId = id ? Number(id) : 0;
    this.utenteId = localStorage.getItem('utente_id') || '';
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
    if (this.boxId && this.tipoProfilo === 'business') {
      this.caricaBoxInfo();
      this.caricaCheckpoints();
    }
  }

  ngAfterViewInit() { setTimeout(() => this.inizializzaMappa(), 400); }

  ngOnDestroy() {
    this.fermaLiveTracking();
    this.fermaPlayback();
    this.fermaTour();
    if (this.map) { this.map.remove(); this.map = null; }
  }

  tornaIndietro() { this.router.navigateByUrl('/home', { replaceUrl: true }); }

  // ─── FILTERED CHECKPOINTS ──────────────────────────

  get filteredCheckpoints(): any[] {
    if (!this.timeRangeStart && !this.timeRangeEnd) return this.checkpoints;
    const start = this.timeRangeStart ? new Date(this.timeRangeStart).getTime() : 0;
    const end = this.timeRangeEnd ? new Date(this.timeRangeEnd).getTime() : Infinity;
    return this.checkpoints.filter((cp: any) => {
      const t = cp.timestamp ? new Date(cp.timestamp).getTime() : 0;
      return t >= start && t <= end;
    });
  }

  get searchedCheckpoints(): any[] {
    if (!this.searchQuery) return this.filteredCheckpoints;
    const q = this.searchQuery.toLowerCase();
    return this.filteredCheckpoints.filter((cp: any) => {
      const label = (cp.label || '').toLowerCase();
      const ts = this.formatData(cp.timestamp).toLowerCase();
      const coords = `${cp.latitudine}, ${cp.longitudine}`.toLowerCase();
      return label.includes(q) || ts.includes(q) || coords.includes(q);
    });
  }

  get timelineCheckpoints(): any[] {
    return [...this.searchedCheckpoints].reverse();
  }

  // ─── DATA ──────────────────────────────────────────

  caricaBoxInfo() {
    if (!this.boxId) return;
    this.dbService.getBoxSingola(this.boxId).subscribe({
      next: (res: any) => {
        this.boxInfo = res.box;
        this.movingModeAttivo = res.box.moving_mode === 1;
        if (res.box.rif_armadio) this.caricaGeofence(res.box.rif_armadio);
      },
    });
  }

  caricaCheckpoints() {
    if (!this.boxId) return;
    this.isLoading = true;
    this.dbService.getCheckpoints(this.boxId).subscribe({
      next: (res: any) => {
        this.checkpoints = res.checkpoints || [];
        this.calcolaDistanzaTotale();
        this.isLoading = false;
        this.aggiornaMappa();
        this.aggiornaTimeRange();
        this.caricaMeteo();
      },
      error: () => { this.isLoading = false; },
    });
  }

  caricaGeofence(armadioId: number) {
    this.dbService.getGeofence(armadioId).subscribe({
      next: (res: any) => {
        if (res?.geofence) {
          this.geofence = res.geofence;
          this.gfLat = res.geofence.latitudine;
          this.gfLng = res.geofence.longitudine;
          this.gfRaggio = res.geofence.raggio_m || 100;
          this.gfAttivo = res.geofence.attivo === 1 || res.geofence.attivo === true;
          this.aggiornaGeofenceMappa();
        }
      },
    });
  }

  calcolaDistanzaTotale() {
    this.distanzaTotale = 0;
    for (let i = 1; i < this.checkpoints.length; i++) {
      this.distanzaTotale += this.gpsService.calcolaDistanzaMetri(
        this.checkpoints[i - 1].latitudine, this.checkpoints[i - 1].longitudine,
        this.checkpoints[i].latitudine, this.checkpoints[i].longitudine,
      );
    }
  }

  aggiornaTimeRange() {
    if (this.checkpoints.length === 0) return;
    const times = this.checkpoints.map((cp: any) => cp.timestamp ? new Date(cp.timestamp).getTime() : 0).filter((t: number) => t > 0);
    if (times.length === 0) return;
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    this.timeRangeStart = min.toISOString().slice(0, 10);
    this.timeRangeEnd = max.toISOString().slice(0, 10);
  }

  // ─── WEATHER ───────────────────────────────────────

  private async caricaMeteo() {
    if (this.checkpoints.length === 0) return;
    const last = this.checkpoints[this.checkpoints.length - 1];
    this.caricoMeteo = true;
    this.meteo = await this.weatherService.getMeteoAttuale(last.latitudine, last.longitudine);
    this.caricoMeteo = false;
  }

  // ─── MAP CORE ──────────────────────────────────────

  private inizializzaMappa() {
    if (!this.mapContainer?.nativeElement || this.map) return;
    this.map = this.mapService.inizializzaMappa(
      this.mapContainer.nativeElement,
      [41.9028, 12.4964],
      6,
    );
    this.cambiaLayer(0);
    setTimeout(() => this.map?.invalidateSize(), 200);
    if (this.checkpoints.length > 0) this.aggiornaMappa();
    if (this.geofence) this.aggiornaGeofenceMappa();
  }

  cambiaLayer(index: number) {
    if (!this.map) return;
    this.currentLayer = index;
    const prev = this.tileLayer;
    const t = this.tileLayers[index];
    this.tileLayer = this.mapService.creaTileLayer(this.map, t, prev || undefined);
  }

  toggleFullscreen() {
    this.fullscreen = !this.fullscreen;
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  // ─── CHECKPOINTS ON MAP ───────────────────────────

  aggiornaMappa() {
    if (!this.map) return;
    this.rimuoviCheckpointMarkers();
    if (this.checkpoints.length === 0) return;

    const latLngs: L.LatLngExpression[] = [];
    const colors = ['#7DC740', '#5A9E2A', '#3AABDB', '#1A7FA8', '#F59E0B'];

    this.checkpoints.forEach((cp, i) => {
      const latLng: L.LatLngExpression = [cp.latitudine, cp.longitudine];
      latLngs.push(latLng);
      const ci = Math.min(Math.floor((i / Math.max(this.checkpoints.length - 1, 1)) * (colors.length - 1)), colors.length - 1);
      const color = colors[ci];
      const extraClass = (i === 0 || i === this.checkpoints.length - 1) ? ' tb-marker-pin--edge' : '';

      const marker = this.mapService.creaMarkerNumerato(latLng, i + 1, color, extraClass);

      const dt = cp.timestamp ? new Date(cp.timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

      marker.bindPopup(`
        <div class="tb-popup">
          <div class="tb-popup-title">${cp.label || `Posizione #${i + 1}`}</div>
          <div class="tb-popup-row"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${dt}</span></div>
          <div class="tb-popup-row"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span>${Number(cp.latitudine).toFixed(6)}, ${Number(cp.longitudine).toFixed(6)}</span></div>
          ${cp.accuratezza ? `<div class="tb-popup-row"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg><span>Precisione: ±${Number(cp.accuratezza).toFixed(0)}m</span></div>` : ''}
          ${this.meteo && i === this.checkpoints.length - 1 ? `<div class="tb-popup-row"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/></svg><span>${this.meteo.temperatura}°C, vento ${this.meteo.vento} km/h</span></div>` : ''}
          <a class="tb-popup-link" href="${this.gpsService.buildGoogleMapsUrl(cp.latitudine, cp.longitudine)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Apri in Google Maps</a>
        </div>
      `, { closeButton: false, className: 'tb-popup-wrapper' });

      marker.on('click', () => marker.openPopup());
      marker.addTo(this.map!);
      this.checkpointMarkers.push(marker);
    });

    if (latLngs.length >= 2) {
      this.routePolyline = L.polyline(latLngs, {
        color: '#3AABDB', weight: 3, opacity: 0.7, dashArray: '8 6',
        lineCap: 'round', lineJoin: 'round',
      }).addTo(this.map);
    }

    this.aggiornaDecorazioniRotta();

    const group = L.featureGroup(this.checkpointMarkers);
    this.map.fitBounds(group.getBounds().pad(0.3));
  }

  private aggiornaDecorazioniRotta() {
    this.rimuoviDecorazioniRotta();
    if (this.checkpoints.length < 2 || !this.map) return;

    for (let i = 1; i < this.checkpoints.length; i++) {
      const from = this.checkpoints[i - 1];
      const to = this.checkpoints[i];
      const midLat = (Number(from.latitudine) + Number(to.latitudine)) / 2;
      const midLng = (Number(from.longitudine) + Number(to.longitudine)) / 2;
      const angle = Math.atan2(Number(to.longitudine) - Number(from.longitudine), Number(to.latitudine) - Number(from.latitudine));
      const deg = (angle * 180) / Math.PI;
      const arrow = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'tb-arrow-marker',
          html: `<div class="tb-arrow-icon" style="transform:rotate(${deg}deg)">➤</div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        }),
        interactive: false,
      }).addTo(this.map!);
      this.directionArrows.push(arrow);

      const dist = this.gpsService.calcolaDistanzaMetri(
        from.latitudine, from.longitudine,
        to.latitudine, to.longitudine,
      );
      const label = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'tb-label-marker',
          html: `<div class="tb-label-badge">${dist < 1000 ? dist.toFixed(0) + ' m' : (dist / 1000).toFixed(2) + ' km'}</div>`,
          iconSize: [60, 20], iconAnchor: [30, 10],
        }),
        interactive: false,
      }).addTo(this.map!);
      this.segmentLabels.push(label);
    }
  }

  private rimuoviDecorazioniRotta() {
    if (!this.map) return;
    this.directionArrows.forEach(a => this.map!.removeLayer(a));
    this.directionArrows = [];
    this.segmentLabels.forEach(l => this.map!.removeLayer(l));
    this.segmentLabels = [];
  }

  private rimuoviCheckpointMarkers() {
    if (!this.map) return;
    this.checkpointMarkers.forEach(m => this.map!.removeLayer(m));
    this.checkpointMarkers = [];
    this.rimuoviDecorazioniRotta();
    if (this.routePolyline) { this.map.removeLayer(this.routePolyline); this.routePolyline = null; }
    if (this.optimizedPolyline) { this.map.removeLayer(this.optimizedPolyline); this.optimizedPolyline = null; }
  }

  // ─── GEOFENCE ──────────────────────────────────────

  private aggiornaGeofenceMappa() {
    if (!this.map || !this.geofence) { this.rimuoviGeofenceLayer(); return; }
    this.rimuoviGeofenceLayer();
    const center: L.LatLngExpression = [this.geofence.latitudine, this.geofence.longitudine];
    const raggio = this.geofence.raggio_m || 100;

    this.geofenceCircle = this.mapService.creaCerchioGeofence(center, raggio, {
      colore: '#7DC740', fillOpacity: 0.08, dashArray: '4 4',
    }).addTo(this.map);

    this.geofenceCircle.bindPopup(`<div class="tb-popup"><div class="tb-popup-title">Geofence</div><div class="tb-popup-row">Raggio: ${raggio >= 1000 ? (raggio / 1000).toFixed(1) + ' km' : raggio + ' m'}</div><div class="tb-popup-row">Stato: ${this.geofence.attivo ? '<span style="color:#7DC740">Attivo</span>' : '<span style="color:#EF4444">Disattivo</span>'}</div></div>`, { className: 'tb-popup-wrapper' });

    this.geofenceCenterMarker = this.mapService.creaMarkerGeofence(center, false).addTo(this.map);
  }

  private rimuoviGeofenceLayer() {
    if (!this.map) return;
    if (this.geofenceCircle) { this.map.removeLayer(this.geofenceCircle); this.geofenceCircle = null; }
    if (this.geofenceCenterMarker) { this.map.removeLayer(this.geofenceCenterMarker); this.geofenceCenterMarker = null; }
  }

  avviaEditGeofence() {
    this.editingGeofence = true;
    if (!this.map) return;

    if (!this.gfLat || !this.gfLng) {
      if (this.checkpoints.length > 0) {
        this.gfLat = Number(this.checkpoints[0].latitudine);
        this.gfLng = Number(this.checkpoints[0].longitudine);
      }
    }

    this.aggiornaEditMarker();

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.editingGeofence) return;
      this.gfLat = e.latlng.lat;
      this.gfLng = e.latlng.lng;
      this.aggiornaEditMarker();
    });
  }

  private aggiornaEditMarker() {
    if (!this.map || !this.gfLat || !this.gfLng) return;
    if (this.geofenceEditMarker) { this.map.removeLayer(this.geofenceEditMarker); }

    const center: L.LatLngExpression = [this.gfLat, this.gfLng];
    this.geofenceEditMarker = this.mapService.creaMarkerGeofence(center, true).addTo(this.map);

    this.geofenceEditMarker.on('dragend', () => {
      const pos = this.geofenceEditMarker!.getLatLng();
      this.gfLat = pos.lat;
      this.gfLng = pos.lng;
    });

    this.map.setView(center, 14);
  }

  annullaEditGeofence() {
    this.editingGeofence = false;
    this.map?.off('click');
    if (this.geofenceEditMarker && this.map) { this.map.removeLayer(this.geofenceEditMarker); this.geofenceEditMarker = null; }
    if (this.boxInfo?.rif_armadio) this.caricaGeofence(this.boxInfo.rif_armadio);
    else this.rimuoviGeofenceLayer();
  }

  async salvaGeofence() {
    if (!this.gfLat || !this.gfLng || !this.boxInfo?.rif_armadio) return;
    this.isSavingGeofence = true;
    this.dbService.impostaGeofence(this.boxInfo.rif_armadio, this.gfLat, this.gfLng, this.gfRaggio, this.gfAttivo).subscribe({
      next: async (res: any) => {
        this.isSavingGeofence = false;
        this.editingGeofence = false;
        this.geofence = res?.geofence || { latitudine: this.gfLat, longitudine: this.gfLng, raggio_m: this.gfRaggio, attivo: this.gfAttivo ? 1 : 0 };
        this.aggiornaGeofenceMappa();
        if (this.geofenceEditMarker && this.map) { this.map.removeLayer(this.geofenceEditMarker); this.geofenceEditMarker = null; }
        this.map?.off('click');
        const toast = await this.toastCtrl.create({ message: 'Geofence salvato con successo', duration: 2000, color: 'success', position: 'bottom' });
        await toast.present();
      },
      error: async (err: any) => {
        this.isSavingGeofence = false;
        const toast = await this.toastCtrl.create({ message: 'Errore salvataggio geofence', duration: 2000, color: 'danger', position: 'bottom' });
        await toast.present();
      },
    });
  }

  async eliminaGeofenceConfirm() {
    if (!this.boxInfo?.rif_armadio) return;
    const alert = await this.alertCtrl.create({
      cssClass: 'tb-alert', header: 'Eliminare il geofence?',
      message: 'Il perimetro e la configurazione verranno rimossi.',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Elimina', role: 'destructive', handler: () => {
          this.dbService.eliminaGeofence(this.boxInfo.rif_armadio).subscribe({
            next: () => {
              this.geofence = null;
              this.gfLat = null; this.gfLng = null;
              this.gfRaggio = 100; this.gfAttivo = true;
              this.editingGeofence = false;
              this.rimuoviGeofenceLayer();
              if (this.geofenceEditMarker && this.map) { this.map.removeLayer(this.geofenceEditMarker); this.geofenceEditMarker = null; }
              this.map?.off('click');
            },
          });
        }},
      ],
    });
    await alert.present();
  }

  // ─── LIVE TRACKING ─────────────────────────────────

  async toggleLiveTracking() {
    if (this.liveAttivo) { this.fermaLiveTracking(); return; }
    if (!navigator.geolocation) return;
    this.liveAttivo = true;
    if (!this.map) { setTimeout(() => this.toggleLiveTracking(), 300); return; }
    if (!this.liveMarker) {
      // Marker live tracking — specifico di questa pagina (pulsazione CSS)
      this.liveMarker = L.marker([41.9028, 12.4964], {
        icon: L.divIcon({
          className: 'tb-marker-live',
          html: `<div class="tb-live-pulse"><div class="tb-live-dot"></div></div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        }),
      }).addTo(this.map);

      // Cerchio accuratezza live — stile unico non coperto da creaCerchioGeofence
      this.liveAccuracyCircle = L.circle([41.9028, 12.4964], {
        radius: 50, color: 'rgba(58,171,219,0.3)',
        fillColor: 'rgba(58,171,219,0.08)', fillOpacity: 1,
        weight: 1,
      }).addTo(this.map);
    }
    this.liveWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const ll: L.LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
        this.liveMarker?.setLatLng(ll);
        this.liveAccuracyCircle?.setLatLng(ll);
        this.liveAccuracyCircle?.setRadius(pos.coords.accuracy || 50);
        this.map?.setView(ll, 16);
      }, () => {},
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }

  fermaLiveTracking() {
    this.liveAttivo = false;
    if (this.liveWatchId !== null) { navigator.geolocation.clearWatch(this.liveWatchId); this.liveWatchId = null; }
    if (this.liveMarker && this.map) { this.map.removeLayer(this.liveMarker); this.liveMarker = null; }
    if (this.liveAccuracyCircle && this.map) { this.map.removeLayer(this.liveAccuracyCircle); this.liveAccuracyCircle = null; }
  }

  // ─── ROUTE PLAYBACK ────────────────────────────────

  avviaPlayback() {
    if (this.checkpoints.length < 2 || this.playing) return;
    this.playing = true;
    this.playIndex = 0;
    if (!this.playMarker) {
      // Marker playback — specifico di questa pagina (icona play triangolare)
      this.playMarker = L.marker([this.checkpoints[0].latitudine, this.checkpoints[0].longitudine], {
        icon: L.divIcon({
          className: 'tb-marker-play',
          html: `<div class="tb-play-pin"><svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg></div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        }),
        zIndexOffset: 1000,
      }).addTo(this.map!);
    }
    this.tickPlayback();
  }

  private tickPlayback() {
    if (!this.playing || !this.playMarker || this.playIndex >= this.checkpoints.length - 1) {
      this.playing = false;
      return;
    }
    const from = this.checkpoints[this.playIndex];
    const to = this.checkpoints[this.playIndex + 1];
    const steps = Math.max(10, Math.floor(this.playSpeed * 20));
    let step = 0;

    const animate = () => {
      if (!this.playing) return;
      const t = step / steps;
      const lat = Number(from.latitudine) + (Number(to.latitudine) - Number(from.latitudine)) * t;
      const lng = Number(from.longitudine) + (Number(to.longitudine) - Number(from.longitudine)) * t;
      this.playMarker?.setLatLng([lat, lng]);
      this.map?.setView([lat, lng], this.map.getZoom());
      step++;
      if (step <= steps) {
        this.playAnimId = requestAnimationFrame(animate);
      } else {
        this.playIndex++;
        if (this.playIndex < this.checkpoints.length - 1) {
          this.playAnimId = requestAnimationFrame(() => this.tickPlayback());
        } else {
          this.playing = false;
        }
      }
    };
    animate();
  }

  fermaPlayback() {
    this.playing = false;
    if (this.playAnimId) { cancelAnimationFrame(this.playAnimId); this.playAnimId = 0; }
    if (this.playMarker && this.map) { this.map.removeLayer(this.playMarker); this.playMarker = null; }
  }

  incrementSpeed() {
    this.playSpeed = Math.min(5, this.playSpeed + 0.5);
  }

  decrementSpeed() {
    this.playSpeed = Math.max(0.5, this.playSpeed - 0.5);
  }

  // ─── AMBIENT TOUR ──────────────────────────────────

  toggleTour() {
    if (this.ambientTour) { this.fermaTour(); return; }
    if (!this.map || this.checkpoints.length === 0) return;
    this.ambientTour = true;
    this.tourIndex = 0;
    this.tourInterval = setInterval(() => {
      if (!this.map || !this.ambientTour) { this.fermaTour(); return; }
      const cp = this.checkpoints[this.tourIndex];
      if (cp) {
        this.map.setView([cp.latitudine, cp.longitudine], 16, { animate: true });
        if (this.checkpointMarkers[this.tourIndex]) {
          this.checkpointMarkers[this.tourIndex].openPopup();
        }
      }
      this.tourIndex++;
      if (this.tourIndex >= this.checkpoints.length) {
        this.tourIndex = 0;
      }
    }, 3000);
  }

  fermaTour() {
    this.ambientTour = false;
    if (this.tourInterval) { clearInterval(this.tourInterval); this.tourInterval = null; }
  }

  // ─── DISTANCE MEASURE ──────────────────────────────

  toggleMeasure() {
    this.measuring = !this.measuring;
    if (!this.measuring) { this.rimuoviMisurazione(); return; }
    if (!this.map) return;
    this.map.getContainer().style.cursor = 'crosshair';
    this.map.on('click', (e: L.LeafletMouseEvent) => this.aggiungiPuntoMisura(e.latlng));
  }

  private aggiungiPuntoMisura(latlng: L.LatLng) {
    if (!this.map) return;
    this.measurePoints.push(latlng);

    // Marker misurazione — specifico di questa pagina (pallino numerato)
    const marker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'tb-marker-measure',
        html: `<div class="tb-measure-dot">${this.measurePoints.length}</div>`,
        iconSize: [22, 22], iconAnchor: [11, 11],
      }),
    }).addTo(this.map);
    this.measureMarkers.push(marker);

    if (this.measurePoints.length >= 2) {
      if (this.measureLine) this.map.removeLayer(this.measureLine);
      this.measureLine = L.polyline(this.measurePoints, {
        color: '#EF4444', weight: 2, dashArray: '6 4', opacity: 0.8,
      }).addTo(this.map);

      this.measureDistance = 0;
      for (let i = 1; i < this.measurePoints.length; i++) {
        this.measureDistance += this.measurePoints[i - 1].distanceTo(this.measurePoints[i]);
      }

      if (this.measureLabel) this.map.removeLayer(this.measureLabel);
      const midIdx = Math.floor(this.measurePoints.length / 2);
      const mid = this.measurePoints[midIdx];
      this.measureLabel = L.marker(mid, {
        icon: L.divIcon({
          className: 'tb-measure-label',
          html: `<div class="tb-measure-badge">${this.measureDistance < 1000 ? this.measureDistance.toFixed(0) + ' m' : (this.measureDistance / 1000).toFixed(2) + ' km'}</div>`,
          iconSize: [80, 24], iconAnchor: [40, 12],
        }),
      }).addTo(this.map);
    }
  }

  annullaMisurazione() {
    this.rimuoviMisurazione();
    this.measuring = false;
  }

  private rimuoviMisurazione() {
    if (!this.map) return;
    this.map.getContainer().style.cursor = '';
    this.map.off('click');
    this.measureMarkers.forEach(m => this.map!.removeLayer(m));
    this.measureMarkers = [];
    if (this.measureLine) { this.map.removeLayer(this.measureLine); this.measureLine = null; }
    if (this.measureLabel) { this.map.removeLayer(this.measureLabel); this.measureLabel = null; }
    this.measurePoints = [];
    this.measureDistance = 0;
  }

  // ─── ROUTE OPTIMIZATION ────────────────────────────

  ottimizzaPercorso() {
    if (this.checkpoints.length < 3) return;
    const order = this.routeOptimizer.ottimizzaOrdine(
      this.checkpoints,
      (lat1, lng1, lat2, lng2) => this.gpsService.calcolaDistanzaMetri(lat1, lng1, lat2, lng2),
    );

    const optLatLngs = order.map(i => [this.checkpoints[i].latitudine, this.checkpoints[i].longitudine] as L.LatLngExpression);
    if (!this.map) return;

    if (this.optimizedPolyline) this.map.removeLayer(this.optimizedPolyline);
    this.optimizedPolyline = L.polyline(optLatLngs, {
      color: '#F59E0B', weight: 4, opacity: 0.9,
      lineCap: 'round', lineJoin: 'round',
    }).addTo(this.map);

    this.toastCtrl.create({
      message: 'Percorso ottimizzato in giallo. Ordine originale in blu tratteggiato.',
      duration: 3000, color: 'warning', position: 'bottom',
    }).then(t => t.present());
  }

  nascondiOttimizzazione() {
    if (this.optimizedPolyline && this.map) {
      this.map.removeLayer(this.optimizedPolyline);
      this.optimizedPolyline = null;
    }
  }

  // ─── EXPORT ────────────────────────────────────────

  esportaGeoJSON() {
    if (this.checkpoints.length === 0) return;
    const content = this.exportService.generaGeoJSON(this.checkpoints);
    this.scaricaFile(content, `tracking-box-${this.boxId}.geojson`, 'application/geo+json');
  }

  esportaGPX() {
    if (this.checkpoints.length === 0) return;
    const content = this.exportService.generaGPX(this.checkpoints);
    this.scaricaFile(content, `tracking-box-${this.boxId}.gpx`, 'application/gpx+xml');
  }

  esportaCSV() {
    if (this.checkpoints.length === 0) return;
    const content = this.exportService.generaCSV(this.checkpoints);
    this.scaricaFile(content, `tracking-box-${this.boxId}.csv`, 'text/csv');
  }

  esportaKML() {
    if (this.checkpoints.length === 0) return;
    const content = this.exportService.generaKML(this.checkpoints, this.boxId);
    this.scaricaFile(content, `tracking-box-${this.boxId}.kml`, 'application/vnd.google-earth.kml+xml');
  }

  private scaricaFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── STATISTICS ────────────────────────────────────

  get statsList(): StatItem[] {
    const list: StatItem[] = [];
    if (this.checkpoints.length === 0) return list;

    list.push({ label: 'Checkpoint totali', value: `${this.checkpoints.length}`, icon: 'marker' });
    list.push({ label: 'Distanza totale', value: this.formatDistanza(this.distanzaTotale), icon: 'route' });

    const times = this.checkpoints
      .map((cp: any) => cp.timestamp ? new Date(cp.timestamp).getTime() : 0)
      .filter((t: number) => t > 0);

    if (times.length >= 2) {
      const durataMs = Math.max(...times) - Math.min(...times);
      const ore = Math.floor(durataMs / 3600000);
      const min = Math.floor((durataMs % 3600000) / 60000);
      list.push({ label: 'Durata monitoraggio', value: `${ore}h ${min}m`, icon: 'clock' });

      const diffMedio = this.distanzaTotale / (this.checkpoints.length - 1);
      list.push({ label: 'Distanza media tra CP', value: this.formatDistanza(diffMedio), icon: 'avg' });

      const tempoMedio = durataMs / (this.checkpoints.length - 1);
      const tMin = Math.round(tempoMedio / 60000);
      list.push({ label: 'Tempo medio tra CP', value: `${tMin} min`, icon: 'timer' });
    }

    if (this.distanzaTotale > 0 && times.length >= 2) {
      const durataH = (Math.max(...times) - Math.min(...times)) / 3600000;
      if (durataH > 0) {
        const velocitaMedia = (this.distanzaTotale / 1000) / durataH;
        list.push({ label: 'Velocita media', value: `${velocitaMedia.toFixed(1)} km/h`, icon: 'speed' });
      }
    }

    const oreCount: { [key: number]: number } = {};
    const giorniCount: { [key: string]: number } = {};
    this.checkpoints.forEach((cp: any) => {
      if (!cp.timestamp) return;
      const d = new Date(cp.timestamp);
      const h = d.getHours();
      oreCount[h] = (oreCount[h] || 0) + 1;
      const g = d.toLocaleDateString('it-IT', { weekday: 'long' });
      giorniCount[g] = (giorniCount[g] || 0) + 1;
    });

    if (Object.keys(oreCount).length > 0) {
      const maxOra = Object.entries(oreCount).sort((a, b) => b[1] - a[1])[0];
      list.push({ label: `Ora piu frequente`, value: `${maxOra[0]}:00 (${maxOra[1]}x)`, icon: 'hour' });
    }

    if (Object.keys(giorniCount).length > 0) {
      const maxGiorno = Object.entries(giorniCount).sort((a, b) => b[1] - a[1])[0];
      list.push({ label: 'Giorno piu attivo', value: `${maxGiorno[0]} (${maxGiorno[1]}x)`, icon: 'cal' });
    }

    const prec = this.checkpoints.filter((cp: any) => cp.accuratezza && cp.accuratezza < 20).length;
    if (prec > 0) {
      list.push({ label: 'Checkpoint alta precisione', value: `${prec} (<20m)`, icon: 'target' });
    }

    return list;
  }

  // ─── ACTIONS ───────────────────────────────────────

  async aggiungiCheckpointManuale() {
    try {
      const pos = await this.gpsService.getPosizione();
      const alert = await this.alertCtrl.create({
        cssClass: 'tb-alert', header: 'Etichetta posizione',
        message: 'Aggiungi una descrizione opzionale per questo checkpoint.',
        inputs: [{ name: 'label', type: 'text', placeholder: 'Es. Magazzino Milano' }],
        buttons: [
          { text: 'Annulla', role: 'cancel' },
          { text: 'Salva', handler: (data) => {
            this.dbService.salvaCheckpointSicuro(this.boxId, pos.latitudine, pos.longitudine, pos.accuratezza, data.label || undefined).subscribe({
              next: async (res: any) => {
                this.caricaCheckpoints();
                if (res.geofence_alert) {
                  (await this.alertCtrl.create({ cssClass: 'tb-alert tb-alert--danger', header: 'Eccezione di sicurezza', message: res.geofence_alert.messaggio, buttons: ['OK'] })).present();
                } else {
                  (await this.toastCtrl.create({ message: 'Posizione registrata', duration: 2000, color: 'success', position: 'bottom' })).present();
                }
              },
            });
          }},
        ],
      });
      await alert.present();
    } catch (err: any) {
      (await this.alertCtrl.create({ cssClass: 'tb-alert', header: 'GPS non disponibile', message: err.message || 'Impossibile ottenere la posizione.', buttons: ['OK'] })).present();
    }
  }

  async toggleMovingMode() {
    const nuovo = !this.movingModeAttivo;
    this.dbService.updateMovingMode(this.boxId, nuovo).subscribe({
      next: async () => {
        this.movingModeAttivo = nuovo;
        (await this.toastCtrl.create({ message: nuovo ? 'Moving Mode attivato' : 'Moving Mode disattivato', duration: 2500, color: nuovo ? 'success' : 'medium', position: 'bottom' })).present();
      },
    });
  }

  apriGoogleMaps(lat: number, lng: number) { window.open(this.gpsService.buildGoogleMapsUrl(lat, lng), '_blank'); }

  apriPercorsoCompleto() {
    if (this.checkpoints.length < 2) return;
    window.open(this.gpsService.buildPercorsoUrl(this.checkpoints), '_blank');
  }

  async confermaResetTracking() {
    const alert = await this.alertCtrl.create({
      cssClass: 'tb-alert', header: 'Eliminare tutti i checkpoint?',
      message: 'Questa operazione e irreversibile.',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Elimina storico', role: 'destructive', handler: () => {
          this.dbService.eliminaCheckpoints(this.boxId).subscribe({
            next: () => { this.checkpoints = []; this.distanzaTotale = 0; this.meteo = null; this.aggiornaMappa(); },
          });
        }},
      ],
    });
    await alert.present();
  }

  async modificaLabelCheckpoint(cp: any, nuovoLabel: string) {
    if (!cp.id || !nuovoLabel.trim()) return;
    this.dbService.aggiornaCheckpointLabel ? this.dbService.aggiornaCheckpointLabel(cp.id, cp.box_id, nuovoLabel.trim()).subscribe({
      next: () => {
        cp.label = nuovoLabel.trim();
        this.toastCtrl.create({ message: 'Etichetta aggiornata', duration: 1500, color: 'success', position: 'bottom' }).then(t => t.present());
      },
    }) : null;
  }

  async mostraMeteoDetail() {
    if (!this.meteo) {
      this.caricaMeteo();
      return;
    }
    const alert = await this.alertCtrl.create({
      cssClass: 'tb-alert',
      header: 'Meteo all\'ultimo checkpoint',
      message: `Temperatura: ${this.meteo.temperatura}°C\nVento: ${this.meteo.vento} km/h\nOra rilevamento: ${this.meteo.ora}`,
      buttons: ['OK'],
    });
    await alert.present();
  }

  // ─── HELPERS ───────────────────────────────────────

  formatData(ts: string): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  formatDistanza(m: number): string {
    if (m < 1000) return `${m.toFixed(0)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  }
}
