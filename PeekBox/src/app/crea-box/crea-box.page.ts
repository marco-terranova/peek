import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonContent,
  IonFooter,
  IonTabBar,
  IonTabButton,
} from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { NavigationHistoryService } from '../services/navigation-history';

@Component({
  selector: 'app-crea-box',
  templateUrl: './crea-box.page.html',
  styleUrls: ['./crea-box.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonFooter,
    IonTabBar,
    IonTabButton,
  ]
})
export class CreaBoxPage implements OnInit {

  nome_box: string = '';
  descrizione: string = '';
  rif_armadio: string = '';
  is_preferito: boolean = false;
  armadi_disponibili: any[] = [];
  utenteId: string = '';
  mostraDropdown: boolean = false;

  constructor(
    private alertController: AlertController,
    private dbService: DatabaseService,
    private navHistory: NavigationHistoryService,
  ) { }

  ngOnInit() {
    this.utenteId = localStorage.getItem('utente_id') || '';
    if (this.utenteId) {
      this.caricaArmadi();
    }
  }

  caricaArmadi() {
    this.dbService.getArmadi(this.utenteId).subscribe({
      next: (res: any) => { this.armadi_disponibili = res.armadi || []; },
      error: (err: any) => console.error(err)
    });
  }

  async aggiungiArmadio(event: Event) {
    event.preventDefault();
    const alert = await this.alertController.create({
      cssClass: ['peekbox-alert', 'peekbox-alert--slim'],
      header: 'Nuovo Spazio',
      inputs: [{ name: 'nome_armadio', type: 'text', placeholder: 'Es. Ripostiglio, Garage...' }],
      buttons: [
        { text: 'Annulla', role: 'cancel' },
        {
          text: 'Aggiungi',
          handler: (dati) => {
            if (dati.nome_armadio?.trim()) {
              this.dbService.creaArmadio(dati.nome_armadio.trim(), this.utenteId).subscribe({
                next: (res: any) => {
                  this.caricaArmadi();
                  this.rif_armadio = res.id.toString();
                },
                error: (err: any) => console.error(err)
              });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  salvaNuovaBox() {
    if (!this.nome_box || !this.rif_armadio) return;
    this.dbService.creaBox(this.nome_box, this.rif_armadio, this.is_preferito, false, this.descrizione).subscribe({
      next: () => { this.navHistory.navTo('/home'); },
      error: (err: any) => console.error(err)
    });
  }

  getNomeArmadio(id: string): string {
    const a = this.armadi_disponibili.find(a => a.id === id || a.id.toString() === id);
    return a ? a.nome : '';
  }

  selezionaArmadio(id: string) {
    this.rif_armadio = id;
    this.mostraDropdown = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.csr-select-wrap')) {
      this.mostraDropdown = false;
    }
  }

  navTo(route: string) { this.navHistory.navTo(route); }

}
