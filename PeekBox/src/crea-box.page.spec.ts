import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreaBoxPage } from './crea-box.page';

describe('CreaBoxPage', () => {
  let component: CreaBoxPage;
  let fixture: ComponentFixture<CreaBoxPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CreaBoxPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
