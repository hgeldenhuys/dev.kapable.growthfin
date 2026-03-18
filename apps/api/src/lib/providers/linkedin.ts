/**
 * LinkedIn Profile Provider via RapidAPI
 * https://rapidapi.com/rockapis-rockapis-default/api/fresh-linkedin-profile-data
 *
 * Provides LinkedIn profile enrichment with graceful degradation
 * when API key is not configured or API calls fail.
 */

export interface LinkedInProfileResult {
  firstName?: string;
  lastName?: string;
  headline?: string;
  summary?: string;
  location?: string;
  country?: string;
  currentCompany?: string;
  currentPosition?: string;
  profileUrl?: string;
  photoUrl?: string;
  connections?: number;
  followerCount?: number;
  experience?: Array<{
    title: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
    startYear?: string;
    endYear?: string;
  }>;
  skills?: string[];
}

interface RapidAPILinkedInResponse {
  data?: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    summary?: string;
    geo?: {
      city?: string;
      state?: string;
      country?: string;
    };
    position?: Array<{
      title?: string;
      companyName?: string;
      location?: string;
      start?: { year?: number; month?: number };
      end?: { year?: number; month?: number };
      current?: boolean;
    }>;
    education?: Array<{
      schoolName?: string;
      degree?: string;
      fieldOfStudy?: string;
      start?: { year?: number };
      end?: { year?: number };
    }>;
    skills?: Array<{ name?: string }>;
    profilePicture?: string;
    publicIdentifier?: string;
    connections?: number;
    followerCount?: number;
  };
  message?: string;
  status?: string;
}

