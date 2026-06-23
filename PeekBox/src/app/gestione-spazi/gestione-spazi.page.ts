import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonIcon,
} from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  archiveOutline, addCircleOutline,
  pencilOutline, trashOutline, checkmarkOutline, closeOutline,
  home, qrCodeOutline, add, chatbubblesOutline,
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
  isLoadingSpazi = false;
  nuovoNomeSpazio = '';
  spazioInModifica: number | null = null;
  nomeModificaSpazio = '';

  constructor(
    private alertCtrl: AlertController,
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

  aggiungiSpazio() {
    const nome = this.nuovoNomeSpazio.trim();
    if (!nome || !this.utenteId) return;
    this.dbService.creaArmadio(nome, this.utenteId).subscribe({
      next: (res: any) => {
        const nuovoId = res.id || res.id_armadio || Date.now();
        this.gliArmadi = [...this.gliArmadi, { id: nuovoId, nome }];
        this.nuovoNomeSpazio = '';
      },
      error: () => {}
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
      header: 'Elimina Spazio',
      message: `Sei sicuro di voler eliminare "${spazio.nome}"?`,
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        { text: 'Elimina', role: 'destructive', handler: () => this.eliminaSpazio(spazio) }
      ]
    });
    await alert.present();
  }

  eliminaSpazio(spazio: any) {
    this.dbService.eliminaArmadio(spazio.id).subscribe({
      next: () => { this.gliArmadi = this.gliArmadi.filter(a => a.id !== spazio.id); },
      error: () => {}
    });
  }

  goBack() {
    this.navHistory.back('/area-personale');
  }

  vaiHome() { this.navHistory.navTo('/home'); }
  navTo(route: string) { this.navHistory.navTo(route); }

}
