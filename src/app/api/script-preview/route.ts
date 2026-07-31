import { NextRequest, NextResponse } from 'next/server';
import { getScriptTextFromMap, parseScriptLanguageMap } from '@/lib/script-data';
import {
  MAX_SCRIPT_PREVIEW_CHARS,
  scriptPreviewText,
} from '@/lib/script-security';

export const dynamic = 'force-dynamic';

function extractPlainScript(rawScript: unknown): string {
  if (typeof rawScript === 'string') return rawScript;
  if (rawScript && typeof rawScript === 'object') {
    return getScriptTextFromMap(parseScriptLanguageMap(rawScript));
  }
  return '';
}

/**
 * Returns a tiny script teaser for a locked (universal) row.
 * Full script is read server-side only — response is hard-capped.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const id = body?.id != null ? String(body.id).trim() : '';
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!id || !userId) {
      return NextResponse.json({ error: 'id and userId are required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/scripts_universal?id=eq.${encodeURIComponent(id)}&userId=eq.${encodeURIComponent(userId)}&select=script,structure`,
      {
        headers: {
          apikey: anonKey,
          Authorization: authHeader,
          Accept: 'application/json',
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to load preview' }, { status: 502 });
    }

    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    const fullText = extractPlainScript(row.script);
    const structure = Array.isArray(row.structure) ? row.structure : null;
    let preview = scriptPreviewText(fullText, structure);

    // Hard clamp: real script head only (before filler markers)
    const realHead = preview.split('\n\n…')[0] || '';
    if (realHead.length > MAX_SCRIPT_PREVIEW_CHARS) {
      preview = scriptPreviewText(fullText.slice(0, MAX_SCRIPT_PREVIEW_CHARS), structure);
    }
    // Never return a body that is most of the original script
    if (fullText && realHead.length >= Math.max(200, fullText.length * 0.5)) {
      preview = scriptPreviewText(fullText.slice(0, 160), structure);
    }

    return NextResponse.json(
      { script: preview },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    );
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
