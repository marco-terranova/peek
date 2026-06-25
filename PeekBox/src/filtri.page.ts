import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonFooter,
  IonTabBar, IonTabButton
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { NavigationHistoryService } from '../services/navigation-history';
import { DatabaseService } from '../services/database';

@Component({
  selector: 'app-filtri',
  templateUrl: './filtri.page.html',
  styleUrls: ['./filtri.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonContent, IonFooter,
    IonTabBar, IonTabButton,
  ]
})
export class FiltriPage {
  categorie: string[] = [];
  armadiDisponibili: any[] = [];

  selectedCategoria: string = '';
  selectedArmadio: number = 0;
  soloPreferiti: boolean = false;
  erroreFiltri: string = '';

  mostraCatDd = false;
  mostraArmDd = false;
  catDdStyle: { [key: string]: string } = {};
  armDdStyle: { [key: string]: string } = {};

  @ViewChild('catTrigger') catTrigger!: ElementRef<HTMLElement>;
  @ViewChild('armTrigger') armTrigger!: ElementRef<HTMLElement>;

  constructor(
    private navHistory: NavigationHistoryService,
    private dbService: DatabaseService
  ) {}

  toggleCatDd() {
    this.mostraArmDd = false;
    this.mostraCatDd = !this.mostraCatDd;
    if (this.mostraCatDd && this.catTrigger) {
      const r = this.catTrigger.nativeElement.getBoundingClientRect();
      this.catDdStyle = { position: 'fixed', left: r.left + 'px', width: r.width + 'px', top: (r.bottom + 4) + 'px' };
    }
  }

  toggleArmDd() {
    this.mostraCatDd = false;
    this.mostraArmDd = !this.mostraArmDd;
    if (this.mostraArmDd && this.armTrigger) {
      const r = this.armTrigger.nativeElement.getBoundingClientRect();
      this.armDdStyle = { position: 'fixed', left: r.left + 'px', width: r.width + 'px', top: (r.bottom + 4) + 'px' };
    }
  }

  selCat(c: string) { this.selectedCategoria = c; this.mostraCatDd = false; }
  selArm(a: any) { this.selectedArmadio = a.id; this.mostraArmDd = false; }
  getNomeArmadio(): string {
    if (!this.selectedArmadio) return '';
    const a = this.armadiDisponibili.find(x => x.id === this.selectedArmadio || String(x.id) === String(this.selectedArmadio));
    return a?.nome || '';
  }
  chiudiDd() { this.mostraCatDd = false; this.mostraArmDd = false; }

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

  ripristinaFiltri() {
    this.selectedCategoria = '';
    this.selectedArmadio = 0;
    this.soloPreferiti = false;
    this.erroreFiltri = '';
    localStorage.removeItem('filtri_box');
    this.navTo('/home');
  }
}
