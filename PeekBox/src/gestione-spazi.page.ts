import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonIcon,
} from '@ionic/angular/standalone';
import { AlertController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  archiveOutline, addCircleOutline,
  pencilOutline, trashOutline, checkmarkOutline, closeOutline,
  home, qrCodeOutline, add, chatbubblesOutline, alertCircleOutline,
} from 'ionicons/icons';

import { DatabaseService } from '../services/database';
import { NavigationHistoryService } from '../services/navigation-history';

@Component({
  selector: 'app-gestione-spazi',
  templateUrl: 'gestione-spazi.page.html',
  styleUrls: ['gestione-spazi.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonHeader, IonToolbar, IonContent, IonIcon,
  ],
})
export class GestioneSpaziPage implements OnInit {

  nomeUtente: string = '';
  utenteId: string | null = null;

  gliArmadi: any[] = [];
  boxOrfane: any[] = [];
  isLoadingSpazi = false;
  nuovoNomeSpazio = '';
  spazioInModifica: number | null = null;
  nomeModificaSpazio = '';

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private dbService: DatabaseService,
    private router: Router,
    private navHistory: NavigationHistoryService,
  ) {
    addIcons({
      'archive-outline': archiveOutline,
      'add-circle-outline': addCircleOutline,
      'pencil-outline': pencilOutline,
      'trash-outline': trashOutline,
      'checkmark-outline': checkmarkOutline,
      'close-outline': closeOutline,
      'alert-circle-outline': alertCircleOutline,
      'home': home,
      'chatbubbles-outline': chatbubblesOutline,
      'qr-code-outline': qrCodeOutline,
      'add': add
    });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.utenteId = localStorage.getItem('utente_id');
    this.nomeUtente = (localStorage.getItem('utente_nome') || '').toUpperCase();
    this.caricaSpazi();
    this.caricaBoxOrfane();
  }

  caricaSpazi() {
    if (!this.utenteId) return;
    this.isLoadingSpazi = true;
    this.gliArmadi = [];
    this.dbService.getArmadi(this.utenteId).subscribe({
      next: (res: any) => {
        this.gliArmadi = res.armadi || res || [];
        this.isLoadingSpazi = false;
      },
      error: () => { this.isLoadingSpazi = false; }
    });
  }

  caricaBoxOrfane() {
    if (!this.utenteId) return;
    this.dbService.getBoxOrfane(this.utenteId).subscribe({
      next: (res: any) => {
        this.boxOrfane = (res.box_orfane || []).map((b: any) => ({ ...b, _nuovoSpazio: null }));
      },
      error: () => {}
    });
  }

  aggiungiSpazio() {
    const nome = this.nuovoNomeSpazio.trim();
    if (!nome || !this.utenteId) return;
    this.dbService.creaArmadio(nome, this.utenteId).subscribe({
      next: (res: any) => {
        this.nuovoNomeSpazio = '';
        this.caricaSpazi();
        this.toast('Spazio creato!', 'success');
      },
      error: () => { this.toast('Errore nella creazione dello spazio.', 'danger'); }
    });
  }

  avviaModificaSpazio(spazio: any) {
    this.spazioInModifica = spazio.id;
    this.nomeModificaSpazio = spazio.nome;
  }

  salvaModificaSpazio(spazio: any) {
    const nuovoNome = this.nomeModificaSpazio.trim();
    if (!nuovoNome) { this.annullaModifica(); return; }
    spazio.nome = nuovoNome;
    this.annullaModifica();
  }

  annullaModifica() {
    this.spazioInModifica = null;
    this.nomeModificaSpazio = '';
  }

  async confermaEliminaSpazio(spazio: any) {
    const alert = await this.alertCtrl.create({
      cssClass: 'peekbox-alert',
      header: 'Elimina Spazio',
      message: `Sei sicuro di voler eliminare "${spazio.nome}"? Le box associate verranno messe in attesa di riallocazione.`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Elimina', role: 'destructive', handler: () => this.eliminaSpazio(spazio) }
      ]
    });
    await alert.present();
  }

  eliminaSpazio(spazio: any) {
    this.dbService.eliminaArmadio(spazio.id).subscribe({
      next: (res: any) => {
        this.gliArmadi = this.gliArmadi.filter(a => a.id !== spazio.id);
        const orfane = res.box_orfane || 0;
        if (orfane > 0) {
          this.caricaBoxOrfane();
          this.toast(`Spazio eliminato. ${orfane} box in attesa di riallocazione.`, 'warning');
        } else {
          this.toast('Spazio eliminato.', 'medium');
        }
      },
      error: () => { this.toast('Errore durante l\'eliminazione.', 'danger'); }
    });
  }

  riallocaBox(box: any) {
    if (!box._nuovoSpazio) return;
    this.dbService.riallocaBox(box.id, box._nuovoSpazio).subscribe({
      next: () => {
        this.boxOrfane = this.boxOrfane.filter(b => b.id !== box.id);
        this.caricaSpazi();
        this.toast(`"${box.nome}" riallocata!`, 'success');
      },
      error: () => { this.toast('Errore nella riallocazione.', 'danger'); }
    });
  }

  private async toast(message: string, color = 'primary') {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }

  goBack() {
    this.navHistory.back('/area-personale');
  }

  vaiHome() { this.navHistory.navTo('/home'); }
  navTo(route: string) { this.navHistory.navTo(route); }
}
