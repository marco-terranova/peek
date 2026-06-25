import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private history: string[] = [];

  private readonly rootRoutes = ['/home', '/search', '/box-ricevute', '/profilo'];

  private readonly excludedRoutes = ['/benvenuto', '/login', '/registrazione'];

  constructor(private router: Router) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects;

        if (this.excludedRoutes.some(r => url.startsWith(r))) {
          this.history = [];
          return;
        }

        if (this.history.length > 0 && this.history[this.history.length - 1] === url) {
          return;
        }

        if (this.rootRoutes.some(r => url === r)) {
          this.history = [url];
          return;
        }

        this.history.push(url);
      });
  }

  navTo(route: string): void {
    this.router.navigateByUrl(route, { replaceUrl: true });
  }

  canGoBack(): boolean {
    return this.history.length > 1;
  }

  back(fallback: string = '/home'): void {
    this.history.pop();
    const previousUrl = this.history.length > 0
      ? this.history[this.history.length - 1]
      : fallback;
    this.router.navigateByUrl(previousUrl, { replaceUrl: true });
  }

  clearHistory(): void {
    this.history = [];
  }

  getHistory(): string[] {
    return [...this.history];
  }
}
