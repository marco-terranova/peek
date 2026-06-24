import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { IonContent } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../services/database';

@Component({
  selector: 'app-informazioni-account',
  templateUrl: './informazioni-account.page.html',
  styleUrls: ['./informazioni-account.page.scss'],
  standalone: true,
  imports: [IonContent, FormsModule, CommonModule]
})
export class InformazioniAccountPage {

  nome: string = '';
  email: string = '';
  nomeOriginale: string = '';
  tipoProfilo: string = 'personal';
  isAdmin: boolean = false;
  dataRegistrazione: string = '';

  vecchiaPassword: string = '';
  nuovaPassword: string = '';
  confermaPassword: string = '';

  datiModificati: boolean = false;
  isSaving: boolean = false;

  utenteId: string | null = null;

  constructor(
    private toastCtrl: ToastController,
    private dbService: DatabaseService,
    private router: Router,
  ) {}

  tornaIndietro() {
    this.router.navigateByUrl('/profilo', { replaceUrl: true });
  }

  ionViewWillEnter() {
    this.utenteId          = localStorage.getItem('utente_id');
    this.nome              = localStorage.getItem('utente_nome')  || '';
    this.email             = localStorage.getItem('utente_email') || '';
    this.tipoProfilo       = localStorage.getItem('tipo_profilo') || 'personal';
    this.isAdmin           = localStorage.getItem('is_admin') === '1';
    this.dataRegistrazione = localStorage.getItem('utente_data_reg') || '';
    this.nomeOriginale     = this.nome;
    this.datiModificati    = false;
  }

  get pwStrengthLevel(): 'none' | 'weak' | 'medium' | 'strong' {
    const p = this.nuovaPassword;
    if (!p) return 'none';
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    if (score <= 1) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  }

  get pwStrengthPercent(): number {
    const map = { none: 0, weak: 25, medium: 60, strong: 100 };
    return map[this.pwStrengthLevel];
  }

  get pwStrengthLabel(): string {
    const map = { none: '', weak: 'Debole', medium: 'Media', strong: 'Forte' };
    return map[this.pwStrengthLevel];
  }

  verificaModifiche() {
    this.datiModificati =
      (this.nome !== this.nomeOriginale) ||
      (this.nuovaPassword.length > 0);
  }

  async salvaModifiche() {
    if (!this.utenteId) {
      await this.mostraToast('Sessione non valida. Effettua di nuovo il login.', 'danger');
      return;
    }

    const nomeTrimmed = (this.nome || '').trim();
    if (!nomeTrimmed) {
      await this.mostraToast('Il nome non può essere vuoto.', 'warning');
      return;
    }

    if (this.nuovaPassword.length > 0) {
      if (!this.passwordValida(this.nuovaPassword)) {
        await this.mostraToast('La password deve avere almeno 8 caratteri, maiuscole, minuscole, un numero e un carattere speciale (!?@#$).', 'warning');
        return;
      }
      if (this.nuovaPassword !== this.confermaPassword) {
        await this.mostraToast('Le password non coincidono.', 'warning');
        return;
      }
      if (!this.vecchiaPassword) {
        await this.mostraToast('Inserisci la password attuale per cambiarla.', 'warning');
        return;
      }
    }

    this.isSaving = true;

    const ops: Promise<any>[] = [];

    if (nomeTrimmed !== this.nomeOriginale) {
      ops.push(
        firstValueFrom(
          this.dbService.aggiornaProfiloUtente(this.utenteId, { nome: nomeTrimmed })
        ).then(() => {
          localStorage.setItem('utente_nome', nomeTrimmed);
          this.nomeOriginale = nomeTrimmed;
        })
      );
    }

    if (this.nuovaPassword.length > 0) {
      ops.push(
        firstValueFrom(
          this.dbService.aggiornaPassword(this.utenteId, this.vecchiaPassword, this.nuovaPassword)
        ).then(() => {
          this.vecchiaPassword = '';
          this.nuovaPassword = '';
          this.confermaPassword = '';
        })
      );
    }

    if (ops.length === 0) {
      this.isSaving = false;
      await this.mostraToast('Nessuna modifica da salvare.', 'warning');
      return;
    }

    try {
      await Promise.all(ops);
      this.datiModificati = false;
      await this.mostraToast('Modifiche salvate con successo!', 'success');
    } catch (err: any) {
      const msg = err.error?.error || 'Errore durante il salvataggio. Riprova.';
      await this.mostraToast(msg, 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  private passwordValida(pw: string): boolean {
    return pw.length >= 8
        && /[A-Z]/.test(pw)
        && /[a-z]/.test(pw)
        && /[0-9]/.test(pw)
        && /[!?@#$]/.test(pw);
  }

  private async mostraToast(messaggio: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: messaggio,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

}
