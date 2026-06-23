import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.page.html',
  styleUrls: ['./not-found.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent],
})
export class NotFoundPage {
  constructor(private router: Router) {}

  vai(route: string) {
    this.router.navigateByUrl(route, { replaceUrl: true });
  }
}