import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { DatabaseService } from '../services/database';
import { BoxListResponse } from '../../types/models';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IonContent]
})
export class SearchPage {

  termineDiRicerca: string = '';
  risultati: any[] = [];
  cercando: boolean = false;
  haCercato: boolean = false;
  utenteId: string | null = null;

  suggerimenti: string[] = [];

  private suggerimentiGenerici: string[] = [
    'Scarpe', 'Libri', 'Documenti', 'Elettronica', 'Cucina', 'Giocattoli', 'Abbigliamento'
  ];

  constructor(
    private dbService: DatabaseService,
    private router: Router,
  ) {}

  ionViewWillEnter() {
    this.utenteId = localStorage.getItem('utente_id');
    this.caricaSuggerimenti();
  }

  private caricaSuggerimenti() {
    if (!this.utenteId) {
      this.suggerimenti = this.suggerimentiGenerici;
      return;
    }
    this.dbService.getBox(this.utenteId).subscribe({
      next: (res: BoxListResponse) => {
        const nomi = (res.box || [])
          .map(b => b.nome)
          .filter(Boolean);
        this.suggerimenti = nomi.length > 0
          ? nomi.slice(0, 4)
          : this.suggerimentiGenerici;
      },
      error: () => {
        this.suggerimenti = this.suggerimentiGenerici;
      }
    });
  }

  cercaConTermine(termine: string) {
    this.termineDiRicerca = termine;
    this.eseguiRicerca();
  }

  cercaOggetti() {
    this.eseguiRicerca();
  }

  private eseguiRicerca() {
    const termine = this.termineDiRicerca?.trim();

    if (!termine || termine.length < 2) {
      this.risultati = [];
      this.haCercato = false;
      return;
    }

    this.cercando = true;
    this.haCercato = true;

    this.dbService.cercaOggetti(termine).subscribe({
      next: (res: any) => {
        this.risultati = res.risultati || [];
        this.cercando = false;
      },
      error: (err: any) => {
        console.error("Errore ricerca:", err);
        this.cercando = false;
      }
    });
  }

  pulisciRicerca() {
    this.termineDiRicerca = '';
    this.risultati = [];
    this.haCercato = false;
  }

  vaiABox(box: any) {
    if (!box) return;
    this.router.navigate(['/dettaglio-box', box.id]);
  }

  tornaIndietro() {
    this.router.navigate(['/home']);
  }
}
