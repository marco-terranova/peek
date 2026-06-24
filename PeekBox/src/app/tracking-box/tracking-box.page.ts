import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { GpsService } from '../services/gps';

@Component({
  selector: 'app-tracking-box',
  templateUrl: './tracking-box.page.html',
  styleUrls: ['./tracking-box.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class TrackingBoxPage implements OnInit {
  boxId!: number;
  utenteId = '';
  tipoProfilo = 'personal';

  boxInfo: any = null;
  checkpoints: any[] = [];
  distanzaTotale = 0;
  isLoading = false;

  showStats = false;
  statsList: { label: string; value: string }[] = [];
  showSearch = false;
  searchQuery = '';
  searchedCheckpoints: any[] = [];
  get timelineCheckpoints(): any[] { return this.searchedCheckpoints; }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dbService: DatabaseService,
    private gpsService: GpsService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const parsed = idParam ? Number(idParam) : NaN;
    this.boxId = !isNaN(parsed) ? parsed : 0;
    this.utenteId = localStorage.getItem('utente_id') || '';
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
    if (this.tipoProfilo === 'business' && this.boxId > 0) {
      this.caricaBoxInfo();
      this.caricaCheckpoints();
    }
  }

  vai(route: string) {
    this.router.navigateByUrl(route, { replaceUrl: true });
  }

  caricaBoxInfo() {
    if (!this.boxId) return;
    this.dbService.getBoxSingola(this.boxId).subscribe({
      next: (res: any) => { this.boxInfo = res.box; },
    });
  }

  caricaCheckpoints() {
    if (!this.boxId) return;
    this.isLoading = true;
    this.dbService.getCheckpoints(this.boxId).subscribe({
      next: (res: any) => {
        this.checkpoints = res.checkpoints || [];
        this.isLoading = false;
        this.aggiornaStatistiche();
        this.aggiornaFiltroRicerca();
      },
      error: () => { this.isLoading = false; },
    });
  }

  aggiornaStatistiche() {
    const cps = this.checkpoints;
    this.distanzaTotale = 0;
    for (let i = 1; i < cps.length; i++) {
      this.distanzaTotale += this.calcolaDistanza(
        cps[i - 1].latitudine, cps[i - 1].longitudine,
        cps[i].latitudine, cps[i].longitudine
      );
    }
    this.statsList = [
      { label: 'Checkpoint', value: String(cps.length) },
      { label: 'Distanza percorsa', value: this.formatDistanza(this.distanzaTotale) },
      { label: 'Ultimo aggiornamento', value: cps.length ? this.formatData(cps[cps.length - 1].timestamp) : '—' },
    ];
  }

  aggiornaFiltroRicerca() {
    const q = this.searchQuery?.toLowerCase().trim() || '';
    if (!q) {
      this.searchedCheckpoints = [...this.checkpoints];
      return;
    }
    this.searchedCheckpoints = this.checkpoints.filter((cp) =>
      (cp.label || '').toLowerCase().includes(q) ||
      (cp.timestamp || '').toLowerCase().includes(q) ||
      String(cp.latitudine).includes(q) ||
      String(cp.longitudine).includes(q)
    );
  }

  onSearchChange() {
    this.aggiornaFiltroRicerca();
  }

  async aggiungiCheckpointManuale() {
    if (!this.boxId || this.boxId <= 0) return;
    try {
      const pos = await this.gpsService.getPosizione();
      const alert = await this.alertCtrl.create({
        cssClass: 'tb-alert', header: 'Etichetta posizione',
        message: 'Aggiungi una descrizione opzionale per questo checkpoint.',
        inputs: [{ name: 'label', type: 'text', placeholder: 'Es. Magazzino Milano' }],
        buttons: [
          { text: 'Annulla', role: 'cancel' },
          {
            text: 'Salva', handler: (data: any) => {
              this.dbService.salvaCheckpointSicuro(this.boxId, pos.latitudine, pos.longitudine, pos.accuratezza, data.label || undefined).subscribe({
                next: async (res: any) => {
                  this.caricaCheckpoints();
                  if (res.geofence_alert) {
                    (await this.alertCtrl.create({
                      cssClass: 'tb-alert tb-alert--danger', header: 'Eccezione di sicurezza',
                      message: res.geofence_alert.messaggio, buttons: ['OK'],
                    })).present();
                  } else {
                    (await this.toastCtrl.create({
                      message: 'Posizione registrata', duration: 2000, color: 'success', position: 'bottom',
                    })).present();
                  }
                },
              });
            },
          },
        ],
      });
      await alert.present();
    } catch (err: any) {
      (await this.alertCtrl.create({
        cssClass: 'tb-alert', header: 'GPS non disponibile',
        message: err.message || 'Impossibile ottenere la posizione.', buttons: ['OK'],
      })).present();
    }
  }

  apriGoogleMaps(lat: number, lng: number) {
    window.open(this.gpsService.buildGoogleMapsUrl(lat, lng), '_blank');
  }

  apriPercorsoCompleto() {
    if (this.checkpoints.length < 2) return;
    window.open(this.gpsService.buildPercorsoUrl(this.checkpoints), '_blank');
  }

  async confermaResetTracking() {
    if (!this.boxId || this.boxId <= 0) return;
    const alert = await this.alertCtrl.create({
      cssClass: 'tb-alert', header: 'Eliminare tutti i checkpoint?',
      message: 'Questa operazione è irreversibile.',
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina storico', role: 'destructive',
          handler: () => {
            this.dbService.eliminaCheckpoints(this.boxId).subscribe({
              next: () => {
                this.checkpoints = [];
                this.aggiornaStatistiche();
                this.aggiornaFiltroRicerca();
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  formatData(ts: string): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  formatDistanza(m: number): string {
    if (m < 1000) return `${m.toFixed(0)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  }

  private calcolaDistanza(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
