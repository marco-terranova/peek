import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

// Rotte PUBBLICHE: accessibili senza login
// Rotte PROTETTE: richiedono authGuard (token JWT nel localStorage)

export const routes: Routes = [

  // ── Redirect radice ───────────────────────────────────────────────
  { path: '', redirectTo: 'benvenuto', pathMatch: 'full' },

  // ── Rotte PUBBLICHE (no guard) ─────────────────────────────────
  {
    path: 'benvenuto',
    loadComponent: () => import('./benvenuto/benvenuto.page').then(m => m.BenvenutoPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'not-found',
    loadComponent: () => import('./not-found/not-found.page').then(m => m.NotFoundPage)
  },

  // ── Rotte PROTETTE (canActivate: authGuard) ───────────────────
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then(m => m.HomePage)
  },
  {
    path: 'crea-box',
    canActivate: [authGuard],
    loadComponent: () => import('./crea-box/crea-box.page').then(m => m.CreaBoxPage)
  },
  {
    path: 'dettaglio-box/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./dettaglio-box/dettaglio-box.page').then(m => m.DettaglioBoxPage)
  },
  {
    path: 'search',
    canActivate: [authGuard],
    loadComponent: () => import('./search/search.page').then(m => m.SearchPage)
  },
  {
    path: 'gestione-spazi',
    canActivate: [authGuard],
    loadComponent: () => import('./gestione-spazi/gestione-spazi.page').then(m => m.GestioneSpaziPage)
  },
  {
    path: 'box-ricevute',
    canActivate: [authGuard],
    loadComponent: () => import('./box-ricevute/box-ricevute.page').then(m => m.BoxRicevutePage)
  },
  {
    path: 'tracking-box',
    canActivate: [authGuard],
    loadComponent: () => import('./tracking-box/tracking-box.page').then(m => m.TrackingBoxPage)
  },
  {
    path: 'transit-zone',
    canActivate: [authGuard],
    loadComponent: () => import('./transit-zone/transit-zone.page').then(m => m.TransitZonePage)
  },
  {
    path: 'geofence-armadio/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./geofence-armadio/geofence-armadio.page').then(m => m.GeofenceArmadioPage)
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./admin/admin.page').then(m => m.AdminPage)
  },
  {
    path: 'scan-qr',
    canActivate: [authGuard],
    loadComponent: () => import('./scan-qr/scan-qr.page').then(m => m.ScanQrPage)
  },
  {
    path: 'cestino',
    canActivate: [authGuard],
    loadComponent: () => import('./cestino/cestino.page').then(m => m.CestinoPage)
  },
  {
    path: 'informazioni-account',
    canActivate: [authGuard],
    loadComponent: () => import('./informazioni-account/informazioni-account.page').then(m => m.InformazioniAccountPage)
  },
  {
    path: 'filtri',
    canActivate: [authGuard],
    loadComponent: () => import('./filtri/filtri.page').then(m => m.FiltriPage)
  },
  {
    path: 'esporta-archivio',
    canActivate: [authGuard],
    loadComponent: () => import('./esporta-archivio/esporta-archivio.page').then(m => m.EsportaArchivioPage)
  },
  {
    path: 'profilo',
    canActivate: [authGuard],
    loadComponent: () => import('./profilo/profilo.page').then(m => m.ProfiloPage)
  },
  {
    path: 'condividi-archivio',
    canActivate: [authGuard],
    loadComponent: () => import('./condividi-archivio/condividi-archivio.page').then(m => m.CondividiArchivioPage)
  },
  {
    path: 'messaggi',
    canActivate: [authGuard],
    loadComponent: () => import('./messaggi/messaggi.page').then(m => m.MessaggiPage)
  },

  // ── Wildcard 404 — DEVE essere l'ultima voce ─────────────────────
  { path: '**', redirectTo: 'not-found' },
];
