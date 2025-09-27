/**
 * FizzlyCode Authentication Service
 * Handles device code authentication flow and API key management
 */

declare global {
  interface Window {
    api?: {
      openExternal: (url: string) => Promise<void>;
      [key: string]: any;
    };
  }
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_key?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

interface AuthConfig {
  baseUrl?: string; // Default: https://fizzlycode.com, for local: http://localhost:3000
  clientId?: string; // Default: cc-switch
}

class FizzlyCodeAuthService {
  private static instance: FizzlyCodeAuthService | null = null;
  private config: AuthConfig;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(config: AuthConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'https://fizzlycode.com',
      clientId: config.clientId || 'cc-switch'
    };
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(config?: AuthConfig): FizzlyCodeAuthService {
    if (!FizzlyCodeAuthService.instance) {
      FizzlyCodeAuthService.instance = new FizzlyCodeAuthService(config || {});
    }
    return FizzlyCodeAuthService.instance;
  }

  /**
   * Update the base URL for the instance
   */
  updateConfig(config: Partial<AuthConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Get the stored authentication token
   */
  getStoredToken(): string | null {
    return localStorage.getItem('fizzlycode_token');
  }

  /**
   * Store the authentication token
   */
  storeToken(token: string): void {
    localStorage.setItem('fizzlycode_token', token);
  }

  /**
   * Clear stored authentication
   */
  clearAuth(): void {
    localStorage.removeItem('fizzlycode_token');
    localStorage.removeItem('fizzlycode_user');
    localStorage.removeItem('fizzlycode_api_key');
  }

  /**
   * Get stored user information
   */
  getStoredUser(): any {
    const userStr = localStorage.getItem('fizzlycode_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Get stored API key
   */
  getStoredApiKey(): string | null {
    return localStorage.getItem('fizzlycode_api_key');
  }

  /**
   * Request a device code for authentication
   */
  async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/v2/device/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        scope: 'full'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to request device code');
    }

    return await response.json();
  }

  /**
   * Poll for token after user authorization
   */
  async pollForToken(
    deviceCode: string,
    onSuccess: (response: TokenResponse) => void,
    onError: (error: string) => void,
    onPending?: () => void
  ): Promise<void> {
    // Clear any existing polling
    this.stopPolling();

    const poll = async () => {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/v2/device/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_code: deviceCode,
            client_id: this.config.clientId
          })
        });

        const data = await response.json();

        if (response.ok) {
          // Success - user authorized
          this.stopPolling();

          // Store authentication data
          if (data.access_token) {
            this.storeToken(data.access_token);
          }
          if (data.user) {
            localStorage.setItem('fizzlycode_user', JSON.stringify(data.user));
          }
          if (data.api_key) {
            localStorage.setItem('fizzlycode_api_key', data.api_key);
          }

          onSuccess(data);
        } else if (data.error === 'authorization_pending') {
          // Still waiting for user authorization
          if (onPending) {
            onPending();
          }
        } else if (data.error === 'expired_token') {
          // Device code expired
          this.stopPolling();
          onError('Device code expired. Please try again.');
        } else if (data.error === 'access_denied') {
          // User denied access
          this.stopPolling();
          onError('Authorization was denied.');
        } else {
          // Other error
          this.stopPolling();
          onError(data.error_description || 'Authentication failed');
        }
      } catch (error: any) {
        // Network or other error
        console.error('Polling error:', error);
        // Continue polling on network errors
      }
    };

    // Start polling every 5 seconds
    this.pollingInterval = setInterval(poll, 5000);

    // Do first poll immediately
    poll();
  }

  /**
   * Stop polling for token
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Open the verification URL in browser
   */
  async openVerificationUrl(url: string): Promise<void> {
    // Check if we're in Tauri environment using window.api
    if (window.api && window.api.openExternal) {
      try {
        await window.api.openExternal(url);
      } catch (error) {
        console.error('Failed to open URL with Tauri:', error);
        // Fallback to window.open
        window.open(url, '_blank');
      }
    } else {
      // For development/browser, use window.open
      window.open(url, '_blank');
    }
  }

  /**
   * Complete authentication flow
   */
  async authenticate(
    onSuccess: (apiKey: string) => void,
    onError: (error: string) => void,
    onCodeReceived?: (code: string, url: string) => void
  ): Promise<void> {
    try {
      // Request device code
      const deviceCodeResponse = await this.requestDeviceCode();

      // Notify UI about the code
      if (onCodeReceived) {
        onCodeReceived(
          deviceCodeResponse.user_code,
          deviceCodeResponse.verification_uri_complete
        );
      }

      // Open browser to verification URL
      await this.openVerificationUrl(deviceCodeResponse.verification_uri_complete);

      // Start polling for token
      await this.pollForToken(
        deviceCodeResponse.device_code,
        (response) => {
          if (response.api_key) {
            onSuccess(response.api_key);
          } else {
            onError('No API key received');
          }
        },
        onError
      );
    } catch (error: any) {
      onError(error.message || 'Authentication failed');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  /**
   * Verify stored token is still valid
   */
  async verifyToken(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v2/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

export default FizzlyCodeAuthService;
export { FizzlyCodeAuthService };