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
import tlds from 'tlds';

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
  emailRegSubmitted: boolean = false;
  passwordRegSubmitted: boolean = false;
  dominioRegError: boolean = false;
  showRecupero: boolean = false;
  recuperoEmail: string = '';
  recuperoMessaggio: string = '';
  recuperoInviato: boolean = false;

  get recuperoValido(): boolean {
    return this.emailValida(this.recuperoEmail);
  }

  get loginValido(): boolean {
    return this.emailValida(this.email) && !!this.password?.trim() && this.password.length >= 8;
  }
  emailValida(email: string): boolean {
    const e = email.trim();
    if (!e) return false;

    const atIndex = e.indexOf('@');
    const lastAtIndex = e.lastIndexOf('@');
    if (atIndex === -1) return false;              
    if (lastAtIndex !== atIndex) return false;     

    const local = e.slice(0, atIndex);
    const domain = e.slice(atIndex + 1);

    if (local.length === 0 || domain.length === 0) return false;

    if (local.length > 64) return false;
    if (domain.length > 255) return false;
    if (e.length > 254) return false;

    if (local.startsWith('.') || local.endsWith('.')) return false;
    if (local.includes('..')) return false;

    const localInvalid = /[<>()\[\]\\,;:\s"]/;
    if (localInvalid.test(local)) return false;

    if (!/^[\x20-\x7E]+$/.test(local)) return false;

    if (domain.startsWith('[') && domain.endsWith(']')) return true;

    if (!domain.includes('.')) return false;

    if (domain.startsWith('-') || domain.endsWith('-')) return false;
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
    if (domain.includes('..')) return false;

    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return false;

    const tld = domain.slice(domain.lastIndexOf('.') + 1).toLowerCase();
    if (tld.length < 2) return false;
    if (!tlds.includes(tld)) return false;

    return true;
  }

  async dominioEsiste(domain: string): Promise<boolean> {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
      const data: any = await res.json();
      return !!data.Answer?.length;
    } catch {
      return true;
    }
  }

  passwordValida(pw: string): boolean {
    return pw.length >= 8
        && /[A-Z]/.test(pw)
        && /[a-z]/.test(pw)
        && /[0-9]/.test(pw)
        && /[!?@#$]/.test(pw);
  }

  get registerValido(): boolean {
    return !!this.nomeProfilo?.trim()
        && !!this.emailReg?.trim()
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

  toggleMode() {
    this.isRegister = !this.isRegister;
  }

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

  selezionaProfilo(tipo: 'personal' | 'business') {
    this.tipoProfilo = tipo;
  }

  async registrati() {
    this.emailRegSubmitted = false;
    this.passwordRegSubmitted = false;
    this.dominioRegError = false;
    let valid = true;
    if (!this.emailValida(this.emailReg)) {
      this.emailRegSubmitted = true;
      valid = false;
    }
    if (valid && !await this.dominioEsiste(this.emailReg.split('@')[1])) {
      this.dominioRegError = true;
      return;
    }
    if (!this.passwordValida(this.passwordReg)) {
      this.passwordRegSubmitted = true;
      valid = false;
    }
    if (!valid) return;
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
