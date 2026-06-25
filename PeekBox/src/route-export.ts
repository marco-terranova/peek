import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RouteExportService {

  /**
   * Generates a GeoJSON FeatureCollection string from checkpoints.
   */
  generaGeoJSON(checkpoints: any[]): string {
    const features = checkpoints.map((cp: any, i: number) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(cp.longitudine), Number(cp.latitudine)] },
      properties: {
        id: i + 1,
        label: cp.label || `Posizione #${i + 1}`,
        timestamp: cp.timestamp,
        accuratezza: cp.accuratezza || null,
      },
    }));
    const geojson = { type: 'FeatureCollection', features };
    return JSON.stringify(geojson, null, 2);
  }

  /**
   * Generates a GPX string from checkpoints.
   */
  generaGPX(checkpoints: any[]): string {
    const wpt = checkpoints.map((cp: any, i: number) => {
      const ele = cp.elevazione ? `<ele>${cp.elevazione}</ele>` : '';
      return `  <wpt lat="${cp.latitudine}" lon="${cp.longitudine}">
    <name>${cp.label || `Posizione #${i + 1}`}</name>
    <time>${cp.timestamp ? new Date(cp.timestamp).toISOString() : ''}</time>
    ${ele}
    <cmt>Accuratezza: ${cp.accuratezza || 'N/A'}m</cmt>
  </wpt>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PeekBox" xmlns="http://www.topografix.com/GPX/1/1">
${wpt}
</gpx>`;
  }

  /**
   * Generates a CSV string from checkpoints.
   */
  generaCSV(checkpoints: any[]): string {
    const header = 'id,label,latitudine,longitudine,timestamp,accuratezza\n';
    const rows = checkpoints.map((cp: any, i: number) =>
      `${i + 1},"${cp.label || `Posizione #${i + 1}`}",${cp.latitudine},${cp.longitudine},"${cp.timestamp || ''}",${cp.accuratezza || ''}`
    ).join('\n');
    return header + rows;
  }

  /**
   * Generates a KML string from checkpoints.
   */
  generaKML(checkpoints: any[], boxId: number): string {
    const placemarks = checkpoints.map((cp: any, i: number) => `  <Placemark>
    <name>${cp.label || `Posizione #${i + 1}`}</name>
    <description>Timestamp: ${cp.timestamp || 'N/A'}</description>
    <Point><coordinates>${cp.longitudine},${cp.latitudine},0</coordinates></Point>
  </Placemark>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Tracking Box ${boxId}</name>
${placemarks}
</Document>
</kml>`;
  }
}
