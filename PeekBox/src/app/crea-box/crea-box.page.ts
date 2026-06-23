import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  AlertController,
  IonContent,
  IonFooter,
  IonSelect,
  IonSelectOption,
  IonTabBar,
  IonTabButton,
} from '@ionic/angular/standalone';
import { RouterModule, Router } from '@angular/router';
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
    RouterModule,
    IonContent,
    IonFooter,
    IonSelect,
    IonSelectOption,
    IonTabBar,
    IonTabButton,
  ]
})
export class CreaBoxPage implements OnInit {
  @ViewChild('cameraVideo') cameraVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') cameraCanvas!: ElementRef<HTMLCanvasElement>;

  nome_box: string = '';
  descrizione: string = '';
  rif_armadio: string = '';
  is_preferito: boolean = false;
  armadi_disponibili: any[] = [];
  utenteId: string = '';
  fotoBox: string | null = null;

  showCamera = false;
  mostraAnteprima = false;
  cameraErrore = '';
  stream: MediaStream | null = null;
  fotoMessage = '';

  constructor(
    private alertController: AlertController,
    private router: Router,
    private dbService: DatabaseService,
    private navHistory: NavigationHistoryService,
    private sanitizer: DomSanitizer
  ) { }

  get safeFotoBox(): SafeResourceUrl | null {
    return this.fotoBox ? this.sanitizer.bypassSecurityTrustResourceUrl(this.fotoBox) : null;
  }

  mostraFotoMessage(msg: string) {
    this.fotoMessage = msg;
    setTimeout(() => { this.fotoMessage = ''; }, 3000);
  }

  scegliDaGalleria() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.fotoBox = reader.result as string;
        if (this.fotoBox) {
          this.mostraFotoMessage('Immagine caricata con successo!');
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async scattaFoto() {
    this.showCamera = true;
    this.cameraErrore = '';
    setTimeout(() => this.avviaCamera(), 100);
  }

  async avviaCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (this.cameraVideo) {
        this.cameraVideo.nativeElement.srcObject = this.stream;
      }
    } catch (err) {
      this.cameraErrore = 'Impossibile accedere alla fotocamera. Verifica i permessi.';
    }
  }

  confermaScatto() {
    const video = this.cameraVideo?.nativeElement;
    const canvas = this.cameraCanvas?.nativeElement;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    this.fotoBox = canvas.toDataURL('image/jpeg', 0.85);
    this.chiudiCamera();
    if (this.fotoBox) {
      this.mostraFotoMessage('Foto scattata con successo!');
    }
  }

  chiudiCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.showCamera = false;
  }

  ngOnInit() {
    this.mostraAnteprima = false;
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

  navTo(route: string) { this.navHistory.navTo(route); }

}
