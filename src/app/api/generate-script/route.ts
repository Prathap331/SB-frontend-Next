import { NextRequest, NextResponse } from 'next/server';

// Ensure this route is treated as a dynamic route
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const API_URL = 'https://storybit-backend.onrender.com/generate-script';

export async function POST(request: NextRequest) {
  let controller: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    console.log('[generate-script] Received request');
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[generate-script] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Create AbortController for timeout (5 minutes = 300000ms)
    controller = new AbortController();
    timeoutId = setTimeout(() => {
      console.error('[generate-script] Request timeout after 5 minutes');
      controller?.abort();
    }, 300000); // 5 minutes

    console.log('[generate-script] Calling backend:', API_URL);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // Clear timeout on successful fetch
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    console.log('[generate-script] Backend response status:', response.status);

    if (!response.ok) {
      let errorText: string;
      try {
        errorText = await response.text();
      } catch {
        errorText = `HTTP ${response.status}: ${response.statusText}`;
      }

      console.error('[generate-script] Backend error:', errorText);
      
      let errorMessage = 'Failed to generate script due to an external API error.';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.error || errorMessage;
      } catch {
        if (errorText.length < 500) {
          errorMessage = errorText;
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    // Parse successful response
    let data;
    try {
      data = await response.json();
      console.log('[generate-script] Successfully received data');
    } catch (jsonError) {
      console.error('[generate-script] JSON parse error in response:', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON response from backend' },
        { status: 502 }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    // Clear timeout if still active
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        console.error('[generate-script] Request aborted (timeout)');
        return NextResponse.json(
          { error: 'Request timed out after 5 minutes. The server is taking too long to respond.' },
          { status: 408 }
        );
      }

      if (error.message.includes('fetch')) {
        console.error('[generate-script] Network error:', error.message);
        return NextResponse.json(
          { error: 'Unable to connect to backend server. Please check your network connection and try again.' },
          { status: 503 }
        );
      }
    }

    console.error('[generate-script] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
