// API service for StoryBit AI backend integration

export interface ProcessTopicRequest {
  topic: string;
}

// ── Pipeline Metrics ──────────────────────────────────────────────────────────

export interface PlatformWeight {
  platform: string;
  percentage: string;
}

export interface PlatformSignal {
  platform: string;
  score: number;
  barW: number;
  tag: string;
  note: string;
}

export interface ConfidenceSource {
  name: string;
  detail: string;
}

export interface CsiDimension {
  name: string;
  score: number;
  effect: string;
  status: string;
}

export interface TopAngle {
  rank: number;
  title: string;
  who: string;
  what: string;
  when: string;
  frame: string;
  coverage: string;
}

export interface GapOpportunity {
  rank: number;
  score: number;
  title: string;
  angle: string;
  demand_score: number;
}

export interface PipelineMetricsResponse {
  topic: string;
  timestamp: string;
  trend_strength_score: {
    score: number;
    max: number;
    status: string;
    verdict: string;
    description: string;
    phase: string;
    composition: { base: number; psych_boost: number; reliability: number };
    why_trending: {
      primary_driver: string;
      headline: string;
      summary: string;
      platform_weights: PlatformWeight[];
    };
    platform_signals: PlatformSignal[];
    confidence: { reliability_score: number; sources: ConfidenceSource[] };
  };
  content_saturation_index: {
    score: number;
    status: string;
    verdict: string;
    description: string;
    dimensions: CsiDimension[];
    breakout: { score: number; out_of: number; label: string; signals: string[] };
    incumbent_health: {
      engagement_gap: number;
      creator_density: number;
      vpd_decay: number;
      verdict: string;
    };
  };
  content_angle_gap_score: {
    total_angles: number;
    distribution: { label: string; count: number }[];
    top_angles: TopAngle[];
    gap_opportunities: GapOpportunity[];
  };
  final_verdict: { action: string; summary: string };
}

export interface ProcessTopicResponse {
  ideas: string[];
  descriptions: string[];
}

export interface SignUpRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface SignUpResponse {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at: string;
  phone: string;
  confirmed_at: string;
  last_sign_in_at: string;
  app_metadata: {
    provider: string;
    providers: string[];
  };
  user_metadata: {
    full_name: string;
  };
  identities: {
    identity_id: string;
    id: string;
    user_id: string;
    identity_data: {
      email: string;
      email_verified: boolean;
      phone_verified: boolean;
      sub: string;
    };
    provider: string;
    last_sign_in_at: string;
    created_at: string;
    updated_at: string;
  }[];
  created_at: string;
  updated_at: string;
}

export interface GenerationParams {
  topic?: string;
  ideaTitle?: string;
  duration_minutes?: number;
  length?: number;
}

export type GeneratedScriptData = {
  script: string;
  estimated_word_count: number;
  source_urls: string[];
  analysis: {
    examples_count: number;
    research_facts_count: number;
    proverbs_count: number;
    emotional_depth: string;
  };
  title?: string;
  metrics?: {
    totalWords: number;
    videoLength: number;
    emotionalDepth: number;
    generalExamples: number;
    proverbs: number;
    historicalExamples: number;
    historicalFacts: number;
    researchFacts: number;
    lawsIncluded: number;
    keywords: string[];
  };
  structure?: Array<{
    id: string;
    title: string;
    duration: string;
    words: number;
  }>;
  synopsis?: string;
};

export class ApiService {
  // Use Next.js API routes in both development and production
  private static readonly BASE_URL = 'https://storybit-backend.onrender.com';
  
  // Check if we're in production and handle CORS issues
  private static isProduction = process.env.NODE_ENV === 'production';

  private static handleUnauthorized(): void {
    if (typeof window !== 'undefined') {
      // Clear authentication tokens from localStorage
      localStorage.removeItem('sb-xncfghdikiqknuruurfh-auth-token');
      
      // Redirect to the authentication page
      window.location.href = '/auth';
    }
  }

