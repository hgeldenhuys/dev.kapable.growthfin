/**
 * Google Maps API Provider
 * https://developers.google.com/maps/documentation/places/web-service
 *
 * Provides business lookup and address verification with graceful degradation
 * when API key is not configured or API calls fail.
 */

export interface GoogleMapsBusinessResult {
  name: string;
  placeId: string;
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  types?: string[]; // Business types (restaurant, store, etc.)
  openingHours?: {
    openNow?: boolean;
    weekdayText?: string[];
  };
  photos?: Array<{
    photoReference: string;
    height: number;
    width: number;
  }>;
  verified?: boolean;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
}

interface PlacesAPIResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  business_status?: string;
}

interface PlacesSearchResponse {
  results: PlacesAPIResult[];
  status: string;
  error_message?: string;
}

export class GoogleMapsProvider {
  private apiKey: string;
  private baseUrl = 'https://places.googleapis.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';
  }

  /**
   * Search for a business by name and optional location
   * Falls back to mock results if API key not configured or on error
   */
  async searchBusiness(
    query: string,
    location?: string
  ): Promise<GoogleMapsBusinessResult[]> {
    if (!this.apiKey) {
      console.error('❌ GOOGLE_MAPS_API_KEY not configured — business lookup unavailable');
      return [];
    }

    try {
      console.log(`🗺️  Google Maps: Searching "${query}"${location ? ` near ${location}` : ''}`);

      // Build search query
      const searchQuery = location ? `${query} ${location}` : query;

      // Use Places API (New) - Text Search endpoint
      const searchResponse = await fetch(
        `${this.baseUrl}/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.currentOpeningHours,places.photos,places.businessStatus'
          },
          body: JSON.stringify({
            textQuery: searchQuery,
            pageSize: 3 // Limit to top 3 results
          })
        }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text().catch(() => 'Unknown error');
        throw new Error(`Google Maps API error: ${searchResponse.status} - ${errorText}`);
      }

      const searchData = await searchResponse.json();

      if (!searchData.places || searchData.places.length === 0) {
        console.warn('Google Maps: No results found for query:', query);
        return [];
      }

      // Transform new API response format to our interface
      const detailedResults: GoogleMapsBusinessResult[] = searchData.places.map((place: any) => ({
        name: place.displayName?.text || 'Unknown',
        placeId: place.id || '',
        address: place.formattedAddress || '',
        lat: place.location?.latitude,
        lng: place.location?.longitude,
        phone: place.internationalPhoneNumber,
        website: place.websiteUri,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        types: place.types,
        openingHours: place.currentOpeningHours
          ? {
              openNow: place.currentOpeningHours.openNow,
              weekdayText: place.currentOpeningHours.weekdayText,
            }
          : undefined,
        photos: place.photos?.map((p: any) => ({
          photoReference: p.name,
          height: p.heightPx || 0,
          width: p.widthPx || 0,
        })),
        verified: place.userRatingCount && place.userRatingCount > 5,
        businessStatus: place.businessStatus || 'OPERATIONAL',
      }));

      console.log(`✅ Google Maps returned ${detailedResults.length} results`);
      return detailedResults;
    } catch (error) {
      console.error(
        '❌ Google Maps failed:',
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  /**
   * Fallback mock results when API unavailable
   */
  private getMockResults(
    query: string,
    location?: string
  ): GoogleMapsBusinessResult[] {
    const lowerQuery = query.toLowerCase();

    // Extract potential company name
    const companyName = query.split(/\s+/).slice(0, 3).join(' ');

    return [
      {
        name: companyName || 'Mock Business',
        placeId: 'mock_place_id_123',
        address: location
          ? `123 Main St, ${location}`
          : '123 Main St, Cape Town, South Africa',
        lat: -33.9249,
        lng: 18.4241,
        phone: '+27 21 123 4567',
        website: `https://${lowerQuery.replace(/\s+/g, '')}.com`,
        rating: 4.2,
        userRatingsTotal: 156,
        types: ['business', 'establishment'],
        openingHours: {
          openNow: true,
          weekdayText: [
            'Monday: 9:00 AM – 5:00 PM',
            'Tuesday: 9:00 AM – 5:00 PM',
            'Wednesday: 9:00 AM – 5:00 PM',
            'Thursday: 9:00 AM – 5:00 PM',
            'Friday: 9:00 AM – 5:00 PM',
            'Saturday: Closed',
            'Sunday: Closed',
          ],
        },
        verified: true,
        businessStatus: 'OPERATIONAL',
      },
    ];
  }
}

// Singleton instance
let googleMapsInstance: GoogleMapsProvider | null = null;

/**
 * Get or create singleton Google Maps provider instance
 */
export function getGoogleMapsProvider(): GoogleMapsProvider {
  if (!googleMapsInstance) {
    googleMapsInstance = new GoogleMapsProvider();
  }
  return googleMapsInstance;
}
