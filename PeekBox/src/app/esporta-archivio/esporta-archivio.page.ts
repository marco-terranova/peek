import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { PbDropdownComponent } from '../components/pb-dropdown/pb-dropdown.component';
import {
  filterCircleOutline, documentTextOutline,
  documentOutline, gridOutline, codeSlashOutline, sparkles,
  printOutline, cubeOutline
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

import { DatabaseService } from '../services/database';
import { NavigationHistoryService } from '../services/navigation-history';
import { ExportService } from '../services/export';

@Component({
  selector: 'app-esporta-archivio',
  templateUrl: './esporta-archivio.page.html',
  styleUrls: ['./esporta-archivio.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent, IonIcon, IonSpinner,
    PbDropdownComponent,
  ],
})
export class EsportaArchivioPage implements OnInit {

  nomeUtente: string = '';
  exportScope: string = '';
  exportFormat: string = '';
  isExporting: boolean = false;
  logoBase64: string = '';
  elencoBox: any[] = [];
  selectedBoxId: string = '';

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private dbService: DatabaseService,
    private navHistory: NavigationHistoryService,
    private exportService: ExportService,
  ) {
    addIcons({
      'filter-circle-outline': filterCircleOutline,
      'document-text-outline': documentTextOutline,
      'document-outline': documentOutline,
      'grid-outline': gridOutline,
      'code-slash-outline': codeSlashOutline,
      'sparkles': sparkles,
      'print-outline': printOutline,
      'cube-outline': cubeOutline
    });
  }

  ngOnInit() {
    this.caricaBox();
  }

  private async caricaBox() {
    const utenteId = localStorage.getItem('utente_id') || '';
    try {
      const res: any = await firstValueFrom(this.dbService.getBox(utenteId) as any);
      this.elencoBox = res?.box ?? res ?? [];
    } catch {
      this.elencoBox = [];
    }
  }

  ionViewWillEnter() {
    this.nomeUtente = (localStorage.getItem('utente_nome') || '').toUpperCase();
  }

  private async caricaLogoBase64(): Promise<void> {
    if (this.logoBase64) return;
    try {
      const response = await fetch('assets/icon/logoTitolo1.png');
      const blob = await response.blob();
      this.logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      console.warn('[EsportaArchivio] Logo non caricato, PDF senza logo.');
      this.logoBase64 = '';
    }
  }

  setFormat(formato: string) { this.exportFormat = formato; }
  isFormValid(): boolean {
    if (!this.exportScope) return false;
    if (this.exportScope === 'singola') return this.selectedBoxId !== '' && this.exportFormat !== '';
    return this.exportFormat !== '';
  }

  private async getDatiReali(): Promise<any[]> {
    const utenteId = localStorage.getItem('utente_id') || '';

    if (this.exportScope === 'singola') {
      if (!this.selectedBoxId) return [];
      try {
        const resOgg: any = await firstValueFrom(
          this.dbService.getOggettiPerBox(Number(this.selectedBoxId)) as any
        );
        const box = this.elencoBox.find(b => b.id == this.selectedBoxId);
        const oggetti: any[] = resOgg?.oggetti ?? resOgg ?? [];
        return [{
          box: (box?.nome || '').toUpperCase(),
          contenuto: oggetti.length > 0
            ? oggetti.map((o: any) => o.nome || o.descrizione || '?').join(', ')
            : '— Nessun oggetto —',
          nOggetti: oggetti.length,
          data: box?.data_creazione
            ? new Date(box.data_creazione).toLocaleDateString('it-IT')
            : '—',
          spazio: box?.rif_armadio || '—',
        }];
      } catch {
        return [];
      }
    }

    const resBox: any = await firstValueFrom(
      this.dbService.getBox(utenteId) as any
    );
    const boxHome: any[] = resBox?.box ?? resBox ?? [];

    let boxFiltrate: any[];

    if (this.exportScope === 'attive') {
      // Solo box attive = quelle presenti nella home (il server già esclude cestino)
      boxFiltrate = boxHome;
    } else {
      // Intero archivio = home + cestino (box eliminate soft-delete)
      const resCestino: any = await firstValueFrom(
        this.dbService.getBoxEliminate(utenteId) as any
      ).catch(() => ({ box_eliminate: [] }));
      const boxCestino: any[] = resCestino?.box_eliminate ?? [];
      boxFiltrate = [...boxHome, ...boxCestino];
    }

    const righe: any[] = [];
    for (const box of boxFiltrate) {
      try {
        // ✅ FIX 2: la risposta HTTP è { oggetti: [...] }, non un array diretto
        const resOgg: any = await firstValueFrom(
          this.dbService.getOggettiPerBox(box.id) as any
        );
        const oggetti: any[] = resOgg?.oggetti ?? resOgg ?? [];

        const contenutoStr = oggetti.length > 0
          ? oggetti.map((o: any) => o.nome || o.descrizione || '?').join(', ')
          : '— Nessun oggetto —';

        righe.push({
          box: (box.nome || '').toUpperCase(),
          contenuto: contenutoStr,
          nOggetti: oggetti.length,
          data: box.data_creazione
            ? new Date(box.data_creazione).toLocaleDateString('it-IT')
            : '—',
          spazio: box.rif_armadio || '—',
        });
      } catch {
        righe.push({
          box: (box.nome || '').toUpperCase(),
          contenuto: '(errore nel recupero oggetti)',
          nOggetti: 0,
          data: '—',
          spazio: '—',
        });
      }
    }

    return righe;
  }

  async stampaBox() {
    if (!this.selectedBoxId) return;
    try {
      const box = this.elencoBox.find(b => b.id == this.selectedBoxId);
      if (!box) throw new Error('Box non trovata');
      const resOgg: any = await firstValueFrom(
        this.dbService.getOggettiPerBox(Number(this.selectedBoxId)) as any
      );
      const oggetti: any[] = resOgg?.oggetti ?? resOgg ?? [];
      const html = this.exportService.generaHtmlStampaBox(box, oggetti);
      this.exportService.apriFinestraStampa(html);
      const toast = await this.toastCtrl.create({
        message: '🖨️ Anteprima di stampa aperta.',
        duration: 2000,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: '❌ Errore durante la preparazione della stampa.',
        duration: 2500,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    }
  }

  async generaReport() {
    if (!this.isFormValid() || this.isExporting) return;
    this.isExporting = true;

    try {
      if (this.exportFormat === 'json') {
        const utenteId = localStorage.getItem('utente_id') || '';
        this.exportService.downloadJson(utenteId);

      } else if (this.exportFormat === 'csv') {
        const dati = await this.getDatiReali();
        const csvContent = this.exportService.generaReportCsv(dati);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        this.exportService.triggerDownload(
          blob,
          `peekbox_report_${this.exportScope}_${new Date().toISOString().slice(0, 10)}.csv`,
          'text/csv;charset=utf-8;'
        );

      } else if (this.exportFormat === 'pdf') {
        const datiDaEsportare = await this.getDatiReali();
        await this.caricaLogoBase64();
        const doc = await this.exportService.generaReportPdf(
          datiDaEsportare, this.exportScope, this.logoBase64
        );
        doc.save(`peekbox_report_${this.exportScope}_${new Date().toISOString().slice(0, 10)}.pdf`);
      }

      const toast = await this.toastCtrl.create({
        message: '✅ Download avviato con successo!',
        duration: 2500,
        color: 'success',
        position: 'bottom',
      });
      await toast.present();

    } catch (error) {
      console.error('[EsportaArchivio] Errore generazione report:', error);
      const toast = await this.toastCtrl.create({
        message: '❌ Errore durante la generazione. Riprova.',
        duration: 2500,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    } finally {
      this.isExporting = false;
      this.exportScope  = '';
      this.exportFormat = '';
    }
  }

  navTo(route: string) { this.navHistory.navTo(route); }

}