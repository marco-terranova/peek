import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-benvenuto',
  templateUrl: './benvenuto.page.html',
  styleUrls: ['./benvenuto.page.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule, CommonModule],
})
export class BenvenutoPage {}
