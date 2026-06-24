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
  posizioni: { nome: string; ids: number[] }[] = [];
  boxAttesa: number[] = [];

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
    this.migra();
    try {
      const d = localStorage.getItem('peek_pos');
      if (d) {
        const arr: any[] = JSON.parse(d);
        this.posizioni = Array.isArray(arr) ? arr.filter(p => p).map(p => ({ nome: p.nome || p.n || '', ids: Array.isArray(p.ids) ? p.ids : [] })).filter(p => p.nome) : [];
      } else {
        this.posizioni = [];
      }
    } catch { this.posizioni = []; }
    try {
      const r = localStorage.getItem('peek_attesa');
      this.boxAttesa = r ? JSON.parse(r) : [];
      if (!Array.isArray(this.boxAttesa)) this.boxAttesa = [];
    } catch { this.boxAttesa = []; }
    this.pulisci();
  }

  private migra() {
    for (const posKey of ['pb_posizioni', 'pp_posizioni', 'pb_posizione_attuale']) {
      const raw = localStorage.getItem(posKey);
      if (!raw) continue;
      try {
        let arr: { nome: string; ids: number[] }[] = [];
        if (posKey === 'pb_posizione_attuale') {
          const idsRaw = localStorage.getItem('pb_box_ids_posizione');
          const ids: number[] = idsRaw ? JSON.parse(idsRaw) : [];
          arr = [{ nome: raw, ids: Array.isArray(ids) ? ids.filter((x: any) => typeof x === 'number') : [] }];
        } else {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            arr = parsed.map((p: any) => ({ nome: p.nome || p.n || String(p), ids: Array.isArray(p.ids || p.boxIds) ? (p.ids || p.boxIds) : [] }));
          } else if (typeof parsed === 'object') {
            arr = Object.entries(parsed).map(([k, v]) => ({ nome: k, ids: Array.isArray(v) ? v.filter((x: any) => typeof x === 'number') : [] }));
          }
        }
        arr = arr.filter(x => x.nome);
        if (arr.length) {
          localStorage.setItem('peek_pos', JSON.stringify(arr));
          break;
        }
      } catch {}
    }
    for (const attKey of ['pb_in_attesa_ids', 'pp_attesa_ids']) {
      const attRaw = localStorage.getItem(attKey);
      if (!attRaw) continue;
      try {
        const ids = JSON.parse(attRaw);
        if (Array.isArray(ids) && ids.length) {
          localStorage.setItem('peek_attesa', JSON.stringify(ids.filter((x: any) => typeof x === 'number')));
          break;
        }
      } catch {}
    }
    for (const k of ['pb_posizioni', 'pb_in_attesa_ids', 'pb_posizione_attuale', 'pb_box_ids_posizione', 'pp_posizioni', 'pp_attesa_ids']) {
      try { localStorage.removeItem(k); } catch {}
    }
  }

  private salva() {
    localStorage.setItem('peek_pos', JSON.stringify(this.posizioni));
    localStorage.setItem('peek_attesa', JSON.stringify(this.boxAttesa));
  }

  private pulisci() {
    const assegnati = new Set<number>();
    for (const p of this.posizioni) for (const id of p.ids) assegnati.add(id);
    this.boxAttesa = this.boxAttesa.filter(id => !assegnati.has(id));
    this.salva();
  }

  get boxAttesaList() {
    return this.boxList.filter((b: any) => this.boxAttesa.includes(b.id));
  }

  get totAssegnate() {
    return this.posizioni.reduce((s, p) => s + p.ids.length, 0);
  }

  eliminaPosizione(nome: string) {
    const pos = this.posizioni.find(p => p.nome === nome);
    if (!pos) return;
    for (const id of pos.ids) {
      if (!this.boxAttesa.includes(id)) this.boxAttesa.push(id);
    }
    this.posizioni = this.posizioni.filter(p => p.nome !== nome);
    this.salva();
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
    if (!n) return;
    if (this.posizioni.some(p => p.nome === n)) return;
    const ids = Array.from(this.nuoveBoxPos);
    this.posizioni.push({ nome: n, ids });
    this.boxAttesa = this.boxAttesa.filter(id => !ids.includes(id));
    this.salva();
    this.chiudiCrea();
  }

  vai(route: string) {
    this.router.navigateByUrl(route, { replaceUrl: true });
  }

  logout() {
    localStorage.clear();
    this.router.navigateByUrl('/benvenuto', { replaceUrl: true });
  }
}
