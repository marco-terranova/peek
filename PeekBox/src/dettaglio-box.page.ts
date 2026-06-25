import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { IonContent, AlertController, ToastController } from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { MapService } from '../services/map';

import * as QRCode from 'qrcode';
import * as L from 'leaflet';

interface CategoriaCatalogo {
  id: number;
  slug: string;
  nome: string;
}

@Component({
  selector: 'app-dettaglio-box',
  templateUrl: './dettaglio-box.page.html',
  styleUrls: ['./dettaglio-box.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IonContent]
})
export class DettaglioBoxPage implements OnInit {

  private readonly capacitaMap: { [key: string]: number } = { piccola: 10, media: 20, grande: 30, pallet: 100 };

  get MAX_OGGETTI(): number {
    return this.capacitaMap[this.box?.dimensione] || 10;
  }

  get isBoxPiena(): boolean {
    return this.totaleElementi >= this.MAX_OGGETTI;
  }

  boxId!: number;
  box: any = null;
  oggetti: any[] = [];
  isLoading = true;
  isViewer = false;
  tipoProfilo = 'personal';
  ultimoCheckpoint: any = null;

  @ViewChild('detMapContainer') detMapContainer!: ElementRef<HTMLElement>;
  @ViewChild('catTrigger') catTrigger!: ElementRef<HTMLElement>;
  @ViewChild('qrCanvas') qrCanvas!: ElementRef<HTMLCanvasElement>;
  private map: L.Map | null = null;

  mostraCatDropdown = false;
  catDropdownStyle: { [key: string]: string } = {};

  searchQuery = '';

  objectFormOpen = false;
  editingObject: any = null;
  formNome = '';
  formTipo = '';
  formQuantita = 1;
  formFragile = false;
  formDescrizione = '';
  formFoto: string | null = null;
  isSaving = false;

  isLoadingQr = false;
  qrGenerato = false;

  categorie: CategoriaCatalogo[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dbService: DatabaseService,
    private mapService: MapService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    this.caricaCategorie();
  }

  ionViewWillEnter() {
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
    const id = this.route.snapshot.paramMap.get('id');
    const parsed = id ? Number(id) : NaN;
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      this.toast('ID box non valido.', 'danger');
      this.router.navigate(['/home']);
      return;
    }
    this.boxId = parsed;
    this.qrGenerato = false;
    this.isLoadingQr = false;
    this.ultimoCheckpoint = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.caricaDati();
  }

  private caricaCategorie() {
    this.dbService.getCatalogoCategorie().subscribe({
      next: (res: any) => { this.categorie = res.categorie || []; },
      error: () => {}
    });
  }

  caricaDati() {
    this.isLoading = true;
    this.dbService.getBoxSingola(this.boxId).subscribe({
      next: (res: any) => {
        this.box = res.box;
        this.isViewer = this.box?.ruolo_condivisione === 'viewer';
        this.caricaOggetti();
        setTimeout(() => this.generaQr(), 300);
        if (this.box?.moving_mode && this.tipoProfilo === 'business') {
          this.caricaCheckpoints();
        }
      },
      error: () => { this.isLoading = false; this.toast('Impossibile caricare il box.', 'danger'); }
    });
  }

  private caricaCheckpoints() {
    this.dbService.getCheckpoints(this.boxId).subscribe({
      next: (res: any) => {
        const cps = res.checkpoints || [];
        this.ultimoCheckpoint = cps.length > 0 ? cps[cps.length - 1] : null;
        if (this.ultimoCheckpoint) {
          setTimeout(() => this.inizializzaMappa(cps), 300);
        }
      },
      error: () => {}
    });
  }

  private inizializzaMappa(checkpoints: any[]) {
    if (!this.detMapContainer?.nativeElement || this.map) return;
    const ultimo = checkpoints[checkpoints.length - 1];
    this.map = this.mapService.inizializzaMappa(
      this.detMapContainer.nativeElement,
      [ultimo.latitudine, ultimo.longitudine],
      14
    );
    this.mapService.creaTileLayer(this.map, {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr: '&copy; OpenStreetMap'
    });

    const coords: L.LatLngExpression[] = [];
    checkpoints.forEach((cp, i) => {
      const latlng: L.LatLngExpression = [cp.latitudine, cp.longitudine];
      coords.push(latlng);
      const isLast = i === checkpoints.length - 1;
      const color = isLast ? '#7DC740' : '#3AABDB';
      L.circleMarker(latlng, {
        radius: isLast ? 10 : 7,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(this.map!)
        .bindPopup(`<b>${isLast ? 'Posizione attuale' : 'Checkpoint ' + (i + 1)}</b><br>${cp.label || ''}<br><small>${cp.timestamp || ''}</small>`);
    });

    if (coords.length > 1) {
      L.polyline(coords, { color: '#3AABDB', weight: 3, opacity: 0.6, dashArray: '8, 6' }).addTo(this.map!);
      this.map!.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }

  caricaOggetti() {
    this.dbService.getOggettiPerBox(this.boxId).subscribe({
      next: (res: any) => { this.oggetti = res.oggetti || []; this.isLoading = false; },
      error: () => { this.oggetti = []; this.isLoading = false; }
    });
  }

  get filteredOggetti(): any[] {
    if (!this.searchQuery) return this.oggetti;
    const q = this.searchQuery.toLowerCase();
    return this.oggetti.filter((o: any) =>
      (o.nome || '').toLowerCase().includes(q) ||
      (o.tipo || '').toLowerCase().includes(q) ||
      (o.descrizione || '').toLowerCase().includes(q)
    );
  }

  get saturazionePercent(): number {
    return Math.min(100, Math.round((this.oggetti.length / this.MAX_OGGETTI) * 100));
  }

  get numFragili(): number {
    return this.oggetti.filter((o: any) => o.fragile == 1).length;
  }

  get totaleElementi(): number {
    return this.oggetti.reduce((sum: number, o: any) => sum + (o.quantita || 1), 0);
  }

  togglePreferito() {
    if (!this.box || this.isViewer) return;
    const newVal = !this.box.is_preferito;
    this.dbService.updatePreferito(this.boxId, newVal).subscribe({
      next: () => { this.box.is_preferito = newVal; this.toast(newVal ? 'Aggiunto ai preferiti' : 'Rimosso dai preferiti', 'primary'); },
      error: () => this.toast('Errore aggiornamento preferito.', 'danger')
    });
  }

  apriFormOggetto(obj?: any) {
    if (this.isViewer) return;
    this.objectFormOpen = true;
    this.editingObject = obj || null;
    this.formNome = obj?.nome || '';
    this.formTipo = obj?.tipo || '';
    this.formQuantita = obj?.quantita || 1;
    this.formFragile = obj?.fragile === 1;
    this.formDescrizione = obj?.descrizione || '';
    this.formFoto = obj?.foto || null;
  }

  chiudiFormOggetto() {
    this.objectFormOpen = false;
    this.editingObject = null;
    this.resetForm();
  }

  resetForm() {
    this.formNome = '';
    this.formTipo = '';
    this.formQuantita = 1;
    this.formFragile = false;
    this.formDescrizione = '';
    this.formFoto = null;
  }

  salvaOggetto() {
    if (!this.formNome.trim()) { this.toast('Il nome è obbligatorio.', 'warning'); return; }
    this.isSaving = true;
    const dati: any = {
      nome: this.formNome.trim(),
      tipo: this.formTipo.trim() || null,
      quantita: Number(this.formQuantita) || 1,
      fragile: this.formFragile ? 1 : 0,
      descrizione: this.formDescrizione.trim() || null,
      foto: this.formFoto || null,
      rif_box: this.boxId
    };
    if (this.editingObject) {
      this.dbService.aggiornaOggetto(this.editingObject.id, dati).subscribe({
        next: () => { this.isSaving = false; this.caricaOggetti(); this.chiudiFormOggetto(); this.toast('Oggetto aggiornato!', 'success'); },
        error: (err: any) => { this.isSaving = false; this.toast(err.error?.error || 'Errore aggiornamento.', 'danger'); }
      });
    } else {
      this.dbService.creaOggetto(dati).subscribe({
        next: () => { this.isSaving = false; this.caricaOggetti(); this.chiudiFormOggetto(); this.toast('Oggetto aggiunto!', 'success'); },
        error: (err: any) => { this.isSaving = false; this.toast(err.error?.error || 'Errore inserimento.', 'danger'); }
      });
    }
  }

  async eliminaOggetto(o: any) {
    if (this.isViewer) return;
    const alert = await this.alertCtrl.create({
      cssClass: 'db-alert',
      header: 'Elimina oggetto',
      message: `Eliminare "${o.nome}"? Verrà spostato nel cestino.`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Elimina', role: 'destructive', handler: () => {
          this.dbService.eliminaOggetto(o.id).subscribe({
            next: () => { this.caricaOggetti(); this.toast('Oggetto eliminato.', 'medium'); },
            error: () => this.toast("Errore durante l'eliminazione.", 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }

  async svuotaBox() {
    if (this.isViewer) return;
    if (this.oggetti.length === 0) { this.toast('Il box è già vuoto.', 'medium'); return; }
    const alert = await this.alertCtrl.create({
      cssClass: 'db-alert',
      header: 'Svuota Box',
      message: `Stai per eliminare tutti i ${this.oggetti.length} oggetti. Operazione irreversibile.`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Svuota tutto', role: 'destructive', handler: () => {
          this.dbService.svuotaBox(this.boxId).subscribe({
            next: () => { this.caricaOggetti(); this.toast('Box svuotato.', 'success'); },
            error: (err: any) => { this.toast(err.error?.error || 'Errore svuotamento.', 'danger'); }
          });
        }}
      ]
    });
    await alert.present();
  }

  async apriSceltaFoto() {
    try {
      const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64, source: CameraSource.Photos, quality: 90
      });
      if (photo.base64String) { this.formFoto = `data:image/jpeg;base64,${photo.base64String}`; }
    } catch {
      const input = document.getElementById('db-foto-input') as HTMLInputElement;
      if (input) input.click();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => { this.formFoto = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  rimuoviFoto(event: Event) {
    event.stopPropagation();
    this.formFoto = null;
    const input = document.getElementById('db-foto-input') as HTMLInputElement;
    if (input) input.value = '';
  }

  generaQr() {
    this.isLoadingQr = true;
    this.qrGenerato = false;
    this.dbService.getQrToken(this.boxId).subscribe({
      next: async (res: any) => {
        const url = this.dbService.buildQrUrl(this.boxId, res.token);
        setTimeout(async () => {
          try {
            const canvas = this.qrCanvas?.nativeElement;
            if (canvas) {
              await QRCode.toCanvas(canvas, url, {
                width: 200, margin: 2,
                color: { dark: '#0F172A', light: '#FFFFFF' }
              });
              this.qrGenerato = true;
            }
          } catch {
            this.toast('Errore generazione QR.', 'danger');
          }
          this.isLoadingQr = false;
        }, 100);
      },
      error: () => { this.isLoadingQr = false; this.toast('Impossibile generare il QR.', 'danger'); }
    });
  }

  scaricaQr() {
    const canvas = this.qrCanvas?.nativeElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `QR_Box_${this.boxId}_${this.box?.nome || 'box'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast('QR Code scaricato!', 'success');
  }

  async condividiLink() {
    const url = window.location.origin + `/dettaglio-box/${this.boxId}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      this.toast('Link copiato negli appunti!', 'success');
    } else {
      this.toast(url, 'medium');
    }
  }

  apriGeofence() {
    if (!this.box?.rif_armadio) { this.toast('ID armadio non disponibile.', 'warning'); return; }
    this.router.navigate(['/geofence-armadio', this.box.rif_armadio], {
      queryParams: { nome: this.box.nome_armadio || '', boxId: this.boxId }
    });
  }

  apriTracking() {
    this.router.navigate(['/tracking-box']);
  }

  toggleCatDropdown() {
    this.mostraCatDropdown = !this.mostraCatDropdown;
    if (this.mostraCatDropdown) {
      this.updateCatDropdownPosition();
    }
  }

  chiudiCatDropdown() {
    this.mostraCatDropdown = false;
  }

  selezionaCategoria(nome: string) {
    this.formTipo = nome;
    this.mostraCatDropdown = false;
  }

  async aggiungiCategoria(event: Event) {
    event.preventDefault();
    const alert = await this.alertCtrl.create({
      cssClass: ['peekbox-alert', 'peekbox-alert--slim'],
      header: 'Nuova Categoria',
      inputs: [{ name: 'nome', type: 'text', placeholder: 'Es. Elettronica, Vestiti...' }],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Aggiungi',
          handler: (dati) => {
            if (dati.nome?.trim()) {
              this.dbService.creaCategoria(dati.nome.trim()).subscribe({
                next: (res: any) => {
                  this.caricaCategorie();
                  this.formTipo = res.nome || dati.nome.trim();
                },
                error: (err: any) => this.toast(err.error?.error || 'Errore creazione categoria.', 'danger')
              });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private updateCatDropdownPosition() {
    if (!this.catTrigger) return;
    const rect = this.catTrigger.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuMaxH = 200;
    if (spaceBelow < menuMaxH && rect.top > spaceBelow) {
      this.catDropdownStyle = {
        left: rect.left + 'px',
        width: rect.width + 'px',
        bottom: (window.innerHeight - rect.top + 4) + 'px',
        top: 'auto',
      };
    } else {
      this.catDropdownStyle = {
        left: rect.left + 'px',
        width: rect.width + 'px',
        top: (rect.bottom + 4) + 'px',
        bottom: 'auto',
      };
    }
  }

  tornaIndietro() {
    this.router.navigate(['/home']);
  }

  private async toast(message: string, color = 'primary') {
    const t = await this.toastCtrl.create({ message, duration: 2400, color, position: 'bottom' });
    await t.present();
  }
}
