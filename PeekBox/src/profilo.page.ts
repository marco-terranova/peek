import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { DatabaseService } from '../services/database';
import { NavigationHistoryService } from '../services/navigation-history';
import { ChatbotComponent } from '../components/chatbot/chatbot.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profilo',
  templateUrl: './profilo.page.html',
  styleUrls: ['./profilo.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, ChatbotComponent],
})
export class ProfiloPage implements OnInit {
  userName = '';
  userEmail = '';
  utenteId: string | null = null;
  initials = '';
  tipoProfilo = '';

  numBox = 0;
  numOggetti = 0;
  numElementi = 0;
  numCondivisi = 0;
  numNotifiche = 0;
  numCheckpoint = 0;
  numTransit = 0;
  numCestino = 0;
  isAdmin = false;
  loading = true;

  boxList: any[] = [];
  posizioni: any[] = [];
  boxOrfane: any[] = [];

  nuovoNomePos = '';
  nuoveBoxPos: Set<number> = new Set();
  apertoCrea = false;

  constructor(
    private router: Router,
    private dbService: DatabaseService,
    public navHistory: NavigationHistoryService,
  ) {}

  ngOnInit() {
    this.utenteId = localStorage.getItem('utente_id');
    this.userName = localStorage.getItem('utente_nome') || 'Utente';
    this.userEmail = localStorage.getItem('utente_email') || '';
    this.initials = this.calcInitials(this.userName);
    this.tipoProfilo = localStorage.getItem('tipo_profilo') || 'personal';
    this.isAdmin = localStorage.getItem('is_admin') === '1';
    if (this.utenteId) {
      this.caricaStatistiche();
    } else {
      this.loading = false;
    }
  }

  private calcInitials(nome: string): string {
    const parts = nome.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  }

  private async caricaStatistiche() {
    try {
      const uid = this.utenteId!;
      const [boxRes, notifRes, checkRes, cestinoRes] = await Promise.all([
        firstValueFrom(this.dbService.getBox(uid)),
        firstValueFrom(this.dbService.getNotificheGeofence()).catch(() => []),
        firstValueFrom(this.dbService.getTuttiCheckpoint(uid)).catch(() => []),
        firstValueFrom(this.dbService.getBoxEliminate(uid)).catch(() => ({ box_eliminate: [] })),
      ]);
      this.boxList = (boxRes as any).box || [];
      this.numBox = this.boxList.length;

      this.numNotifiche = (notifRes as any)?.length || 0;
      this.numCheckpoint = (checkRes as any)?.length || 0;
      this.numTransit = this.boxList.filter((b: any) => b.moving_mode).length;
      this.numCestino = (cestinoRes as any)?.box_eliminate?.length || 0;

      this.numOggetti = this.boxList.reduce((sum: number, b: any) => sum + (b.num_oggetti || 0), 0);
      this.numElementi = this.numOggetti;

      if (this.boxList.length > 0) {
        const condivisioniResults = await Promise.all(
          this.boxList.map((b: any) =>
            firstValueFrom(this.dbService.getCondivisioniArchivio(b.id))
              .catch(() => ([]))
          )
        );
        this.numCondivisi = condivisioniResults.filter((r: any) => {
          const lista = r?.condivisioni || r || [];
          return Array.isArray(lista) ? lista.length > 0 : false;
        }).length;
      } else {
        this.numCondivisi = 0;
      }

      this.leggiPosizioni();
    } catch (err) {
      console.error('[Profilo] Errore caricamento statistiche:', err);
    }
    this.loading = false;
  }

  private leggiPosizioni() {
    if (!this.utenteId) return;
    this.dbService.getArmadi(this.utenteId).subscribe({
      next: (res: any) => {
        this.posizioni = (res.armadi || []).map((a: any) => ({
          id: a.id,
          nome: a.nome,
          num_box: a.num_box || 0
        }));
      },
      error: () => { this.posizioni = []; }
    });
    this.dbService.getBoxOrfane(this.utenteId).subscribe({
      next: (res: any) => { this.boxOrfane = res.box_orfane || []; },
      error: () => { this.boxOrfane = []; }
    });
  }

  get boxAttesaList() {
    return this.boxOrfane;
  }

  get totAssegnate() {
    return this.posizioni.reduce((s: number, p: any) => s + (p.num_box || 0), 0);
  }

  eliminaPosizione(pos: any) {
    if (!pos?.id) return;
    this.dbService.eliminaArmadio(pos.id).subscribe({
      next: () => { this.leggiPosizioni(); },
      error: () => {}
    });
  }

  assegnaBoxEsistente(box: any) {
    if (!box._spazio) return;
    this.dbService.riallocaBox(box.id, box._spazio).subscribe({
      next: () => { this.leggiPosizioni(); },
      error: () => {}
    });
  }

  apriCrea() {
    this.apertoCrea = true;
    this.nuovoNomePos = '';
    this.nuoveBoxPos = new Set();
  }

  chiudiCrea() {
    this.apertoCrea = false;
    this.nuovoNomePos = '';
    this.nuoveBoxPos = new Set();
  }

  toggleBox(boxId: number) {
    if (this.nuoveBoxPos.has(boxId)) this.nuoveBoxPos.delete(boxId);
    else this.nuoveBoxPos.add(boxId);
  }

  creaPosizione() {
    const n = this.nuovoNomePos.trim();
    if (!n || !this.utenteId) return;
    this.dbService.creaArmadio(n, this.utenteId).subscribe({
      next: (res: any) => {
        const nuovoId = res.id;
        const boxDaAssegnare = Array.from(this.nuoveBoxPos);
        if (boxDaAssegnare.length > 0 && nuovoId) {
          let completate = 0;
          for (const boxId of boxDaAssegnare) {
            this.dbService.riallocaBox(boxId, nuovoId).subscribe({
              next: () => { completate++; if (completate === boxDaAssegnare.length) this.leggiPosizioni(); },
              error: () => { completate++; if (completate === boxDaAssegnare.length) this.leggiPosizioni(); }
            });
          }
        } else {
          this.leggiPosizioni();
        }
        this.chiudiCrea();
      },
      error: () => {}
    });
  }

  vai(route: string) {
    this.router.navigateByUrl(route, { replaceUrl: true });
  }

  logout() {
    localStorage.clear();
    this.router.navigateByUrl('/benvenuto', { replaceUrl: true });
  }
}
