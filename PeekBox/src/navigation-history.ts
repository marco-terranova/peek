import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * NavigationHistoryService
 *
 * Tiene traccia della cronologia di navigazione interna all'app Angular/Ionic.
 *
 * Risolve due problemi:
 * 1. Location.back() del browser punta a URL sbagliate in una SPA (specialmente
 *    con replaceUrl:true o guard).
 * 2. La freccia indietro del browser porta a pagine sbagliate perché ogni
 *    routerLink aggiunge voci nella browser history.
 *
 * Strategia: tutte le navigazioni della navbar usano replaceUrl:true tramite
 * navTo(), così non accumulano voci nella browser history. Il tasto indietro
 * del browser funziona solo sulla history "reale" (pagine di dettaglio, ecc.).
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private history: string[] = [];

  // Route principali (navbar) — non devono impilare la browser history
  private readonly rootRoutes = ['/home', '/search', '/box-ricevute', '/profilo'];

  // Route che azzerano la cronologia (autenticazione)
  private readonly excludedRoutes = ['/benvenuto', '/login', '/registrazione'];

  constructor(private router: Router) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects;

        // Reset al login/logout
        if (this.excludedRoutes.some(r => url.startsWith(r))) {
          this.history = [];
          return;
        }

        // Non aggiungere duplicati consecutivi
        if (this.history.length > 0 && this.history[this.history.length - 1] === url) {
          return;
        }

        // Le root-route azzerano la history interna (si parte da capo)
        if (this.rootRoutes.some(r => url === r)) {
          this.history = [url];
          return;
        }

        this.history.push(url);
      });
  }

  /**
   * Naviga a una route principale della navbar usando replaceUrl:true.
   * Questo evita di accumulare voci nella browser history del browser
   * e quindi previene il comportamento errato della freccia indietro del browser.
   */
  navTo(route: string): void {
    this.router.navigateByUrl(route, { replaceUrl: true });
  }

  /** Restituisce true se c'è almeno una pagina precedente a cui tornare */
  canGoBack(): boolean {
    return this.history.length > 1;
  }

  /**
   * Torna alla pagina precedente nella history interna.
   * Se non c'è una pagina precedente, naviga al fallback.
   */
  back(fallback: string = '/home'): void {
    this.history.pop();
    const previousUrl = this.history.length > 0
      ? this.history[this.history.length - 1]
      : fallback;
    this.router.navigateByUrl(previousUrl, { replaceUrl: true });
  }

  /** Svuota la history (utile al logout) */
  clearHistory(): void {
    this.history = [];
  }

  getHistory(): string[] {
    return [...this.history];
  }
}
