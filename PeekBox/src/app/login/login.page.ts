import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonInput, IonInputPasswordToggle,
  AlertController
} from '@ionic/angular/standalone';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { switchMap, catchError, EMPTY, forkJoin } from 'rxjs';
import { DatabaseService } from '../services/database';
import { LoginResponse } from '../../types/models';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonInput, CommonModule, FormsModule,
    RouterModule, IonInputPasswordToggle
  ]
})
export class LoginPage implements OnInit {

  email: string = '';
  password: string = '';

  isRegister: boolean = false;
  registerSuccess: boolean = false;
  nomeProfilo: string = '';
  emailReg: string = '';
  passwordReg: string = '';
  tipoProfilo: 'personal' | 'business' = 'personal';

  loginError: boolean = false;
  registerError: boolean = false;
  showRecupero: boolean = false;
  recuperoEmail: string = '';
  recuperoMessaggio: string = '';
  recuperoInviato: boolean = false;

  get recuperoValido(): boolean {
    return this.emailValida(this.recuperoEmail);
  }

  get loginValido(): boolean {
    return this.emailValida(this.email) && !!this.password?.trim();
  }
  private emailValida(email: string): boolean {
    const e = email.trim();
    if (!e) return false;

    // ── Struttura base ───────────────────────────────────
    const atIndex = e.indexOf('@');
    const lastAtIndex = e.lastIndexOf('@');
    if (atIndex === -1) return false;               // manca @
    if (lastAtIndex !== atIndex) return false;      // @ multiple

    const local = e.slice(0, atIndex);
    const domain = e.slice(atIndex + 1);

    if (local.length === 0 || domain.length === 0) return false; // vuoto prima/dopo @

    // ── Lunghezza ────────────────────────────────────────
    if (local.length > 64) return false;
    if (domain.length > 255) return false;
    if (e.length > 254) return false;

    // ── Parte locale ─────────────────────────────────────
    if (local.startsWith('.') || local.endsWith('.')) return false;
    if (local.includes('..')) return false;

    // Caratteri non permessi fuori da virgolette
    const localInvalid = /[<>()\[\]\\,;:\s"]/;
    if (localInvalid.test(local)) return false;

    // Caratteri accentati / Unicode non supportati
    if (!/^[\x20-\x7E]+$/.test(local)) return false;

    // ── Dominio ──────────────────────────────────────────
    // IP nudo tra parentesi quadre → accettato
    if (domain.startsWith('[') && domain.endsWith(']')) return true;

    // Deve avere almeno un punto
    if (!domain.includes('.')) return false;

    // Non iniziare/finire con trattino
    if (domain.startsWith('-') || domain.endsWith('-')) return false;
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
    if (domain.includes('..')) return false;

    // Solo lettere, numeri, trattini e punti
    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return false;

    // TLD deve essere almeno 2 lettere
    const tld = domain.slice(domain.lastIndexOf('.') + 1);
    if (tld.length < 2) return false;

    return true;
  }

  get registerValido(): boolean {
    return !!this.nomeProfilo?.trim()
        && this.emailValida(this.emailReg)
        && !!this.passwordReg?.trim() && this.passwordReg.length >= 8;
  }

  @ViewChild('tiltCard', { static: false }) cardRef!: ElementRef<HTMLElement>;
  @ViewChild('overlayCard', { static: false }) overlayCardRef!: ElementRef<HTMLElement>;
  @ViewChild('stageRef', { static: false }) stageRef!: ElementRef<HTMLElement>;

  private cardRect: DOMRect | null = null;

  constructor(
    private alertController: AlertController,
    private dbService: DatabaseService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const registerParam = this.route.snapshot.queryParamMap.get('register');
    if (registerParam === 'true') {
      this.isRegister = true;
    }
  }

  // ── Card Tilt + Scene Parallax ───────────────────────
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    const card = this.cardRef?.nativeElement ?? this.overlayCardRef?.nativeElement;
    if (card) {
      this.cardRect = card.getBoundingClientRect();
      const x = (event.clientX - this.cardRect.left) / this.cardRect.width;
      const y = (event.clientY - this.cardRect.top) / this.cardRect.height;
      card.style.setProperty('--tilt-x', `${(y - 0.5) * -5}deg`);
      card.style.setProperty('--tilt-y', `${(x - 0.5) * 5}deg`);
      card.style.setProperty('--glare-x', `${x * 100}%`);
      card.style.setProperty('--glare-y', `${y * 100}%`);
    }
    const stage = this.stageRef?.nativeElement;
    if (stage) {
      const px = ((event.clientX / window.innerWidth) - 0.5) * 2;
      const py = ((event.clientY / window.innerHeight) - 0.5) * 2;
      stage.style.setProperty('--px', px.toFixed(3));
      stage.style.setProperty('--py', py.toFixed(3));
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    const card = this.cardRef?.nativeElement ?? this.overlayCardRef?.nativeElement;
    if (card) {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      card.style.setProperty('--glare-x', '50%');
      card.style.setProperty('--glare-y', '50%');
      this.cardRect = null;
    }
    const stage = this.stageRef?.nativeElement;
    if (stage) {
      stage.style.setProperty('--px', '0');
      stage.style.setProperty('--py', '0');
    }
  }

  // ── Mode Toggle ──────────────────────────────────────
  toggleMode() {
    this.isRegister = !this.isRegister;
  }

  // ── Login Logic ──────────────────────────────────────
  accedi() {
    this.dbService.loginUtente(this.email, this.password).pipe(
      switchMap((res: LoginResponse) => {
        localStorage.setItem('token',        res.token);
        localStorage.setItem('utente_id',    String(res.user.id));
        localStorage.setItem('utente_nome',  res.user.username);
        localStorage.setItem('utente_email', res.user.email || '');
        localStorage.setItem('tipo_profilo', res.user.tipo_profilo || 'personal');
        localStorage.setItem('is_admin',     res.user.is_admin ? '1' : '0');
        localStorage.setItem('utente_data_reg', res.user.data_registrazione || '');

        const uid = String(res.user.id);
        return forkJoin([
          this.dbService.getCondivisioniPending(uid),
          this.dbService.getMessaggiNonLetto(),
        ]).pipe(
          catchError(() => {
            this.router.navigateByUrl('/home', { replaceUrl: true });
            return EMPTY;
          })
        );
      }),
      catchError(() => {
        this.loginError = true;
        setTimeout(() => this.loginError = false, 4000);
        return EMPTY;
      })
    ).subscribe(([pendingRes, messaggiRes]) => {
      if ((pendingRes.pending > 0) || (messaggiRes.count > 0)) {
        this.router.navigateByUrl('/messaggi', { replaceUrl: true });
      } else {
        this.router.navigateByUrl('/home', { replaceUrl: true });
      }
    });
  }

  async recuperaPassword(event: Event) {
    event.preventDefault();
    this.recuperoEmail = (this.emailReg || this.email || '');
    this.recuperoMessaggio = '';
    this.recuperoInviato = false;
    this.showRecupero = true;
  }

  chiudiRecupero() {
    this.showRecupero = false;
  }

  async inviaRichiesta() {
    if (!this.recuperoEmail?.trim()) return;
    this.recuperoInviato = true;
  }

  tornaBenvenuto() {
    this.router.navigateByUrl('/benvenuto', { replaceUrl: true });
  }

  // ── Registration Logic ───────────────────────────────
  selezionaProfilo(tipo: 'personal' | 'business') {
    this.tipoProfilo = tipo;
  }

  async registrati() {
    if (!this.nomeProfilo?.trim() || !this.emailReg?.trim() || !this.passwordReg?.trim()) {
      (await this.alertController.create({
        cssClass: 'peekbox-alert',
        header: 'Errore',
        message: 'Tutti i campi sono obbligatori!',
        buttons: ['OK']
      })).present();
      return;
    }
    if (!this.emailValida(this.emailReg)) {
      (await this.alertController.create({
        cssClass: 'peekbox-alert',
        header: 'Email non valida',
        message: 'Inserisci un indirizzo email valido (es. nome@dominio.com).',
        buttons: ['OK']
      })).present();
      return;
    }
    if (this.passwordReg.length < 8) {
      (await this.alertController.create({
        cssClass: 'peekbox-alert',
        header: 'Password troppo corta',
        message: 'La password deve contenere almeno 8 caratteri.',
        buttons: ['OK']
      })).present();
      return;
    }
    this.dbService.registraUtente(this.nomeProfilo, this.emailReg, this.passwordReg, this.tipoProfilo).subscribe({
      next: async () => {
        this.registerSuccess = true;
      },
      error: async (err) => {
        if (err.status === 400) {
          this.registerError = true;
          setTimeout(() => this.registerError = false, 4000);
          return;
        }
        (await this.alertController.create({
          cssClass: 'peekbox-alert',
          header: 'Errore',
          message: 'Server offline. Impossibile completare la registrazione.',
          buttons: ['OK']
        })).present();
      }
    });
  }

  vaiAlLoginDaReg() {
    this.email = this.emailReg;
    this.password = this.passwordReg;
    this.registerSuccess = false;
    this.isRegister = false;
  }
}
