import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { DatabaseService } from '../services/database';
import { PbDropdownComponent } from '../components/pb-dropdown/pb-dropdown.component';

@Component({
  selector: 'app-transit-zone',
  templateUrl: './transit-zone.page.html',
  styleUrls: ['./transit-zone.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, PbDropdownComponent]
})
export class TransitZonePage implements OnInit, OnDestroy {

  nomeUtente: string = '';
  utenteId: string | null = null;

  tutteLeBox: any[] = [];

  boxSorgente:     any = null;
  boxDestinazione: any = null;

  boxSorgenteId:     number | null = null;
  boxDestinazioneId: number | null = null;

  oggettiSorgente:     any[] = [];
  oggettiDestinazione: any[] = [];

  isLoading      = false;
  isSaving       = false;
  isTransferring = false;

  draggedItem:          any = null;
  dragOverZone:         'sorgente' | 'destinazione' | null = null;
  isDragOverSorgente:     boolean = false;
  isDragOverDestinazione: boolean = false;

  constructor(
    private dbService:       DatabaseService,
    private toastCtrl:       ToastController,
    private router:          Router,
    private route:           ActivatedRoute,
  ) {}

  ngOnInit() {
    this.aggiornaUtente();
    const boxPreselezionata = this.route.snapshot.queryParamMap.get('boxSorgenteId');
    if (boxPreselezionata) {
      this.boxSorgenteId = Number(boxPreselezionata);
    }
    if (this.utenteId) {
      this.caricaBox(this.boxSorgenteId ?? undefined);
    }
  }

  ionViewWillEnter() { this.aggiornaUtente(); }
  ngOnDestroy() {}

  tornaIndietro() {
    this.router.navigateByUrl('/profilo', { replaceUrl: true });
  }

  private aggiornaUtente() {
    this.nomeUtente = localStorage.getItem('utente_nome') || '';
    this.utenteId   = localStorage.getItem('utente_id');
  }

  caricaBox(preselezioneId?: number) {
    if (!this.utenteId) return;
    this.dbService.getBox(this.utenteId).subscribe({
      next: (res: any) => {
        this.tutteLeBox = res.box || [];
        if (preselezioneId && this.tutteLeBox.some(b => b.id === preselezioneId)) {
          this.boxSorgente = this.tutteLeBox.find(b => b.id === preselezioneId) || null;
          this.caricaOggettiSorgente();
        }
      },
      error: (err: any) => console.error('Errore caricamento box:', err)
    });
  }

  get boxDisponibiliDestinazione(): any[] {
    return this.tutteLeBox.filter(b => b.id !== this.boxSorgenteId);
  }

  swapBoxes() {
    const tmpId = this.boxSorgenteId;
    const tmpOgg = [...this.oggettiSorgente];

    this.boxSorgenteId = this.boxDestinazioneId;
    this.oggettiSorgente = [...this.oggettiDestinazione];

    this.boxDestinazioneId = tmpId;
    this.oggettiDestinazione = tmpOgg;

    this.onBoxSorgenteChange();
    this.onBoxDestinazioneChange();
  }

  onBoxSorgenteChange() {
    this.boxSorgente = this.boxSorgenteId ? this.tutteLeBox.find(b => b.id === this.boxSorgenteId) || null : null;
    this.oggettiSorgente = [];
    if (this.boxSorgenteId) { this.caricaOggettiSorgente(); }
  }

  onBoxDestinazioneChange() {
    this.boxDestinazione = this.boxDestinazioneId ? this.tutteLeBox.find(b => b.id === this.boxDestinazioneId) || null : null;
    this.oggettiDestinazione = [];
    if (this.boxDestinazioneId) { this.caricaOggettiDestinazione(); }
  }

  caricaOggettiSorgente() {
    if (!this.boxSorgenteId) return;
    this.isLoading = true;
    this.dbService.getOggettiPerBox(this.boxSorgenteId).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.oggettiSorgente = res.oggetti || [];
      },
      error: () => { this.isLoading = false; }
    });
  }

  caricaOggettiDestinazione() {
    if (!this.boxDestinazioneId) return;
    this.dbService.getOggettiPerBox(this.boxDestinazioneId).subscribe({
      next: (res: any) => { this.oggettiDestinazione = res.oggetti || []; },
      error: (err: any) => console.error('Errore caricamento destinazione:', err)
    });
  }

  private async validaDestinazione(): Promise<boolean> {
    if (!this.boxDestinazioneId || isNaN(Number(this.boxDestinazioneId))) {
      await this.mostraToast('Seleziona prima una box di destinazione valida!', 'warning');
      return false;
    }
    return true;
  }

  async selezionaOggetto(ogg: any, zona: 'sorgente' | 'destinazione') {
    if (zona === 'sorgente') {
      await this.spostaInDestinazione(ogg);
    }
  }

  async spostaInDestinazione(ogg: any) {
    if (!(await this.validaDestinazione())) return;
    if (this.isSaving) return;

    const idOgg = Number(ogg.id);
    if (isNaN(idOgg) || idOgg <= 0) {
      await this.mostraToast('Oggetto con ID non valido.', 'danger');
      return;
    }

    const idx = this.oggettiSorgente.findIndex(o => o.id === ogg.id);
    if (idx === -1) return;
    this.oggettiSorgente.splice(idx, 1);

    this.isSaving = true;
    this.dbService.spostaOggetto(idOgg, Number(this.boxDestinazioneId)).subscribe({
      next: async () => {
        this.isSaving = false;
        const oggettoSpostato = { ...ogg, _appenaArrivato: true };
        this.oggettiDestinazione.push(oggettoSpostato);
        setTimeout(() => { oggettoSpostato._appenaArrivato = false; }, 3000);
        await this.mostraToast(`"${ogg.nome}" spostato!`, 'success');
      },
      error: async (err: any) => {
        this.isSaving = false;
        this.oggettiSorgente.splice(idx, 0, ogg);
        const serverMsg = err?.error?.error || err?.message || 'Errore sconosciuto';
        await this.mostraToast(`Spostamento fallito (${err.status}): ${serverMsg}`, 'danger');
      }
    });
  }

  async confermaTrasferimento() {
    if (this.oggettiDestinazione.length === 0 || this.isTransferring) return;
    if (!(await this.validaDestinazione())) return;

    this.isTransferring = true;
    try {
      await this.mostraToast(
        `Trasferimento completato! ${this.oggettiDestinazione.length} oggetti nella nuova box.`,
        'success'
      );
      this.oggettiDestinazione = [];
      this.boxDestinazione     = null;
      this.boxDestinazioneId   = null;
    } catch (err) {
      await this.mostraToast('Errore durante il trasferimento.', 'danger');
    } finally {
      this.isTransferring = false;
    }
  }

  onDragStart(event: DragEvent, item: any, zona: 'sorgente' | 'destinazione') {
    this.draggedItem = { item, zona };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(item.id));
    }
  }

  onDragOver(event: DragEvent, zona: 'sorgente' | 'destinazione') {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverZone          = zona;
    this.isDragOverSorgente     = zona === 'sorgente';
    this.isDragOverDestinazione = zona === 'destinazione';
  }

  onDragLeave(zona: 'sorgente' | 'destinazione') {
    this.dragOverZone = null;
    if (zona === 'sorgente')     this.isDragOverSorgente     = false;
    if (zona === 'destinazione') this.isDragOverDestinazione = false;
  }

  async onDrop(event: DragEvent, zonaTarget: 'sorgente' | 'destinazione') {
    event.preventDefault();
    this.dragOverZone          = null;
    this.isDragOverSorgente     = false;
    this.isDragOverDestinazione = false;
    if (!this.draggedItem) return;
    if (this.draggedItem.zona === zonaTarget) { this.draggedItem = null; return; }

    if (zonaTarget === 'destinazione' && !(await this.validaDestinazione())) {
      this.draggedItem = null;
      return;
    }
    await this.eseguiSpostamento(this.draggedItem.item, this.draggedItem.zona, zonaTarget);
    this.draggedItem = null;
  }

  onTouchStart(event: TouchEvent, item: any, zona: 'sorgente' | 'destinazione') {
    this.draggedItem = { item, zona };
  }

  async onTouchEnd(event: TouchEvent, _zona: 'sorgente' | 'destinazione') {
    if (!this.draggedItem) return;
    const touch      = event.changedTouches[0];
    const zonaTarget = this.getZonaDalPunto(touch.clientX, touch.clientY);

    if (zonaTarget && zonaTarget !== this.draggedItem.zona) {
      if (zonaTarget === 'destinazione' && !(await this.validaDestinazione())) {
        this.draggedItem = null;
        return;
      }
      await this.eseguiSpostamento(this.draggedItem.item, this.draggedItem.zona, zonaTarget);
    }
    this.draggedItem  = null;
    this.dragOverZone = null;
  }

  private getZonaDalPunto(x: number, y: number): 'sorgente' | 'destinazione' | null {
    const zone: Array<{ id: string; zona: 'sorgente' | 'destinazione' }> = [
      { id: 'zona-sorgente',     zona: 'sorgente' },
      { id: 'zona-destinazione', zona: 'destinazione' }
    ];
    for (const z of zone) {
      const el = document.getElementById(z.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return z.zona;
    }
    return null;
  }

  private async eseguiSpostamento(
    item: any,
    _zonaFrom: 'sorgente' | 'destinazione',
    zonaTo:    'sorgente' | 'destinazione'
  ) {
    if (zonaTo === 'destinazione') { await this.spostaInDestinazione(item); }
  }

  private async mostraToast(messaggio: string, tipo: string) {
    const iconMap: Record<string, string> = {
      success: '✅',
      danger: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    const titoli: Record<string, string> = {
      success: 'Operazione riuscita',
      danger: 'Errore',
      warning: 'Attenzione',
      info: 'Info'
    };
    const toast = await this.toastCtrl.create({
      header: `${iconMap[tipo] || 'ℹ️'} ${titoli[tipo] || 'Info'}`,
      message: messaggio,
      duration: 3000,
      cssClass: `peekbox-toast peekbox-toast--${tipo}`,
      position: 'bottom'
    });
    await toast.present();
  }
}
