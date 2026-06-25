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

  /**
   * Initialises a Leaflet map on the given container element.
   * @param container - The HTMLElement where the map will be rendered.
   * @param center - The initial centre coordinates [lat, lng] (default Roma).
   * @param zoom - The initial zoom level (default 13).
   * @returns A new L.Map instance.
   */
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

  /**
   * Creates a tile layer and adds it to the map, removing a previous layer if given.
   * @param map - The Leaflet map instance.
   * @param layerConfig - Object with `url` and `attr` for the tile layer.
   * @param previousLayer - Optional previous tile layer to remove first.
   * @returns The new L.TileLayer instance.
   */
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

  /**
   * Creates a numbered marker using a custom L.divIcon with a coloured pin and numeric badge.
   * Matches the style used in tracking-box checkpoints.
   * @param latLng - The geographic position of the marker.
   * @param numero - The number displayed inside the badge.
   * @param colore - The CSS colour string for the pin background.
   * @param extraClass - Optional extra CSS class for the pin (e.g. "tb-marker-pin--edge").
   * @returns A new L.Marker instance.
   */
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

  /**
   * Creates a circle overlay representing a geofence perimeter.
   * @param center - The geographic centre of the circle.
   * @param raggioM - The radius in metres.
   * @param opzioni - Optional styling overrides (colour, dashArray, fillOpacity).
   * @returns A new L.Circle instance.
   */
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

  /**
   * Creates a marker for the geofence centre point.
   * When `editabile` is true the marker is draggable and uses the editing style (blue).
   * When false the marker is static and uses the standard green style.
   * @param center - The geographic position of the geofence centre.
   * @param editabile - Whether the marker should be draggable for editing.
   * @returns A new L.Marker instance.
   */
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

  /**
   * Creates an empty L.FeatureGroup for grouping layers.
   * @returns A new L.FeatureGroup instance.
   */
  creaFeatureGroup(): L.FeatureGroup {
    return L.featureGroup();
  }
}
