import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const API_URL = getBackendUrl();

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Process Topic API route is active',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  let controller: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    const { topic, userId } = body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    const authHeader = request.headers.get('Authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;

    controller = new AbortController();
    timeoutId = setTimeout(() => {
      controller?.abort();
    }, 300000);

    const backendUrl = `${API_URL}/generate-ideas`;
    const backendPayload: { topic: string; userId?: string } = {
      topic: topic.trim(),
    };
    if (typeof userId === 'string' && userId.trim()) {
      backendPayload.userId = userId.trim();
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(backendPayload),
      signal: controller.signal,
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (!response.ok) {
      let errorData: string;
      try {
        errorData = await response.text();
      } catch {
        errorData = `HTTP ${response.status}: ${response.statusText}`;
      }

      return NextResponse.json(
        {
          error: `Backend API error: ${errorData}`,
          status: response.status,
        },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON response from backend' },
        { status: 502 },
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        return NextResponse.json(
          { error: 'Request timed out after 5 minutes.' },
          { status: 408 },
        );
      }
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 },
    );
  }
}
