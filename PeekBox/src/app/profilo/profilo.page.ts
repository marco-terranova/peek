import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, IonicModule, ChatbotComponent],
})
export class ProfiloPage implements OnInit {
  userName = '';
  userEmail = '';
  utenteId: string | null = null;
  initials = '';
  tipoProfilo = '';

  numBox = 0;
  numOggetti = 0;
  numArmadi = 0;
  numCondivisi = 0;
  numNotifiche = 0;
  numCheckpoint = 0;
  numTransit = 0;
  numCestino = 0;
  isAdmin = false;
  loading = true;

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
      const [boxRes, armadiRes, condivisiRes, notifRes, checkRes, cestinoRes] = await Promise.all([
        firstValueFrom(this.dbService.getBox(uid)),
        firstValueFrom(this.dbService.getArmadi(uid)),
        firstValueFrom(this.dbService.getArchividCondivisiConMe(uid)),
        firstValueFrom(this.dbService.getNotificheGeofence()).catch(() => []),
        firstValueFrom(this.dbService.getTuttiCheckpoint(uid)).catch(() => []),
        firstValueFrom(this.dbService.getBoxEliminate(uid)).catch(() => ({ box_eliminate: [] })),
      ]);
      const boxList = (boxRes as any).box || [];
      this.numBox = boxList.length;
      this.numArmadi = (armadiRes as any).length || 0;
      this.numCondivisi = (condivisiRes as any).archivi_condivisi?.length || 0;
      this.numNotifiche = (notifRes as any)?.length || 0;
      this.numCheckpoint = (checkRes as any)?.length || 0;

      this.numTransit = boxList.filter((b: any) => b.moving_mode).length;
      this.numCestino = (cestinoRes as any)?.box_eliminate?.length || 0;

      this.numOggetti = boxList.reduce((sum: number, b: any) => sum + (b.num_oggetti || 0), 0);
    } catch (err) {
      console.error('[Profilo] Errore caricamento statistiche:', err);
    }
    this.loading = false;
  }

  vai(route: string) {
    this.router.navigateByUrl(route, { replaceUrl: true });
  }

  logout() {
    localStorage.clear();
    this.router.navigateByUrl('/benvenuto', { replaceUrl: true });
  }
}
