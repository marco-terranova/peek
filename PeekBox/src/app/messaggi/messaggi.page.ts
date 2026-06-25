import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, AlertController, ToastController } from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { Messaggio } from '../../types/models';
import { firstValueFrom } from 'rxjs';
import { PbDropdownComponent } from '../components/pb-dropdown/pb-dropdown.component';

@Component({
  selector: 'app-messaggi',
  templateUrl: './messaggi.page.html',
  styleUrls: ['./messaggi.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, CommonModule, PbDropdownComponent]
})
export class MessaggiPage implements OnInit {
  messaggi: Messaggio[] = [];

  caricamento = true;

  filtroCorrente: 'tutti' | 'sistema' | 'supporto' | 'condivisione' = 'tutti';
  ricercaTesto = '';
  messaggioAperto: number | null = null;

  supportoCat = 'problema_tecnico';
  supportoCatOptions = [
    { value: 'problema_tecnico', label: 'Problema tecnico' },
    { value: 'richiesta_info', label: 'Richiesta informazioni' },
    { value: 'suggerimento', label: 'Suggerimento' },
    { value: 'segnalazione', label: 'Segnalazione' },
    { value: 'altro', label: 'Altro' },
  ];
  supportoOggetto = '';
  supportoCorpo = '';
  supportoInvio = false;

  get messaggiFiltrati(): Messaggio[] {
    let lista = [...this.messaggi];
    if (this.filtroCorrente !== 'tutti') {
      lista = lista.filter(m => m.tipo === this.filtroCorrente);
    }
    if (this.ricercaTesto.trim()) {
      const q = this.ricercaTesto.toLowerCase();
      lista = lista.filter(m =>
        m.mittente.toLowerCase().includes(q) ||
        m.oggetto.toLowerCase().includes(q) ||
        m.corpo.toLowerCase().includes(q)
      );
    }
    return lista;
  }

  get messaggiNonLetti(): number {
    return this.messaggi.filter(m => !m.letto).length;
  }

  get messaggiImportanti(): number {
    return this.messaggi.filter(m => m.importante).length;
  }

  constructor(
    private router: Router,
    private dbService: DatabaseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.caricaMessaggi();
  }

  private async caricaMessaggi() {
    this.caricamento = true;
    try {
      const res = await firstValueFrom(this.dbService.getMessaggi(localStorage.getItem('utente_id')!));
      this.messaggi = res.messaggi;
    } catch (err) {
      console.error('[Messaggi] Errore caricamento:', err);
    }
    this.caricamento = false;
  }

  apriMessaggio(m: Messaggio) {
    if (this.messaggioAperto === m.id) {
      this.messaggioAperto = null;
      return;
    }
    this.messaggioAperto = m.id;
    if (!m.letto) {
      this.dbService.segnaMessaggioLetto(m.id).subscribe({
        next: () => { m.letto = 1; },
        error: (err) => console.error('[Messaggi] Errore segna letto:', err)
      });
    }
  }

  toggleImportante(m: Messaggio) {
    this.dbService.toggleMessaggioImportante(m.id).subscribe({
      next: () => { m.importante = m.importante ? 0 : 1; },
      error: (err) => console.error('[Messaggi] Errore toggle importante:', err)
    });
  }

  async eliminaMessaggio(m: Messaggio) {
    const alert = await this.alertCtrl.create({
      header: 'Elimina messaggio',
      message: `Eliminare definitivamente "${m.oggetto}"?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          role: 'destructive',
          handler: () => {
            this.dbService.eliminaMessaggio(m.id).subscribe({
              next: () => {
                this.messaggi = this.messaggi.filter(x => x.id !== m.id);
                if (this.messaggioAperto === m.id) this.messaggioAperto = null;
              },
              error: (err) => console.error('[Messaggi] Errore eliminazione:', err)
            });
          }
        }
      ]
    });
    await alert.present();
  }

  getCondivisioneId(m: Messaggio): number | null {
    const match = m.corpo?.match(/\[condivisione_id:(\d+)\]/);
    return match ? Number(match[1]) : null;
  }

  getCorpoVisibile(m: Messaggio): string {
    return (m.corpo || '').replace(/\s*\[condivisione_id:\d+\]/, '');
  }

  accettaCondivisione(m: Messaggio) {
    const id = this.getCondivisioneId(m);
    if (!id) return;
    this.dbService.accettaCondivisione(id).subscribe({
      next: () => {
        m.corpo = m.corpo.replace(/\[condivisione_id:\d+\]/, '[accettata]');
        this.toast('Condivisione accettata!');
      },
      error: () => this.toast('Errore nell\'accettazione.', 'danger')
    });
  }

  rifiutaCondivisione(m: Messaggio) {
    const id = this.getCondivisioneId(m);
    if (!id) return;
    this.dbService.rifiutaCondivisione(id).subscribe({
      next: () => {
        m.corpo = m.corpo.replace(/\[condivisione_id:\d+\]/, '[rifiutata]');
        this.toast('Condivisione rifiutata.');
      },
      error: () => this.toast('Errore nel rifiuto.', 'danger')
    });
  }

  private async toast(message: string, color = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 2400, color, position: 'bottom' });
    await t.present();
  }

  async inviaSupporto() {
    if (!this.supportoOggetto.trim() || !this.supportoCorpo.trim()) return;
    this.supportoInvio = true;
    try {
      await firstValueFrom(this.dbService.inviaMessaggio({
        tipo: 'supporto',
        oggetto: `[${this.supportoCat}] ${this.supportoOggetto}`,
        corpo: this.supportoCorpo
      }));

      await firstValueFrom(this.dbService.inviaSegnalazione({
        tipo: 'report',
        titolo: this.supportoOggetto,
        descrizione: this.supportoCorpo,
        priorita: 'media'
      }));

      this.supportoOggetto = '';
      this.supportoCorpo = '';
      this.supportoCat = 'problema_tecnico';
      await this.caricaMessaggi();
      const toast = await this.toastCtrl.create({
        message: 'Messaggio inviato al supporto. Riceverai risposta nella posta in arrivo.',
        duration: 3000,
        color: 'success'
      });
      toast.present();
    } catch (err) {
      console.error('[Messaggi] Errore invio supporto:', err);
      const toast = await this.toastCtrl.create({
        message: 'Errore durante l\'invio. Riprova più tardi.',
        duration: 3000,
        color: 'danger'
      });
      toast.present();
    }
    this.supportoInvio = false;
  }

  tornaIndietro() {
    this.router.navigateByUrl('/profilo', { replaceUrl: true });
  }

  formattaData(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Oggi';
    if (diffDays === 1) return 'Ieri';
    if (diffDays < 7) return `${diffDays} giorni fa`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }
}
