import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DettaglioBoxPage } from './dettaglio-box.page';

describe('DettaglioBoxPage', () => {
  let component: DettaglioBoxPage;
  let fixture: ComponentFixture<DettaglioBoxPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DettaglioBoxPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
