import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { IonContent } from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { PbDropdownComponent } from '../components/pb-dropdown/pb-dropdown.component';

interface Ospite {
  id: number;
  ruolo: 'viewer' | 'editor';
  stato: 'in_attesa' | 'accettata' | 'rifiutata';
  ospite_email: string;
  ospite_username?: string;
  creato_il?: string;
}

@Component({
  selector: 'app-condividi-archivio',
  templateUrl: './condividi-archivio.page.html',
  styleUrls: ['./condividi-archivio.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, CommonModule, PbDropdownComponent]
})
export class CondividiArchivioPage {

  utenteId: string = '';

  box: any[] = [];
  boxSelezionato: number = 0;
  emailOspite: string = '';
  ruoloOspite: 'viewer' | 'editor' = 'viewer';
  isInvitando: boolean = false;

  ospitiMap: Map<number, Ospite[]> = new Map();
  ospitiLoading: Set<number> = new Set();

  archiviCondivisi: any[] = [];
  isLoadingArchivi: boolean = false;

  constructor(
    private dbService: DatabaseService,
    private toastCtrl: ToastController,
    private router: Router,
  ) {}

  ionViewWillEnter() {
    this.utenteId = localStorage.getItem('utente_id') || '';
    this.caricaBox();
    this.caricaArchiviCondivisi();
  }

  tornaIndietro() {
    this.router.navigateByUrl('/profilo', { replaceUrl: true });
  }

  private caricaBox() {
    if (!this.utenteId) return;
    this.dbService.getBox(this.utenteId).subscribe({
      next: (res: any) => {
        this.box = (Array.isArray(res) ? res : res?.box || [])
          .filter((b: any) => !b.ruolo_condivisione);
        if (this.box.length > 0) this.boxSelezionato = this.box[0].id;
        this.box.forEach(b => this.caricaOspiti(b.id));
      },
    });
  }

  private caricaOspiti(boxId: number) {
    this.ospitiLoading.add(boxId);
    this.dbService.getCondivisioniArchivio(boxId).subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : res?.condivisioni || [];
        this.ospitiMap.set(boxId, lista);
        this.ospitiLoading.delete(boxId);
      },
      error: () => this.ospitiLoading.delete(boxId),
    });
  }

  private caricaArchiviCondivisi() {
    if (!this.utenteId) return;
    this.isLoadingArchivi = true;
    this.dbService.getArchividCondivisiConMe(this.utenteId).subscribe({
      next: (res: any) => {
        this.archiviCondivisi = res?.archivi_condivisi || res?.condivisioni || [];
        this.isLoadingArchivi = false;
      },
      error: () => this.isLoadingArchivi = false,
    });
  }

  invita() {
    if (!this.boxSelezionato || !this.emailOspite.trim()) {
      this.mostraToast('Seleziona una scatola e inserisci un email.', 'warning');
      return;
    }
    this.isInvitando = true;
    this.dbService.condividiArchivio(this.boxSelezionato, this.emailOspite.trim(), this.ruoloOspite).subscribe({
      next: () => {
        this.isInvitando = false;
        this.emailOspite = '';
        this.mostraToast('Invito inviato con successo!', 'success');
        this.caricaOspiti(this.boxSelezionato);
      },
      error: (err) => {
        this.isInvitando = false;
        const msg = err?.error?.error || 'Errore durante l\'invito. Riprova.';
        this.mostraToast(msg, 'danger');
      },
    });
  }

  revocaOspite(ospiteId: number) {
    this.dbService.revocaCondivisione(ospiteId).subscribe({
      next: () => {
        this.mostraToast('Ospite rimosso.', 'info');
        for (const [boxId] of this.ospitiMap) {
          const lista = this.ospitiMap.get(boxId);
          if (lista) {
            this.ospitiMap.set(boxId, lista.filter((o: Ospite) => o.id !== ospiteId));
          }
        }
      },
      error: () => this.mostraToast('Errore durante la rimozione.', 'danger'),
    });
  }

  ruoloLabel(ruolo: string): string {
    return ruolo === 'editor' ? 'Editor' : 'Visualizzatore';
  }

  ruoloIcon(ruolo: string): string {
    return ruolo === 'editor' ? '✏️' : '👁️';
  }

  get boxConOspiti(): any[] {
    return this.box.filter(b => (this.ospitiMap.get(b.id)?.length || 0) > 0);
  }

  statoLabel(ospite: Ospite): string {
    if (ospite.stato === 'in_attesa') return 'Richiesta inviata';
    if (ospite.stato === 'rifiutata') return 'Rifiutata';
    if (ospite.ruolo === 'editor') return 'Collaboratore';
    return 'Visualizzatore';
  }

  statoClasse(ospite: Ospite): string {
    if (ospite.stato === 'in_attesa') return 'ca-stato--pending';
    if (ospite.stato === 'rifiutata') return 'ca-stato--rifiutata';
    if (ospite.ruolo === 'editor') return 'ca-stato--editor';
    return 'ca-stato--viewer';
  }

  private async mostraToast(messaggio: string, color: string) {
    const iconMap: Record<string, string> = {
      success: '✅',
      danger: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    const toast = await this.toastCtrl.create({
      header: `${iconMap[color] || 'ℹ️'}  ${color === 'danger' ? 'Errore' : color === 'success' ? 'Operazione riuscita' : color === 'warning' ? 'Attenzione' : 'Info'}`,
      message: messaggio,
      duration: 3000,
      cssClass: `peekbox-toast peekbox-toast--${color}`,
      position: 'bottom',
    });
    await toast.present();
  }
}
