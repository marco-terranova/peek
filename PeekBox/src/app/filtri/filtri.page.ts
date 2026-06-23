import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonFooter,
  IonTabBar, IonTabButton
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { NavigationHistoryService } from '../services/navigation-history';
import { DatabaseService } from '../services/database';
import { PbDropdownComponent } from '../components/pb-dropdown/pb-dropdown.component';

@Component({
  selector: 'app-filtri',
  templateUrl: './filtri.page.html',
  styleUrls: ['./filtri.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonContent, IonFooter,
    IonTabBar, IonTabButton,
    PbDropdownComponent,
  ]
})
export class FiltriPage {
  categorie: string[] = [];
  armadiDisponibili: any[] = [];

  selectedCategoria: string = '';
  selectedArmadio: number = 0;
  soloPreferiti: boolean = false;
  erroreFiltri: string = '';

  constructor(
    private navHistory: NavigationHistoryService,
    private dbService: DatabaseService
  ) {}

  ionViewWillEnter() {
    const utenteId = localStorage.getItem('utente_id');
    if (!utenteId) return;

    this.dbService.getCategorieOggetti(utenteId).subscribe({
      next: (res) => {
        this.categorie = res?.categorie || [];
      },
    });

    this.dbService.getArmadi(utenteId).subscribe({
      next: (res: any) => {
        this.armadiDisponibili = (Array.isArray(res) ? res : res?.armadi || [])
          .filter((a: any) => !a.ruolo_condivisione);
      },
    });
  }

  navTo(route: string) { this.navHistory.navTo(route); }

  applicaFiltri() {
    this.erroreFiltri = '';
    const utenteId = localStorage.getItem('utente_id');
    if (!utenteId) return;

    this.dbService.getBox(utenteId).subscribe({
      next: (res) => {
        let boxList = res.box || [];

        if (this.selectedCategoria) {
          boxList = boxList.filter((b: any) =>
            b.categorie_presenti && b.categorie_presenti.includes(this.selectedCategoria)
          );
        }

        if (this.selectedArmadio > 0) {
          boxList = boxList.filter((b: any) => String(b.rif_armadio) === String(this.selectedArmadio));
        }

        if (this.soloPreferiti) {
          boxList = boxList.filter((b: any) => b.is_preferito);
        }

        if (boxList.length === 0) {
          this.erroreFiltri = 'Nessuna box trovata con i criteri selezionati.';
          return;
        }

        localStorage.setItem('filtri_box', JSON.stringify({
          categoria: this.selectedCategoria,
          armadio_id: this.selectedArmadio,
          preferiti: this.soloPreferiti,
        }));
        this.navTo('/home');
      },
      error: () => {
        this.erroreFiltri = 'Errore nel caricamento delle box.';
      }
    });
  }

  resettaFiltri() {
    this.selectedCategoria = '';
    this.selectedArmadio = 0;
    this.soloPreferiti = false;
    this.erroreFiltri = '';
    localStorage.removeItem('filtri_box');
    this.navTo('/home');
  }
}
