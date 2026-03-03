import { NextRequest, NextResponse } from 'next/server';

// Ensure this route is treated as a dynamic route
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Vercel/Next.js

const API_URL = process.env.API_URL || 'https://storybit-backend.onrender.com';

// Add GET method for health check
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Process Topic API route is active',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  let controller: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    console.log('[process-topic] ✅ Route handler called');
    console.log('[process-topic] Request URL:', request.url);
    console.log('[process-topic] Request method:', request.method);
    
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[process-topic] JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { topic } = body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    console.log('[process-topic] Processing topic:', topic);

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
      console.error('[process-topic] Request timeout after 5 minutes');
      controller?.abort();
    }, 300000); // 5 minutes

    const backendUrl = `${API_URL}/process-topic`;
    console.log('[process-topic] Calling backend:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ topic: topic.trim() }),
      signal: controller.signal,
    });

    // Clear timeout on successful fetch
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    console.log('[process-topic] Backend response status:', response.status);

    if (!response.ok) {
      let errorData: string;
      try {
        errorData = await response.text();
      } catch {
        errorData = `HTTP ${response.status}: ${response.statusText}`;
      }

      console.error('[process-topic] Backend error:', errorData);

      // Return appropriate error response
      return NextResponse.json(
        { 
          error: `Backend API error: ${errorData}`,
          status: response.status 
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    // Parse successful response
    let data;
    try {
      data = await response.json();
      console.log('[process-topic] Successfully received data');
    } catch (jsonError) {
      console.error('[process-topic] JSON parse error in response:', jsonError);
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
        console.error('[process-topic] Request aborted (timeout)');
        return NextResponse.json(
          { error: 'Request timed out after 5 minutes. The server is taking too long to respond.' },
          { status: 408 }
        );
      }

      if (error.message.includes('fetch')) {
        console.error('[process-topic] Network error:', error.message);
        return NextResponse.json(
          { error: 'Unable to connect to backend server. Please check your network connection and try again.' },
          { status: 503 }
        );
      }
    }

    console.error('[process-topic] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 }
    );
  }
}
