import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NavigationHistoryService } from '../services/navigation-history';
import { DatabaseService } from '../services/database';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonContent } from '@ionic/angular/standalone';
import jsQR from 'jsqr';

@Component({
  selector: 'app-scan-qr',
  templateUrl: './scan-qr.page.html',
  styleUrls: ['./scan-qr.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IonContent],
})
export class ScanQrPage implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('tiltCard') tiltCard!: ElementRef<HTMLElement>;

  cameraAttiva = false;
  erroreCamera = '';
  codiceManuale = '';
  boxTrovati: any[] = [];
  galleryError = '';
  proprietarioError = '';
  caricamentoError = '';
  private stream: MediaStream | null = null;
  private animFrameId = 0;
  private cardRect: DOMRect | null = null;

  constructor(
    private router: Router,
    private navHistory: NavigationHistoryService,
    private dbService: DatabaseService,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {}

  ngOnDestroy() {
    this.fermaCamera();
  }

  @HostListener('document:visibilitychange')
  handleVisibilityChange() {
    if (document.hidden && this.cameraAttiva) {
      this.fermaCamera();
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.tiltCard?.nativeElement) return;
    if (!this.cardRect) this.cardRect = this.tiltCard.nativeElement.getBoundingClientRect();
    const rect = this.cardRect;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = (x - cx) / cx;
    const dy = (y - cy) / cy;
    const rx = -dy * 2;
    const ry = dx * 2;
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    this.tiltCard.nativeElement.style.setProperty('--rx', `${rx}deg`);
    this.tiltCard.nativeElement.style.setProperty('--ry', `${ry}deg`);
    const glare = this.tiltCard.nativeElement.querySelector('.sr-card-glare') as HTMLElement;
    if (glare) {
      glare.style.setProperty('--gx', `${glareX}%`);
      glare.style.setProperty('--gy', `${glareY}%`);
      glare.style.opacity = '1';
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    if (!this.tiltCard?.nativeElement) return;
    this.cardRect = null;
    this.tiltCard.nativeElement.style.setProperty('--rx', `0deg`);
    this.tiltCard.nativeElement.style.setProperty('--ry', `0deg`);
    const glare = this.tiltCard.nativeElement.querySelector('.sr-card-glare') as HTMLElement;
    if (glare) glare.style.opacity = '0';
  }

  toggleCamera() {
    if (this.cameraAttiva) {
      this.fermaCamera();
    } else {
      this.caricamentoError = '';
      this.avviaCamera();
    }
  }

  private async avviaCamera() {
    this.erroreCamera = '';
    this.caricamentoError = '';
    this.proprietarioError = '';
    this.cameraAttiva = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.erroreCamera = 'Il tuo browser non supporta la fotocamera.';
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (this.videoEl?.nativeElement) {
        this.videoEl.nativeElement.srcObject = this.stream;
        this.cameraAttiva = true;
        await this.videoEl.nativeElement.play();
        this.tickQR();
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.erroreCamera = 'Accesso alla fotocamera negato. Abilita il permesso nelle impostazioni del browser.';
      } else if (err.name === 'NotFoundError') {
        this.erroreCamera = 'Nessuna fotocamera trovata sul dispositivo.';
      } else {
        this.erroreCamera = err.message || 'Impossibile accedere alla fotocamera.';
      }
      this.cameraAttiva = false;
    }
  }

  private fermaCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
    this.cameraAttiva = false;
  }

  private tickQR() {
    if (!this.cameraAttiva) { this.animFrameId = requestAnimationFrame(() => this.tickQR()); return; }
    this.scanFrame();
    this.animFrameId = requestAnimationFrame(() => this.tickQR());
  }

  private scanFrame() {
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        this.ngZone.run(() => {
          this.fermaCamera();
          this.elaboraQR(code.data);
        });
      }
    } catch {}
  }

  private elaboraQR(data: string) {
    this.caricamentoError = '';
    const id = this.estraiBoxId(data);
    if (id) {
      this.caricaBox(id);
    } else {
      this.caricamentoError = 'QR Code non valido.';
    }
  }

  private estraiBoxId(data: string): string | null {
    const trimmed = data.trim();
    if (trimmed.includes('?') && trimmed.includes('box=')) {
      try {
        const urlParams = new URLSearchParams(trimmed.substring(trimmed.indexOf('?')));
        const boxParam = urlParams.get('box');
        if (boxParam) return boxParam;
      } catch {}
    }
    const patterns = [/box[=/](\w+)/i, /\/box\/(\w+)/, /id[=:](\w+)/i, /^(\w{8,})$/];
    for (const p of patterns) {
      const m = trimmed.match(p);
      if (m) return m[1];
    }
    return null;
  }

  private caricaBox(id: string) {
    const numId = Number(id);
    if (isNaN(numId)) { this.caricamentoError = 'ID box non valido'; return; }
    this.caricamentoError = '';
    this.dbService.getBoxSingola(numId).subscribe({
      next: (res: any) => {
        if (res?.box) {
          const alreadyExists = this.boxTrovati.some(b => b.id === res.box.id);
          if (!alreadyExists) {
            this.boxTrovati = [...this.boxTrovati, res.box];
          }
          this.erroreCamera = '';
          this.caricamentoError = '';
        } else {
          this.caricamentoError = 'Box non trovata.';
        }
      },
      error: (err: any) => {
        if (err.status === 403) {
          this.proprietarioError = 'Non sei il proprietario di questa box.';
          setTimeout(() => this.proprietarioError = '', 4000);
        } else if (err.status === 401) {
          this.caricamentoError = 'Accesso negato. Effettua di nuovo il login.';
        } else if (err.status === 404) {
          this.caricamentoError = 'Box non trovata.';
        } else if (err.status === 0) {
          this.caricamentoError = 'Errore di connessione al server.';
        } else {
          this.caricamentoError = 'Errore nel caricamento.';
        }
      }
    });
  }

  cercaBox() {
    if (!this.codiceManuale) return;
    this.fermaCamera();
    this.caricaBox(this.codiceManuale);
    this.codiceManuale = '';
  }

  async daGalleria() {
    this.fermaCamera();
    this.erroreCamera = '';
    this.galleryError = '';
    this.caricamentoError = '';
    this.proprietarioError = '';
    try {
      const capturedPhoto = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        quality: 100,
      });
      if (!capturedPhoto.base64String) return;
      const img = new Image();
      const b64 = capturedPhoto.base64String;
      const mime = b64.startsWith('/9j/') ? 'image/jpeg' :
                   b64.startsWith('iVBOR') ? 'image/png' :
                   b64.startsWith('R0lGOD') ? 'image/gif' :
                   b64.startsWith('UklGR') ? 'image/webp' : 'image/jpeg';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1024;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        try {
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            this.ngZone.run(() => this.elaboraQR(code.data));
          } else {
            this.ngZone.run(() => {
              this.galleryError = 'Nessun QR Code trovato nell\'immagine.';
              setTimeout(() => this.galleryError = '', 4000);
            });
          }
        } catch {
          this.ngZone.run(() => {
            this.galleryError = 'Errore nella lettura dell\'immagine.';
            setTimeout(() => this.galleryError = '', 4000);
          });
        }
      };
      img.onerror = () => {
        this.ngZone.run(() => {
          this.galleryError = 'Impossibile leggere l\'immagine selezionata.';
          setTimeout(() => this.galleryError = '', 4000);
        });
      };
      img.src = `data:${mime};base64,${b64}`;
    } catch {
      this.ngZone.run(() => {
        this.galleryError = 'Errore nell\'aprire la galleria.';
        setTimeout(() => this.galleryError = '', 4000);
      });
    }
  }

  vaiABox(box: any) {
    if (!box) return;
    this.fermaCamera();
    this.router.navigate(['/dettaglio-box', box.id]);
  }

  navTo(route: string) {
    this.navHistory.navTo(route);
  }
}