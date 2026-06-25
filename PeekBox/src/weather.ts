import { Injectable } from '@angular/core';

export interface MeteoData {
  temperatura: number;
  codice: number;
  vento: number;
  ora: string;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {

  /**
   * Fetches current weather for the given coordinates from Open-Meteo.
   * Returns null on failure or if no data is available.
   */
  async getMeteoAttuale(
    lat: number,
    lng: number,
  ): Promise<MeteoData | null> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.current_weather) {
        return {
          temperatura: data.current_weather.temperature,
          codice: data.current_weather.weathercode,
          vento: data.current_weather.windspeed,
          ora: data.current_weather.time,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
