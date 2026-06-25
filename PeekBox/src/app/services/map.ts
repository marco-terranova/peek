import { Injectable } from '@angular/core';
import * as L from 'leaflet';

export interface TileLayerConfig {
  url: string;
  attr: string;
}

export interface MarkerIconOptions {
  html?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
  className?: string;
}

@Injectable({ providedIn: 'root' })
export class MapService {

  inizializzaMappa(
    container: HTMLElement,
    center: L.LatLngExpression = [41.9028, 12.4964],
    zoom: number = 13,
  ): L.Map {
    const map = L.map(container, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });
    setTimeout(() => map.invalidateSize(), 200);
    return map;
  }

  creaTileLayer(
    map: L.Map,
    layerConfig: TileLayerConfig,
    previousLayer?: L.TileLayer,
  ): L.TileLayer {
    if (previousLayer) {
      map.removeLayer(previousLayer);
    }
    const layer = L.tileLayer(layerConfig.url, {
      maxZoom: 19,
      attribution: layerConfig.attr,
    }).addTo(map);
    return layer;
  }

  creaMarkerNumerato(
    latLng: L.LatLngExpression,
    numero: number,
    colore: string,
    extraClass?: string,
  ): L.Marker {
    return L.marker(latLng, {
      icon: L.divIcon({
        className: 'tb-marker-custom',
        html: `<div class="tb-marker-pin${extraClass || ''}" style="background:${colore};box-shadow:0 2px 8px ${colore}66"><span class="tb-marker-num">${numero}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36],
      }),
    });
  }

  creaCerchioGeofence(
    center: L.LatLngExpression,
    raggioM: number,
    opzioni?: { colore?: string; dashArray?: string; fillOpacity?: number },
  ): L.Circle {
    const colore = opzioni?.colore || '#7DC740';
    const opts: L.CircleOptions = {
      radius: raggioM,
      color: colore,
      fillColor: colore,
      fillOpacity: opzioni?.fillOpacity ?? 0.08,
      weight: 2,
    };
    if (opzioni?.dashArray) {
      opts.dashArray = opzioni.dashArray;
    }
    return L.circle(center, opts);
  }

  creaMarkerGeofence(
    center: L.LatLngExpression,
    editabile: boolean,
    opzioni?: MarkerIconOptions,
  ): L.Marker {
    if (editabile) {
      return L.marker(center, {
        draggable: true,
        icon: L.divIcon({
          className: opzioni?.className || 'tb-marker-geofence-edit',
          html: opzioni?.html || `<div class="tb-gf-edit-pin"><svg viewBox="0 0 24 24" width="22" height="22" fill="#3AABDB" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></div>`,
          iconSize: opzioni?.iconSize || [32, 32],
          iconAnchor: opzioni?.iconAnchor || [16, 16],
        }),
      });
    }
    return L.marker(center, {
      icon: L.divIcon({
        className: opzioni?.className || 'tb-marker-geofence',
        html: opzioni?.html || `<div class="tb-gf-pin"><svg viewBox="0 0 24 24" width="18" height="18" fill="#7DC740" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></div>`,
        iconSize: opzioni?.iconSize || [32, 32],
        iconAnchor: opzioni?.iconAnchor || [16, 16],
      }),
    });
  }

  creaFeatureGroup(): L.FeatureGroup {
    return L.featureGroup();
  }
}
