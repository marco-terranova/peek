import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RouteOptimizerService {

  /**
   * Nearest-neighbor algorithm returning the optimal visiting order of checkpoint indices.
   * Starts from index 0, then at each step picks the closest unvisited checkpoint.
   *
   * @param checkpoints - Array of checkpoint objects with latitudine/longitudine.
   * @param calcolaDistanza - Function that returns distance in metres between two lat/lng pairs.
   * @returns Array of indices representing the optimal order.
   */
  ottimizzaOrdine(
    checkpoints: any[],
    calcolaDistanza: (lat1: number, lng1: number, lat2: number, lng2: number) => number,
  ): number[] {
    if (checkpoints.length < 2) return checkpoints.map((_, i) => i);

    const used = new Set<number>();
    used.add(0);
    const order = [0];

    for (let i = 1; i < checkpoints.length; i++) {
      let best = -1;
      let bestDist = Infinity;
      const lastIdx = order[order.length - 1];
      const last = checkpoints[lastIdx];

      for (let j = 0; j < checkpoints.length; j++) {
        if (used.has(j)) continue;
        const dist = calcolaDistanza(
          last.latitudine, last.longitudine,
          checkpoints[j].latitudine, checkpoints[j].longitudine,
        );
        if (dist < bestDist) { bestDist = dist; best = j; }
      }
      if (best >= 0) { used.add(best); order.push(best); }
    }

    return order;
  }
}
