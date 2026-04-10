export interface WebAddressPrediction {
  placeId: string;
  description: string;
}

export interface WebAddressDetails {
  formattedAddress: string;
  latitude?: number;
  longitude?: number;
}

interface GoogleAutocompleteResponse {
  status: string;
  predictions?: Array<{ place_id: string; description: string }>;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result?: {
    formatted_address?: string;
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  };
}

export class WebGooglePlacesService {
  private static getApiKey(): string {
    return (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '').trim();
  }

  static isConfigured(): boolean {
    return !!this.getApiKey();
  }

  static async getPredictions(input: string): Promise<WebAddressPrediction[]> {
    if (!this.isConfigured() || input.trim().length < 3) return [];
    const key = this.getApiKey();
    const url =
      'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
      `?input=${encodeURIComponent(input.trim())}` +
      '&types=address' +
      '&language=en' +
      `&key=${encodeURIComponent(key)}`;

    const response = await fetch(url);
    const data = (await response.json()) as GoogleAutocompleteResponse;
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
    return (data.predictions || []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  }

  static async getDetails(placeId: string): Promise<WebAddressDetails | null> {
    if (!this.isConfigured() || !placeId) return null;
    const key = this.getApiKey();
    const url =
      'https://maps.googleapis.com/maps/api/place/details/json' +
      `?place_id=${encodeURIComponent(placeId)}` +
      '&fields=formatted_address,geometry' +
      '&language=en' +
      `&key=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    const data = (await response.json()) as GooglePlaceDetailsResponse;
    if (data.status !== 'OK' || !data.result) return null;
    return {
      formattedAddress: data.result.formatted_address || '',
      latitude: data.result.geometry?.location?.lat,
      longitude: data.result.geometry?.location?.lng,
    };
  }
}
