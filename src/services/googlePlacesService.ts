import Constants from 'expo-constants';
import API_BASE_URL from '../config/api';

interface PlacesPrediction {
  place_id: string;
  description: string;
}

interface PlacesAutocompleteResponse {
  status: string;
  predictions?: PlacesPrediction[];
  error_message?: string;
}

interface PlaceDetailsResponse {
  status: string;
  result?: {
    formatted_address?: string;
    name?: string;
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  };
  error_message?: string;
}

export interface AddressPrediction {
  placeId: string;
  description: string;
}

export interface AddressDetails {
  name: string;
  formattedAddress: string;
  latitude?: number;
  longitude?: number;
}

export interface PlacesDebugInfo {
  source: 'backend' | 'client' | 'none';
  status: string;
  errorMessage?: string;
}

function apiBaseTrimmed(): string {
  return (API_BASE_URL || '').replace(/\/$/, '');
}

export class GooglePlacesService {
  private static lastDebugInfo: PlacesDebugInfo = { source: 'none', status: 'IDLE' };

  static getLastDebugInfo(): PlacesDebugInfo {
    return this.lastDebugInfo;
  }

  private static setDebugInfo(info: PlacesDebugInfo): void {
    this.lastDebugInfo = info;
    console.log(`[Places] ${info.source.toUpperCase()} ${info.status}${info.errorMessage ? ` - ${info.errorMessage}` : ''}`);
  }

  private static getApiKey(): string {
    const extraKey = (Constants.expoConfig?.extra as any)?.googleMapsApiKey;
    const envKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    const key = (envKey || extraKey || '').trim();
    if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      return '';
    }
    return key;
  }

  static isConfigured(): boolean {
    return !!this.getApiKey();
  }

  /**
   * Prefer backend proxy (Render GOOGLE_MAPS_API_KEY) so autocomplete works without a client key
   * or when the key is restricted to server IPs only.
   */
  private static async fetchPredictionsViaBackend(input: string): Promise<AddressPrediction[] | null> {
    try {
      const url = `${apiBaseTrimmed()}/places/autocomplete?input=${encodeURIComponent(input)}`;
      const response = await fetch(url);
      if (response.status === 503) {
        this.setDebugInfo({ source: 'backend', status: 'HTTP_503', errorMessage: 'Backend key not configured' });
        return null;
      }
      if (!response.ok) {
        this.setDebugInfo({ source: 'backend', status: `HTTP_${response.status}` });
        return null;
      }
      const data = (await response.json()) as PlacesAutocompleteResponse;
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        this.setDebugInfo({
          source: 'backend',
          status: data.status || 'UNKNOWN',
          errorMessage: data.error_message,
        });
        return null;
      }
      this.setDebugInfo({ source: 'backend', status: data.status || 'OK' });
      return (data.predictions || []).map((p) => ({
        placeId: p.place_id,
        description: p.description,
      }));
    } catch (error: any) {
      this.setDebugInfo({ source: 'backend', status: 'ERROR', errorMessage: error?.message || 'Backend fetch failed' });
      return null;
    }
  }

  private static async fetchDetailsViaBackend(placeId: string): Promise<AddressDetails | null> {
    try {
      const url = `${apiBaseTrimmed()}/places/details?place_id=${encodeURIComponent(placeId)}`;
      const response = await fetch(url);
      if (response.status === 503) return null;
      if (!response.ok) return null;
      const data = (await response.json()) as PlaceDetailsResponse;
      if (data.status !== 'OK' || !data.result) return null;
      return {
        name: data.result.name || data.result.formatted_address || '',
        formattedAddress: data.result.formatted_address || '',
        latitude: data.result.geometry?.location?.lat,
        longitude: data.result.geometry?.location?.lng,
      };
    } catch {
      return null;
    }
  }

  static async getAddressPredictions(input: string): Promise<AddressPrediction[]> {
    const query = input.trim();
    if (query.length < 3) {
      this.setDebugInfo({ source: 'none', status: 'WAITING_FOR_INPUT' });
      return [];
    }

    const fromBackend = await this.fetchPredictionsViaBackend(query);
    if (fromBackend !== null) return fromBackend;

    if (!this.getApiKey()) {
      this.setDebugInfo({ source: 'none', status: 'NO_CLIENT_KEY' });
      return [];
    }

    const key = this.getApiKey();
    const url =
      'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
      `?input=${encodeURIComponent(query)}` +
      '&types=address' +
      '&language=en' +
      `&key=${encodeURIComponent(key)}`;

    const response = await fetch(url);
    const data = (await response.json()) as PlacesAutocompleteResponse;

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.setDebugInfo({
        source: 'client',
        status: data.status || 'UNKNOWN',
        errorMessage: data.error_message,
      });
      throw new Error(data.error_message || `Autocomplete failed (${data.status})`);
    }
    this.setDebugInfo({ source: 'client', status: data.status || 'OK' });

    return (data.predictions || []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  }

  static async getAddressDetails(placeId: string): Promise<AddressDetails | null> {
    if (!placeId) return null;

    const fromBackend = await this.fetchDetailsViaBackend(placeId);
    if (fromBackend) return fromBackend;

    if (!this.getApiKey()) return null;

    const key = this.getApiKey();
    const url =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      `?place_id=${encodeURIComponent(placeId)}` +
      '&fields=name,formatted_address,geometry' +
      '&language=en' +
      `&key=${encodeURIComponent(key)}`;

    const response = await fetch(url);
    const data = (await response.json()) as PlaceDetailsResponse;

    if (data.status !== 'OK' || !data.result) {
      return null;
    }

    return {
      name: data.result.name || data.result.formatted_address || '',
      formattedAddress: data.result.formatted_address || '',
      latitude: data.result.geometry?.location?.lat,
      longitude: data.result.geometry?.location?.lng,
    };
  }
}
