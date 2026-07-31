import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend';
import { normalizeScriptData } from '@/lib/script-data';
import { wrapEnglishScript } from '@/lib/script-data';
import { buildScriptTableRow, THUMBNAIL_GENERATED_COLUMN } from '@/lib/script-persistence';

export const dynamic = 'force-dynamic';

type UnlockBody = {
  userId?: string;
  duration?: number;
  universalScriptId?: string | null;
  title?: string;
  topic?: string;
  description?: string;
};

function supabaseHeaders(authHeader: string) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return {
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    apikey: anonKey,
    Authorization: authHeader,
  };
}

export async function POST(request: NextRequest) {
  try {
    let body: UnlockBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = body.userId?.trim();
    const universalScriptId = body.universalScriptId ? String(body.universalScriptId) : '';
    if (!userId || !universalScriptId) {
      return NextResponse.json(
        { error: 'userId and universalScriptId are required' },
        { status: 400 },
      );
    }

    const duration = Number(body.duration);
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 10;

    // 1) Debit credits via backend
    const unlockRes = await fetch(`${getBackendUrl()}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ userId, duration: safeDuration }),
    });

    const unlockJson = await unlockRes.json().catch(() => ({}));
    if (!unlockRes.ok || unlockJson?.message !== 'success') {
      return NextResponse.json(
        unlockJson?.message ? unlockJson : { error: 'Unlock failed', detail: unlockJson },
        { status: unlockRes.status || 402 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const headers = supabaseHeaders(authHeader);

    // 2) Load full script server-side (not visible in the browser Network tab for generate)
    const getRes = await fetch(
      `${supabaseUrl}/rest/v1/scripts_universal?id=eq.${encodeURIComponent(universalScriptId)}&userId=eq.${encodeURIComponent(userId)}&select=*`,
      { headers: { ...headers, Prefer: 'return=representation' } },
    );
    if (!getRes.ok) {
      return NextResponse.json({ error: 'Failed to load locked script' }, { status: 502 });
    }
    const rows = await getRes.json().catch(() => []);
    const uni = Array.isArray(rows) ? rows[0] : null;
    if (!uni) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    const normalized = normalizeScriptData(uni);
    const englishMap = wrapEnglishScript(normalized.script || '');
    const dataForSave = { ...normalized, scriptsByLanguage: englishMap };

    const row = buildScriptTableRow(dataForSave, {
      userId,
      title: body.title || uni.title || normalized.title,
      topic: body.topic || uni.topic || body.title,
      description: body.description || uni.description,
      asLanguageMap: true,
      scriptsByLanguage: englishMap,
    });

    const thumbGen = uni[THUMBNAIL_GENERATED_COLUMN] ?? uni.thumbnail_generated ?? null;
    const insertPayload = thumbGen
      ? { ...row, [THUMBNAIL_GENERATED_COLUMN]: thumbGen }
      : row;

    // 3) Move to assigned
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/scripts_assigned`, {
      method: 'POST',
      headers,
      body: JSON.stringify(insertPayload),
    });
    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => '');
      return NextResponse.json(
        { error: 'Failed to save unlocked script', detail: errText },
        { status: 502 },
      );
    }
    const inserted = await insertRes.json().catch(() => null);
    const assigned = Array.isArray(inserted) ? inserted[0] : inserted;
    const assignedId = assigned?.id != null ? String(assigned.id) : null;

    // 4) Delete universal copy
    await fetch(
      `${supabaseUrl}/rest/v1/scripts_universal?id=eq.${encodeURIComponent(universalScriptId)}&userId=eq.${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers },
    ).catch(() => null);

    // Full script is only returned after a successful paid unlock
    return NextResponse.json(
      {
        message: 'success',
        remaining_credits: unlockJson.remaining_credits,
        assignedId,
        script: normalized,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Unexpected unlock error' }, { status: 500 });
  }
}
