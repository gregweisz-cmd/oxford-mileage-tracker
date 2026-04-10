import Constants from 'expo-constants';

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

export class GooglePlacesService {
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

  static async getAddressPredictions(input: string): Promise<AddressPrediction[]> {
    const query = input.trim();
    if (query.length < 3 || !this.isConfigured()) return [];

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
      throw new Error(data.error_message || `Autocomplete failed (${data.status})`);
    }

    return (data.predictions || []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  }

  static async getAddressDetails(placeId: string): Promise<AddressDetails | null> {
    if (!placeId || !this.isConfigured()) return null;

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
