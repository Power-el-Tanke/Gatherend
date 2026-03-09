/**
 * Centralized fetch with retry logic
 *
 * Handles two common race conditions in development:
 * 1. Turbopack (404): API routes not compiled yet when client fetches
 * 2. Auth (401): session cookie/token not synchronized when client fetches
 *
 * In production, retries are more conservative.
 */

const IS_DEV = process.env.NODE_ENV === "development";

// More aggressive retries in dev due to Turbopack compilation delays
const DEFAULT_MAX_RETRIES = IS_DEV ? 5 : 3;
const DEFAULT_INITIAL_DELAY_MS = IS_DEV ? 300 : 500;

export interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in ms (doubles with each retry - exponential backoff) */
  initialDelay?: number;
  /** Function to refresh auth token before retry */
  onRetry?: () => Promise<void>;
  /** Whether to retry on 404 (Turbopack not ready) - default true in dev */
  retryOn404?: boolean;
  /** Whether to retry on 401 (token sync issue) - default true */
  retryOn401?: boolean;
  /** Custom logger function */
  logger?: (message: string) => void;
}

export interface FetchWithRetryResult {
  response: Response;
  attempts: number;
}

/**
 * Fetch with automatic retry for transient errors
 *
 * @param url - URL to fetch
 * @param options - Fetch options plus retry configuration
 * @returns Response from successful fetch
 * @throws Error if all retries fail
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelay = DEFAULT_INITIAL_DELAY_MS,
    onRetry,
    retryOn404 = IS_DEV, // Only retry 404 in dev (Turbopack issue)
    retryOn401 = true,
    logger = () => {},
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait before retry (except first attempt)
      if (attempt > 1) {
        const delay = initialDelay * Math.pow(2, attempt - 2); // Exponential backoff
        logger(
          `[fetchWithRetry] Waiting ${delay}ms before attempt ${attempt}/${maxRetries} for ${url}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Call onRetry hook (e.g., to refresh token)
        if (onRetry) {
          try {
            await onRetry();
          } catch (e) {
            // Continue even if onRetry fails
            logger(`[fetchWithRetry] onRetry failed: ${e}`);
          }
        }
      }

      const response = await fetch(url, {
        ...fetchOptions,
        credentials: fetchOptions.credentials ?? "include",
      });

      // Handle 404 - Turbopack not ready
      if (response.status === 404 && retryOn404 && attempt < maxRetries) {
        logger(
          `[fetchWithRetry] ${url} returned 404 (Turbopack not ready), attempt ${attempt}/${maxRetries}`
        );
        lastResponse = response;
        lastError = new Error(`404 Not Found: ${url}`);
        continue;
      }

      // Handle 401 - Token sync issue
      if (response.status === 401 && retryOn401 && attempt < maxRetries) {
        logger(
          `[fetchWithRetry] ${url} returned 401 (token sync), attempt ${attempt}/${maxRetries}`
        );
        lastResponse = response;
        lastError = new Error(`401 Unauthorized: ${url}`);
        continue;
      }

      // Success or non-retryable error
      return response;
    } catch (error) {
      // Network error - retry
      lastError = error instanceof Error ? error : new Error(String(error));
      logger(
        `[fetchWithRetry] Network error for ${url}, attempt ${attempt}/${maxRetries}: ${lastError.message}`
      );

      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  // If we have a response (even if error status), return it
  // This lets the caller handle the error status appropriately
  if (lastResponse) {
    return lastResponse;
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

/**
 * Create a fetch function with pre-configured retry options
 * Useful for creating specialized fetch functions
 */
export function createFetchWithRetry(defaultOptions: FetchWithRetryOptions) {
  return (url: string, options: FetchWithRetryOptions = {}) =>
    fetchWithRetry(url, { ...defaultOptions, ...options });
}
