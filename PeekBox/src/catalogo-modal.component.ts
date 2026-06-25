import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonSearchbar, IonSegment, IonSegmentButton,
  IonLabel, IonList, IonItem, IonThumbnail, IonBadge,
  IonSpinner, IonIcon, IonFooter,
  ModalController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircleOutline, closeOutline, removeCircleOutline } from 'ionicons/icons';
import { DatabaseService, PredefinedItem } from '../../services/database';

interface CartItem {
  item: PredefinedItem;
  quantita: number;
}

@Component({
  selector: 'app-catalogo-modal',
  templateUrl: './catalogo-modal.component.html',
  styleUrls: ['./catalogo-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonSearchbar, IonSegment, IonSegmentButton,
    IonLabel, IonList, IonItem, IonThumbnail, IonBadge,
    IonSpinner, IonIcon, IonFooter
  ]
})
export class CatalogoModalComponent implements OnInit {

  @Input() boxId!: number;

  tuttiGliItems: PredefinedItem[] = [];
  itemsFiltrati: PredefinedItem[] = [];
  categorie: string[] = ['Tutti'];
  categoriaSelezionata: string = 'Tutti';
  termineDiRicerca: string = '';
  carrello: Map<number, CartItem> = new Map();

  isLoading = true;
  isSaving = false;

  constructor(
    private dbService: DatabaseService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController
  ) {
    addIcons({ addCircleOutline, closeOutline, removeCircleOutline });
  }

  ngOnInit() {
    this.caricaCatalogo();
  }

  caricaCatalogo() {
    this.isLoading = true;
    this.dbService.getPredefinedItems().subscribe({
      next: (res) => {
        this.tuttiGliItems = res.items;
        this.itemsFiltrati = res.items;
        const cats = [...new Set(res.items.map(i => i.category))].sort();
        this.categorie = ['Tutti', ...cats];
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  onCategoriaChange(event: any) {
    this.categoriaSelezionata = event.detail.value;
    this.filtra();
  }

  onRicerca(event: any) {
    this.termineDiRicerca = event.detail.value?.toLowerCase() ?? '';
    this.filtra();
  }

  filtra() {
    this.itemsFiltrati = this.tuttiGliItems.filter(item => {
      const matchCategoria = this.categoriaSelezionata === 'Tutti' || item.category === this.categoriaSelezionata;
      const matchRicerca   = !this.termineDiRicerca || item.name.toLowerCase().includes(this.termineDiRicerca);
      return matchCategoria && matchRicerca;
    });
  }

  getQuantita(item: PredefinedItem): number {
    return this.carrello.get(item.id)?.quantita ?? 0;
  }

  incrementa(item: PredefinedItem) {
    const current = this.carrello.get(item.id);
    if (current) {
      current.quantita++;
    } else {
      this.carrello.set(item.id, { item, quantita: 1 });
    }
  }

  decrementa(item: PredefinedItem) {
    const current = this.carrello.get(item.id);
    if (!current) return;
    if (current.quantita <= 1) {
      this.carrello.delete(item.id);
    } else {
      current.quantita--;
    }
  }

  get totaleElementiCarrello(): number {
    let tot = 0;
    this.carrello.forEach(c => tot += c.quantita);
    return tot;
  }

  async confermaAggiunta() {
    if (this.carrello.size === 0) return;
    this.isSaving = true;

    const items = Array.from(this.carrello.values());
    let salvati = 0;

    // Aggiunta sequenziale (SQLite non gestisce bene bulk concorrente)
    for (const cartItem of items) {
      await new Promise<void>((resolve) => {
        this.dbService.aggiungiOggettoDaCatalogo(this.boxId, cartItem.item, cartItem.quantita).subscribe({
          next: () => { salvati++; resolve(); },
          error: () => { resolve(); }
        });
      });
    }

    this.isSaving = false;
    const toast = await this.toastCtrl.create({
      message: `✅ ${salvati} element${salvati === 1 ? 'o aggiunto' : 'i aggiunti'} alla box!`,
      duration: 2000, color: 'success', position: 'bottom'
    });
    await toast.present();
    await this.modalCtrl.dismiss({ aggiunto: true, count: salvati });
  }

  chiudi() {
    this.modalCtrl.dismiss({ aggiunto: false });
  }
}
