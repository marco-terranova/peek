import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { DatabaseService } from '../services/database';
import { Box } from '../../types/models';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule, CommonModule],
})
export class HomePage {
  utenteId: string | null = null;
  boxList: Box[] = [];
  caricamento = true;

  constructor(
    private dbService: DatabaseService,
    private router: Router,
  ) {}

  ionViewWillEnter() {
    this.utenteId = localStorage.getItem('utente_id');
    if (this.utenteId) {
      this.caricaBox();
    }
  }

  caricaBox() {
    if (!this.utenteId) return;
    this.caricamento = true;
    this.dbService.getBox(this.utenteId).subscribe({
      next: (res) => {
        let boxList = res.box || [];

        // Apply stored filters from filtri page
        const filtriRaw = localStorage.getItem('filtri_box');
        if (filtriRaw) {
          try {
            const filtri = JSON.parse(filtriRaw);

            if (filtri.preferiti) {
              boxList = boxList.filter(b => b.is_preferito);
            }

            if (filtri.categoria) {
              const cat = filtri.categoria.toLowerCase();
              boxList = boxList.filter((b: any) =>
                b.categorie_presenti && b.categorie_presenti.toLowerCase().includes(cat)
              );
            }

            if (filtri.armadio_id && Number(filtri.armadio_id) > 0) {
              const armId = String(filtri.armadio_id);
              boxList = boxList.filter((b: any) => String(b.rif_armadio) === armId);
            }

            this.boxList = boxList;
            this.caricamento = false;
          } catch {
            this.boxList = boxList;
            this.caricamento = false;
          }
        } else {
          this.boxList = boxList;
          this.caricamento = false;
        }
      },
      error: () => {
        this.caricamento = false;
      }
    });
  }

  apriDettaglio(id: number) {
    this.router.navigate(['/dettaglio-box', id]);
  }

  fotoBox(id: number): string {
    return `https://picsum.photos/seed/box${id}/150/150`;
  }
}
