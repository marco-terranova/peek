import { Component, HostListener } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { DatabaseService } from '../services/database';
import { Box } from '../../types/models';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule, CommonModule],
})
export class HomePage {
  utenteId: string | null = null;
  boxList: Box[] = [];
  caricamento = true;
  paginaCorrente = 0;
  boxPerPagina = 10;
  messaggioEliminazione = '';
  menuAperto = false;

  get boxVisibili(): Box[] {
    const start = this.paginaCorrente * this.boxPerPagina;
    return this.boxList.slice(start, start + this.boxPerPagina);
  }

  get totalePagine(): number {
    return Math.ceil(this.boxList.length / this.boxPerPagina) || 1;
  }

  get haSuccessiva(): boolean {
    return (this.paginaCorrente + 1) * this.boxPerPagina < this.boxList.length;
  }

  get haPrecedente(): boolean {
    return this.paginaCorrente > 0;
  }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuAperto = !this.menuAperto;
  }

  @HostListener('document:click', ['$event'])
  chiudiMenu(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.menuAperto && !target.closest('.hm-hamburger-wrap')) {
      this.menuAperto = false;
    }
  }

  paginaSuccessiva() {
    this.paginaCorrente++;
  }

  paginaPrecedente() {
    this.paginaCorrente--;
  }

  constructor(
    private dbService: DatabaseService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ionViewWillEnter() {
    this.utenteId = localStorage.getItem('utente_id');
    this.messaggioEliminazione = '';
    if (this.utenteId) {
      this.caricaBox();
    }
  }

  caricaBox() {
    if (!this.utenteId) return;
    this.caricamento = true;
    this.dbService.getBox(this.utenteId).subscribe({
      next: (res) => {
        let boxList = res.box || [];

        const filtriRaw = localStorage.getItem('filtri_box');
        if (filtriRaw) {
          try {
            const filtri = JSON.parse(filtriRaw);

            if (filtri.preferiti) {
              boxList = boxList.filter(b => b.is_preferito);
            }

            if (filtri.categoria) {
              const cat = filtri.categoria.toLowerCase();
              boxList = boxList.filter((b: any) =>
                b.categorie_presenti && b.categorie_presenti.toLowerCase().includes(cat)
              );
            }

            if (filtri.armadio_id && Number(filtri.armadio_id) > 0) {
              const armId = String(filtri.armadio_id);
              boxList = boxList.filter((b: any) => String(b.rif_armadio) === armId);
            }

            this.boxList = boxList;
            this.caricamento = false;
          } catch {
            this.boxList = boxList;
            this.caricamento = false;
          }
        } else {
          this.boxList = boxList;
          this.caricamento = false;
        }
      },
      error: () => {
        this.caricamento = false;
      }
    });
  }

  apriDettaglio(id: number) {
    this.router.navigate(['/dettaglio-box', id]);
  }

  togglePreferito(box: any, event: Event) {
    event.stopPropagation();
    const newVal = !box.is_preferito;
    this.dbService.updatePreferito(box.id, newVal).subscribe({
      next: () => { box.is_preferito = newVal; },
      error: () => this.toast('Errore aggiornamento preferito.', 'danger')
    });
  }

  async eliminaBox(box: any, event: Event) {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Elimina box',
      message: `Eliminare "${box.nome}"? Verrà spostata nel cestino.`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Elimina', role: 'destructive', handler: () => {
          this.dbService.eliminaBox(box.id).subscribe({
            next: () => {
              this.boxList = this.boxList.filter(b => b.id !== box.id);
              this.messaggioEliminazione = 'Box eliminata.';
              setTimeout(() => this.messaggioEliminazione = '', 5000);
            },
            error: () => this.toast('Errore durante l\'eliminazione.', 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }

  private async toast(message: string, color = 'primary') {
    const t = await this.toastCtrl.create({ message, duration: 2400, color, position: 'bottom' });
    await t.present();
  }

  private readonly capacitaMap: { [key: string]: number } = { piccola: 10, media: 20, grande: 30, pallet: 100 };

  isBoxPiena(box: any): boolean {
    const max = this.capacitaMap[box.dimensione] || 10;
    return (box.totale_pezzi || 0) >= max;
  }

  iconaBox(box: Box): string {
    const fragile = box.contiene_fragili === 1;
    const condivisa = !!box.ruolo_condivisione;
    if (fragile && condivisa) return 'assets/icon/box-card-fragile-share.png';
    if (fragile) return 'assets/icon/box-card-fragile.png';
    if (condivisa) return 'assets/icon/box-card-share.png';
    return 'assets/icon/box-card.png';
  }
}
