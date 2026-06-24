import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  ToastController,
  IonContent,
  IonFooter,
  IonTabBar,
  IonTabButton,
} from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { GpsService } from '../services/gps';
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
  movingMode: boolean = false;
  tipoProfilo: string = 'personal';
  dimensione: string = 'piccola';
  dimensioni = [
    { value: 'piccola', label: 'Piccola', cap: 10 },
    { value: 'media', label: 'Media', cap: 20 },
    { value: 'grande', label: 'Grande', cap: 30 },
  ];
  dimensioniBusiness = [
    { value: 'piccola', label: 'Piccola', cap: 10 },
    { value: 'media', label: 'Media', cap: 20 },
    { value: 'grande', label: 'Grande', cap: 30 },
    { value: 'pallet', label: 'Pallet', cap: 100 },
  ];

  get dimensioniDisponibili() {
    return this.tipoProfilo === 'business' ? this.dimensioniBusiness : this.dimensioni;
  }
  mostraDropdown: boolean = false;
  dropdownStyle: { [key: string]: string } = {};

  @ViewChild('selectTrigger') selectTrigger!: ElementRef<HTMLElement>;

  constructor(
    private alertController: AlertController,
    private toastCtrl: ToastController,
    private dbService: DatabaseService,
    private gpsService: GpsService,
    private navHistory: NavigationHistoryService,
  ) { }

  ngOnInit() {
    this.utenteId = localStorage.getItem('utente_id') || '';
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
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

  async salvaNuovaBox() {
    if (!this.nome_box || !this.rif_armadio) return;

    let lat: number | null = null;
    let lng: number | null = null;
    let acc: number | null = null;

    if (this.movingMode) {
      try {
        const pos = await this.gpsService.getPosizione();
        lat = pos.latitudine;
        lng = pos.longitudine;
        acc = pos.accuratezza;
      } catch {
        lat = 41.9028;
        lng = 12.4964;
        acc = 0;
      }
    }

    this.dbService.creaBox(this.nome_box, this.rif_armadio, this.is_preferito, this.movingMode, this.descrizione, this.dimensione).subscribe({
      next: (res: any) => {
        if (this.movingMode && res.id && lat !== null && lng !== null) {
          this.dbService.salvaCheckpoint(res.id, lat, lng, acc || undefined, 'Posizione iniziale').subscribe({
            next: () => this.navHistory.navTo('/home'),
            error: () => this.navHistory.navTo('/home')
          });
        } else {
          this.navHistory.navTo('/home');
        }
      },
      error: (err: any) => console.error(err)
    });
  }

  getNomeArmadio(id: string): string {
    const a = this.armadi_disponibili.find(a => a.id === id || a.id.toString() === id);
    return a ? a.nome : '';
  }

  toggleDropdown() {
    this.mostraDropdown = !this.mostraDropdown;
    if (this.mostraDropdown) {
      this.updateDropdownPosition();
    }
  }

  private updateDropdownPosition() {
    if (!this.selectTrigger) return;
    const rect = this.selectTrigger.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuMaxH = 200;

    if (spaceBelow < menuMaxH && rect.top > spaceBelow) {
      this.dropdownStyle = {
        left: rect.left + 'px',
        width: rect.width + 'px',
        bottom: (window.innerHeight - rect.top + 4) + 'px',
        top: 'auto',
      };
    } else {
      this.dropdownStyle = {
        left: rect.left + 'px',
        width: rect.width + 'px',
        top: (rect.bottom + 4) + 'px',
        bottom: 'auto',
      };
    }
  }

  selezionaArmadio(id: string) {
    this.rif_armadio = id;
    this.mostraDropdown = false;
  }

  chiudiDropdown() {
    this.mostraDropdown = false;
  }

  async toggleMovingMode() {
    if (this.tipoProfilo !== 'business') {
      this.movingMode = false;
      const toast = await this.toastCtrl.create({
        message: 'Funzionalità disponibile solo per account Business',
        duration: 2500,
        color: 'warning',
        position: 'bottom',
      });
      await toast.present();
      return;
    }
    this.movingMode = !this.movingMode;
  }

  navTo(route: string) { this.navHistory.navTo(route); }

}
