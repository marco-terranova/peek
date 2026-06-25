import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent,
} from '@ionic/angular/standalone';
import { AlertController, ToastController } from '@ionic/angular';

import { DatabaseService } from '../services/database';
import { NavigationHistoryService } from '../services/navigation-history';

@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  styleUrls: ['admin.page.scss'],
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    IonHeader, IonToolbar, IonContent,
  ],
})
export class AdminPage implements OnInit {

  utenti: any[] = [];
  utentiFiltrati: any[] = [];
  segnalazioni: any[] = [];
  stats: any = null;

  isLoading = true;
  errore = '';
  segLoading = false;

  searchTerm = '';
  tab: 'utenti' | 'segnalazioni' = 'utenti';

  utenteIdCorrente: string | null = null;

  String = String;
  Number = Number;

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private dbService: DatabaseService,
    private router: Router,
    private navHistory: NavigationHistoryService,
  ) {
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.utenteIdCorrente = localStorage.getItem('utente_id');

    if (localStorage.getItem('is_admin') !== '1') {
      this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    this.caricaStats();
    this.caricaUtenti();
    this.caricaSegnalazioni();
  }

  // ── STATS ────────────────────────────
  caricaStats() {
    this.dbService.adminGetStats().subscribe({
      next: (res: any) => { this.stats = res; },
      error: () => {}
    });
  }

  // ── UTENTI ───────────────────────────
  caricaUtenti() {
    this.isLoading = true;
    this.errore = '';
    this.dbService.adminGetUtenti().subscribe({
      next: (res: any) => {
        this.utenti = res.utenti || [];
        this.filtraUtenti();
        this.isLoading = false;
      },
      error: () => {
        this.errore = 'Impossibile caricare gli utenti. Verifica i permessi admin.';
        this.isLoading = false;
      }
    });
  }

  filtraUtenti() {
    const t = this.searchTerm.toLowerCase().trim();
    if (!t) {
      this.utentiFiltrati = [...this.utenti];
      return;
    }
    this.utentiFiltrati = this.utenti.filter(u =>
      (u.username || '').toLowerCase().includes(t) ||
      (u.email || '').toLowerCase().includes(t)
    );
  }

  iniziale(nome: string): string {
    return (nome || '?').charAt(0).toUpperCase();
  }

  goBack() { this.navHistory.back('/home'); }

  async confermaEliminazione(utente: any) {
    if (String(utente.id) === this.utenteIdCorrente) {
      this.mostraToast('Non puoi eliminare te stesso.', 'warning');
      return;
    }
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Elimina Account',
      message: `Sei sicuro di voler eliminare l'account di <strong>${utente.username}</strong> (${utente.email})?<br><br>Questa azione è <strong>irreversibile</strong> e rimuoverà tutti i dati associati.`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          role: 'destructive',
          handler: () => this.eliminaUtente(utente)
        }
      ]
    });
    await alert.present();
  }

  eliminaUtente(utente: any) {
    this.dbService.adminEliminaUtente(utente.id).subscribe({
      next: async () => {
        this.utenti = this.utenti.filter(u => u.id !== utente.id);
        this.filtraUtenti();
        this.caricaStats();
        this.mostraToast(`Account ${utente.username} eliminato.`, 'success');
      },
      error: async (err) => {
        const msg = err?.error?.error || 'Errore durante l\'eliminazione.';
        this.mostraToast(msg, 'danger');
      }
    });
  }

  async toggleAdmin(utente: any) {
    if (String(utente.id) === this.utenteIdCorrente) {
      this.mostraToast('Non puoi modificare i tuoi permessi.', 'warning');
      return;
    }
    const nuovoStato = utente.is_admin ? 0 : 1;
    const label = nuovoStato ? 'concedere i permessi admin a' : 'rimuovere i permessi admin a';
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Modifica permessi',
      message: `Sei sicuro di voler ${label} <strong>${utente.username}</strong>?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Conferma',
          handler: () => {
            this.dbService.adminToggleUserAdmin(utente.id, nuovoStato).subscribe({
              next: () => {
                utente.is_admin = nuovoStato;
                this.mostraToast(`Permessi aggiornati per ${utente.username}.`, 'success');
              },
              error: (err) => this.mostraToast(err?.error?.error || 'Errore', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ── SEGNALAZIONI ─────────────────────
  caricaSegnalazioni() {
    this.segLoading = true;
    this.dbService.adminGetSegnalazioni().subscribe({
      next: (res: any) => {
        this.segnalazioni = res.segnalazioni || [];
        this.segLoading = false;
      },
      error: () => {
        this.mostraToast('Errore caricamento segnalazioni.', 'danger');
        this.segLoading = false;
      }
    });
  }

  cambiaStatoSegnalazione(s: any, event: any) {
    const nuovoStato = event.target.value;
    if (nuovoStato === s.stato) return;
    this.dbService.adminUpdateSegnalazioneStatus(s.id, nuovoStato).subscribe({
      next: () => {
        s.stato = nuovoStato;
        this.mostraToast('Stato segnalazione aggiornato.', 'success');
      },
      error: (err) => this.mostraToast(err?.error?.error || 'Errore', 'danger')
    });
  }

  async eliminaSegnalazione(s: any) {
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Elimina segnalazione',
      message: `Rimuovere la segnalazione "<strong>${s.titolo}</strong>"?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Elimina',
          role: 'destructive',
          handler: () => {
            this.dbService.adminEliminaSegnalazione(s.id).subscribe({
              next: () => {
                this.segnalazioni = this.segnalazioni.filter(x => x.id !== s.id);
                this.caricaStats();
                this.mostraToast('Segnalazione eliminata.', 'success');
              },
              error: (err) => this.mostraToast(err?.error?.error || 'Errore', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  rispondiSegnalazione(s: any) {
    const testo = (s.testoRisposta || '').trim();
    if (!testo) return;
    this.dbService.adminRispondiSegnalazione(s.id, testo).subscribe({
      next: () => {
        s.stato = 'risolta';
        s.mostraRisposta = false;
        s.testoRisposta = '';
        this.mostraToast('Risposta inviata all\'utente!', 'success');
      },
      error: (err) => this.mostraToast(err?.error?.error || 'Errore invio risposta.', 'danger')
    });
  }

  private async mostraToast(msg: string, color: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'bottom' });
    await t.present();
  }
}