export class LinkedInProvider {
  private apiKey: string;
  private baseUrl = 'https://fresh-linkedin-profile-data.p.rapidapi.com';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.RAPIDAPI_LINKEDIN_KEY || '';
  }

  /**
   * Get LinkedIn profile by URL or public identifier
   * Falls back to mock results if API key not configured or on error
   */
  async getProfile(
    profileUrl: string
  ): Promise<LinkedInProfileResult | null> {
    if (!this.apiKey) {
      console.error('❌ RAPIDAPI_LINKEDIN_KEY not configured — LinkedIn lookup unavailable');
      return null;
    }

    try {
      console.log(`💼 LinkedIn: Fetching profile "${profileUrl}"`);

      // Extract LinkedIn username from URL
      const username = this.extractUsername(profileUrl);
      if (!username) {
        throw new Error('Invalid LinkedIn URL');
      }

      const response = await fetch(
        `${this.baseUrl}/enrich-lead?linkedin_url=${encodeURIComponent(profileUrl)}&include_skills=true&include_certifications=false&include_publications=false&include_honors=false&include_volunteers=false&include_projects=false&include_patents=false&include_courses=false&include_organizations=false&include_profile_status=false&include_company_public_url=false`,
        {
          headers: {
            'x-rapidapi-key': this.apiKey,
            'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `LinkedIn API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data: RapidAPILinkedInResponse = await response.json();

      if (!data.data) {
        throw new Error(data.message || 'Failed to fetch LinkedIn profile');
      }

      const profile = data.data;

      // Get current position from experiences array
      const currentExperience = profile.position?.find((p) => p.current) || profile.position?.[0];

      // Parse name from full_name if firstName/lastName not available
      const nameParts = profile.firstName && profile.lastName
        ? [profile.firstName, profile.lastName]
        : ((profile as any).full_name || '').split(' ');
      const firstName = profile.firstName || nameParts[0] || '';
      const lastName = profile.lastName || nameParts.slice(1).join(' ') || '';

      const result: LinkedInProfileResult = {
        firstName,
        lastName,
        headline: profile.headline || (profile as any).job_title,
        summary: profile.summary || (profile as any).about,
        location: (profile as any).city
          ? `${(profile as any).city}${(profile as any).state ? `, ${(profile as any).state}` : ''}`
          : profile.geo?.city
          ? `${profile.geo.city}${profile.geo.state ? `, ${profile.geo.state}` : ''}`
          : undefined,
        country: (profile as any).country || profile.geo?.country,
        currentCompany: (profile as any).company || currentExperience?.companyName,
        currentPosition: (profile as any).job_title || currentExperience?.title,
        profileUrl: (profile as any).linkedin_url ||
          (profile.publicIdentifier
          ? `https://linkedin.com/in/${profile.publicIdentifier}`
          : profileUrl),
        photoUrl: (profile as any).profile_image_url || profile.profilePicture,
        connections: (profile as any).connection_count || profile.connections,
        followerCount: (profile as any).follower_count || profile.followerCount,
        experience: ((profile as any).experiences || profile.position)?.map((exp: any) => ({
          title: exp.title || 'Unknown',
          company: exp.company || exp.companyName || 'Unknown',
          location: exp.location,
          startDate: exp.start_month && exp.start_year
            ? `${exp.start_year}-${String(exp.start_month).padStart(2, '0')}`
            : exp.start
            ? `${exp.start.year}-${String(exp.start.month || 1).padStart(2, '0')}`
            : undefined,
          endDate:
            exp.end_month && exp.end_year && !exp.is_current
              ? `${exp.end_year}-${String(exp.end_month).padStart(2, '0')}`
              : exp.end && !exp.current
              ? `${exp.end.year}-${String(exp.end.month || 1).padStart(2, '0')}`
              : undefined,
          current: exp.is_current ?? exp.current,
        })),
        education: ((profile as any).educations || profile.education)?.map((edu: any) => ({
          school: edu.school || edu.schoolName || 'Unknown',
          degree: edu.degree,
          field: edu.field_of_study || edu.fieldOfStudy,
          startYear: edu.start_year?.toString() || edu.start?.year?.toString(),
          endYear: edu.end_year?.toString() || edu.end?.year?.toString(),
        })),
        skills: Array.isArray(profile.skills)
          ? profile.skills.map((s: any) => typeof s === 'string' ? s : s.name || '').filter(Boolean)
          : undefined,
      };

      console.log(
        `✅ LinkedIn profile fetched: ${result.firstName} ${result.lastName} (${result.currentPosition || 'N/A'} at ${result.currentCompany || 'N/A'})`
      );

      return result;
    } catch (error) {
      console.error(
        '❌ LinkedIn failed:',
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * Extract LinkedIn username from URL
   */
  private extractUsername(url: string): string | null {
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/i,
      /linkedin\.com\/pub\/([^\/\?]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // If URL is just a username, return it
    if (!url.includes('/') && !url.includes('.')) {
      return url;
    }

    return null;
  }

  /**
   * Fallback mock results when API unavailable
   */
  private getMockResult(profileUrl: string): LinkedInProfileResult {
    const username = this.extractUsername(profileUrl) || 'johndoe';

    return {
      firstName: 'John',
      lastName: 'Doe',
      headline: 'Senior Software Engineer | Tech Enthusiast',
      summary:
        'Experienced software engineer with 10+ years in full-stack development. Passionate about building scalable systems.',
      location: 'Cape Town, Western Cape',
      country: 'South Africa',
      currentCompany: 'Mock Tech Corp',
      currentPosition: 'Senior Software Engineer',
      profileUrl: `https://linkedin.com/in/${username}`,
      connections: 500,
      followerCount: 1200,
      experience: [
        {
          title: 'Senior Software Engineer',
          company: 'Mock Tech Corp',
          location: 'Cape Town, South Africa',
          startDate: '2020-01',
          current: true,
        },
        {
          title: 'Software Engineer',
          company: 'Previous Company',
          location: 'Johannesburg, South Africa',
          startDate: '2015-06',
          endDate: '2019-12',
          current: false,
        },
      ],
      education: [
        {
          school: 'University of Cape Town',
          degree: 'Bachelor of Science',
          field: 'Computer Science',
          startYear: '2011',
          endYear: '2014',
        },
      ],
      skills: [
        'JavaScript',
        'TypeScript',
        'React',
        'Node.js',
        'Python',
        'AWS',
        'Docker',
        'Kubernetes',
      ],
    };
  }
}

// Singleton instance
let linkedInInstance: LinkedInProvider | null = null;

/**
 * Get or create singleton LinkedIn provider instance
 */
export function getLinkedInProvider(): LinkedInProvider {
  if (!linkedInInstance) {
    linkedInInstance = new LinkedInProvider();
  }
  return linkedInInstance;
}
