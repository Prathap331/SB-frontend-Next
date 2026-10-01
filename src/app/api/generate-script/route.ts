import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend';
import {
  isGeneratedScriptEmpty,
  normalizeScriptData,
  SCRIPT_NULL_RETRY_ERROR,
} from '@/lib/script-data';
import {
  buildScriptTableRow,
  DUPLICATE_DURATION_LANGUAGE_MESSAGE,
  findDuplicateGeneratedScript,
} from '@/lib/script-persistence';
import { DEFAULT_SCRIPT_LANGUAGE, scriptLanguageKey } from '@/lib/script-languages';
import { redactGeneratedScriptForClient } from '@/lib/script-security';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const API_URL = `${getBackendUrl()}/generate-script`;

async function persistUniversal(
  data: ReturnType<typeof normalizeScriptData>,
  body: {
    userId?: string;
    title?: string;
    description?: string;
    topic?: string;
    time?: unknown;
    language?: string;
  },
  authHeader: string | null,
): Promise<string | null> {
  const userId = body.userId?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!userId || !supabaseUrl || !anonKey || !authHeader) return null;
  if (!String(data.script ?? '').trim()) return null;

  const requestedMinutes = Number(body.time);
  const existingLength = Number(data.metrics?.videoLength);
  const metrics = {
    ...(data.metrics && typeof data.metrics === 'object' ? data.metrics : {}),
    videoLength:
      existingLength > 0
        ? existingLength
        : Number.isFinite(requestedMinutes) && requestedMinutes > 0
          ? requestedMinutes
          : existingLength,
    language: scriptLanguageKey(body.language || DEFAULT_SCRIPT_LANGUAGE),
  };

  const row = buildScriptTableRow(
    { ...data, metrics },
    {
      userId,
      title: body.title || data.title,
      topic: body.topic || body.title || data.title,
      description: body.description,
    },
  );

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/scripts_universal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        apikey: anonKey,
        Authorization: authHeader,
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) return null;
    const inserted = await res.json().catch(() => null);
    const row0 = Array.isArray(inserted) ? inserted[0] : inserted;
    return row0?.id != null ? String(row0.id) : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let controller: AbortController | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const title = typeof body.title === 'string' ? body.title : '';
    const durationMinutes = Number(body.time);
    const language =
      typeof body.language === 'string' && body.language.trim()
        ? body.language
        : DEFAULT_SCRIPT_LANGUAGE;
    if (userId && title && Number.isFinite(durationMinutes) && durationMinutes > 0) {
      const duplicate = await findDuplicateGeneratedScript({
        userId,
        title,
        durationMinutes,
        language,
        authHeader,
      });
      if (duplicate) {
        return NextResponse.json(
          { error: DUPLICATE_DURATION_LANGUAGE_MESSAGE },
          { status: 409 },
        );
      }
    }

    controller = new AbortController();
    timeoutId = setTimeout(() => {
      controller?.abort();
    }, 300000);

    const forwardBody = {
      userId: body?.userId,
      title: body?.title,
      description: body?.description,
      topic: body?.topic,
      time: body?.time,
      language: body?.language || 'English',
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(forwardBody),
      signal: controller.signal,
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch {
        errorText = `HTTP ${response.status}`;
      }

      let errorMessage = 'Failed to Generate Content due to an external API error.';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.error || errorMessage;
      } catch {
        if (errorText.length < 500) errorMessage = errorText;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON response from backend' },
        { status: 502 },
      );
    }

    // Full script stays on the server (persisted) — never forwarded to the browser
    const normalized = normalizeScriptData(data);
    if (isGeneratedScriptEmpty(data) || !String(normalized.script ?? '').trim()) {
      return NextResponse.json({ error: SCRIPT_NULL_RETRY_ERROR }, { status: 422 });
    }
    const scriptRowId = await persistUniversal(
      normalized,
      {
        userId: typeof body.userId === 'string' ? body.userId : undefined,
        title: typeof body.title === 'string' ? body.title : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        topic: typeof body.topic === 'string' ? body.topic : undefined,
        time: body.time,
        language: typeof body.language === 'string' ? body.language : undefined,
      },
      authHeader,
    );

    const redacted = redactGeneratedScriptForClient(normalized, { scriptRowId });

    return NextResponse.json(redacted, {
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
          { error: 'Request timed out after 5 minutes. The server is taking too long to respond.' },
          { status: 408 },
        );
      }
      if (error.message.includes('fetch')) {
        return NextResponse.json(
          { error: 'Unable to connect to backend server. Please check your network connection and try again.' },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request.' },
      { status: 500 },
    );
  }
}
