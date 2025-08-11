// Shared HTTP client utility to avoid circular dependencies
const API_BASE_URL = 'https://group-event.vercel.app/api';

export class HttpClient {
  static async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Don't log 404 errors as they're often expected (e.g., device not found on first sync)
        if (response.status !== 404) {
          console.error('🚨 HTTP Response Error:', {
            status: response.status,
            statusText: response.statusText,
            url: url,
            errorData: errorData
          });
        } else {
          console.log('📍 Resource not found (404):', url);
        }
        
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
}