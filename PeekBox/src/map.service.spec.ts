import { TestBed } from '@angular/core/testing';
import { MapService } from './map';

describe('MapService', () => {
  let service: MapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('inizializzaMappa() should return a valid L.Map instance', () => {
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    const map = service.inizializzaMappa(container, [45.4642, 9.1900], 10);

    expect(map).toBeTruthy();
    expect(map.getCenter().lat).toBeCloseTo(45.4642, 3);
    expect(map.getCenter().lng).toBeCloseTo(9.1900, 3);
    expect(map.getZoom()).toBe(10);

    map.remove();
    document.body.removeChild(container);
  });
});