  private static getAuthToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    const tokenData = localStorage.getItem('sb-xncfghdikiqknuruurfh-auth-token');
    if (tokenData) {
      try {
        const parsedToken = JSON.parse(tokenData);
        return parsedToken.access_token || null;
      } catch (error) {
        console.error('Failed to parse auth token:', error);
        return null;
      }
    }
    return null;
  }

  static async processTopic(topic: string, retryCount = 0): Promise<ProcessTopicResponse> {
    const maxRetries = 2;
    const retryDelay = 5000; // 5 seconds
    
    try {
      const apiUrl = `${this.BASE_URL}/process-topic`;
      console.log('Making API request to:', apiUrl);
      console.log('Request payload:', { topic });
      
      // Create AbortController for timeout (5 minutes = 300000ms)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('[processTopic] Request timeout after 5 minutes');
        controller.abort();
      }, 300000); // 5 minutes timeout
      
      let response;
      try {
        const token = this.getAuthToken();
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ topic }),
          signal: controller.signal,
          mode: 'cors', // Explicitly set CORS mode
        });
      } catch (fetchError) {
        // Handle CORS errors specifically
        if (this.isProduction && fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          console.warn('CORS error detected in production, using fallback data');
          return this.getFallbackData(topic);
        }
        throw fetchError;
      } finally {
        // Always clear timeout
        clearTimeout(timeoutId);
      }
      console.log('API Response status:', response.status);
      console.log('API Response headers:', Object.fromEntries(response.headers.entries()));

      // Handle 502 Bad Gateway with retry
      if (response.status === 502 && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.processTopic(topic, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        console.error('Full response:', response);
        
        // Special handling for different error types
        if (response.status === 405) {
          throw new Error('Method Not Allowed (405). The API endpoint may not support POST requests or the endpoint URL is incorrect. Please check your API configuration.');
        }
        
        if (response.status === 502) {
          throw new Error('Server temporarily unavailable (502 Bad Gateway). The API server may be starting up or overloaded. Please try again in a few minutes.');
        }
        
        if (response.status === 404) {
          throw new Error('API endpoint not found (404). Please check if the API URL is correct and the endpoint exists.');
        }
        
        if (response.status === 500) {
          throw new Error('Internal server error (500). The API server encountered an error processing your request.');
        }

        if (response.status === 401) {
          this.handleUnauthorized();
          throw new Error('Unauthorized');
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      
      // Return only the fields we need, excluding the unwanted ones
      return {
        ideas: data.ideas || [],
        descriptions: data.descriptions || [],
      };
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        throw new Error('Request timeout - API took too long to respond (up to 5 minutes). Please try again or contact support if the issue persists.');
      }
      
      // Handle CORS and network errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        if (this.isProduction) {
          console.warn('CORS/Network error in production, falling back to sample data');
          // Return sample data instead of throwing error in production
          return this.getFallbackData(topic);
        }
        throw new Error('Network error: Unable to connect to the API server. This might be a CORS issue or the server is down.');
      }
      
      if (error instanceof Error && error.message.includes('CORS')) {
        if (this.isProduction) {
          console.warn('CORS error in production, falling back to sample data');
          return this.getFallbackData(topic);
        }
        throw new Error('CORS error: The API server needs to allow requests from this domain. Please check your backend CORS configuration.');
      }
      
      throw error;
    }
  }

  static async generateScript(params: GenerationParams, retryCount = 0): Promise<GeneratedScriptData> {
    const maxRetries = 2;
    const retryDelay = 5000; // 5 seconds
    
    try {
      const apiUrl = `${this.BASE_URL}/generate-script`;
      console.log('Making API request to:', apiUrl);
      console.log('Request payload:', params);
      
      // Create AbortController for timeout (5 minutes = 300000ms)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('[generateScript] Request timeout after 5 minutes');
        controller.abort();
      }, 300000); // 5 minutes timeout
      
      let response;
      try {
        const token = this.getAuthToken();
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
          signal: controller.signal,
          mode: 'cors', // Explicitly set CORS mode
        });
      } catch (fetchError) {
        // Handle CORS errors specifically
        if (this.isProduction && fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          console.warn('CORS error detected in production, returning empty script');
          return { 
            script: 'Error generating script due to network issues.', 
            estimated_word_count: 0, 
            source_urls: [], 
            analysis: {
              examples_count: 0,
              research_facts_count: 0,
              proverbs_count: 0,
              emotional_depth: 'N/A'
            } 
          };
        }
        throw fetchError;
      } finally {
        // Always clear timeout
        clearTimeout(timeoutId);
      }
      console.log('API Response status:', response.status);
      console.log('API Response headers:', Object.fromEntries(response.headers.entries()));

      // Handle 502 Bad Gateway with retry
      if (response.status === 502 && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.generateScript(params, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        console.error('Full response:', response);
        
        // Special handling for different error types
        if (response.status === 405) {
          throw new Error('Method Not Allowed (405). The API endpoint may not support POST requests or the endpoint URL is incorrect. Please check your API configuration.');
        }
        
        if (response.status === 502) {
          throw new Error('Server temporarily unavailable (502 Bad Gateway). The API server may be starting up or overloaded. Please try again in a few minutes.');
        }
        
        if (response.status === 404) {
          throw new Error('API endpoint not found (404). Please check if the API URL is correct and the endpoint exists.');
        }
        
        if (response.status === 500) {
          throw new Error('Internal server error (500). The API server encountered an error processing your request.');
        }

        if (response.status === 401) {
          this.handleUnauthorized();
          throw new Error('Unauthorized');
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        throw new Error('Request timeout - API took too long to respond (up to 5 minutes). Please try again or contact support if the issue persists.');
      }
      
      // Handle CORS and network errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        if (this.isProduction) {
          console.warn('CORS/Network error in production, returning empty script');
          return { 
            script: 'Error generating script due to network issues.', 
            estimated_word_count: 0, 
            source_urls: [], 
            analysis: {
              examples_count: 0,
              research_facts_count: 0,
              proverbs_count: 0,
              emotional_depth: 'N/A'
            } 
          };
        }
        throw new Error('Network error: Unable to connect to the API server. This might be a CORS issue or the server is down.');
      }
      
      if (error instanceof Error && error.message.includes('CORS')) {
        if (this.isProduction) {
          console.warn('CORS error in production, returning empty script');
          return { 
            script: 'Error generating script due to network issues.', 
            estimated_word_count: 0, 
            source_urls: [], 
            analysis: {
              examples_count: 0,
              research_facts_count: 0,
              proverbs_count: 0,
              emotional_depth: 'N/A'
            } 
          };
        }
        throw new Error('CORS error: The API server needs to allow requests from this domain. Please check your backend CORS configuration.');
      }
      
      throw error;
    }
  }

  static async pipelineMetrics(topic: string): Promise<PipelineMetricsResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);
    const url = `${this.BASE_URL}/pipeline-metrics`;
    console.log('[pipeline-metrics] → POST', url, { topic });
    try {
      const token = this.getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ topic }),
        signal: controller.signal,
        mode: 'cors',
      });

      console.log('[pipeline-metrics] ← status', response.status, response.statusText);

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Unauthorized');
      }
      if (!response.ok) {
        const body = await response.text().catch(() => '(no body)');
        console.error('[pipeline-metrics] error body:', body);
        throw new Error(`pipeline-metrics failed: ${response.status} ${response.statusText} — ${body}`);
      }
      const data = await response.json() as PipelineMetricsResponse;
      console.log('[pipeline-metrics] ✓ received:', data);
      return data;
    } catch (err) {
      console.error('[pipeline-metrics] caught error:', err);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Fallback data generator for when API is unavailable
  private static getFallbackData(topic: string): ProcessTopicResponse {
    const ideas = [
      `Understanding ${topic}: A Comprehensive Analysis`,
      `The Impact of ${topic} on Modern Society`,
      `Future Trends: Where ${topic} is Heading`,
      `Breaking Down ${topic}: Key Insights and Perspectives`,
      `The Science Behind ${topic}: What You Need to Know`,
      `${topic} in the Digital Age: Opportunities and Challenges`,
      `Global Perspectives on ${topic}: A Worldwide View`,
      `The Economics of ${topic}: Market Analysis and Trends`,
      `${topic} and Sustainability: Environmental Considerations`,
      `Innovation in ${topic}: Latest Developments and Breakthroughs`
    ];

    const descriptions = [
      `Dive deep into the world of ${topic} and explore its various aspects, implications, and real-world applications. This comprehensive analysis will provide you with valuable insights and perspectives that will help you understand the topic from multiple angles.`,
      `Explore how ${topic} is shaping our world today and what it means for the future. This analysis covers social implications, economic effects, and cultural changes brought about by this trending topic.`,
      `Get a glimpse into the future of ${topic} and discover what experts predict will happen next. This forward-looking analysis examines emerging trends, potential developments, and what to expect in the coming years.`,
      `Break down the complex aspects of ${topic} into digestible insights. This analysis provides key perspectives and actionable information that will help viewers understand the topic's significance and impact.`,
      `Explore the scientific foundations of ${topic} and understand the research behind current developments. This analysis combines expert knowledge with accessible explanations for a broad audience.`,
      `Examine how ${topic} is evolving in our digital world. This analysis looks at technological influences, digital transformation, and the opportunities and challenges that come with modern advancements.`,
      `Take a global perspective on ${topic} and understand how different cultures and regions approach this topic. This analysis provides a worldwide view of trends, practices, and cultural differences.`,
      `Analyze the economic aspects of ${topic} and understand market dynamics, financial implications, and business opportunities. This analysis covers market trends, investment potential, and economic impact.`,
      `Explore the environmental and sustainability aspects of ${topic}. This analysis examines ecological considerations, sustainable practices, and the environmental impact of current trends and developments.`,
      `Discover the latest innovations and breakthroughs in ${topic}. This analysis covers cutting-edge developments, technological advances, and emerging solutions that are shaping the future of this field.`
    ];

    return {
      ideas,
      descriptions
    };
  }

  static async signUp(request: SignUpRequest): Promise<SignUpResponse> {
    const url = `https://xncfghdikiqknuruurfh.supabase.co/auth/v1/signup`;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuY2ZnaGRpa2lxa251cnV1cmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTcwNTUsImV4cCI6MjA3NTg3MzA1NX0.9emUGvDrV8e8jYy6TMnPMiV7Hiw5qaCyeT6Vdc1yCAM" ;

    if (!anonKey) {
      throw new Error('Supabase anon key is not defined.');
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify({
          email: request.email,
          password: request.password,
          data: {
            full_name: request.full_name,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Sign-up failed.');
      }

      return await response.json();
    } catch (error) {
      console.error('Sign-up error:', error);
      throw error;
    }
  }
}
