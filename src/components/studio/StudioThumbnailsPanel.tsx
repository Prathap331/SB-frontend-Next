'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Camera,
  Download,
  Image as ImageIcon,
  Loader2,
  Lock,
  Sparkles,
  User,
  UserX,
  X,
} from 'lucide-react';
import {
  ApiService,
  type GeneratedScriptData,
} from '@/services/api';
import { supabase } from '@/lib/supabaseClient';
import {
  normalizeGeneratedThumbnail,
  normalizeGeneratedThumbnailList,
  saveGeneratedThumbnailToScript,
  type GeneratedThumbnailItem,
} from '@/lib/script-persistence';
import { CREDITS_PER_THUMBNAIL } from '@/components/CreditsHowItWorks';
import {
  IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  PHOTO_SLOTS,
  THUMBNAIL_BUCKET,
  type PhotoKey,
  type ThumbnailImages,
} from '@/lib/thumbnails';

function extractThumbnailTexts(data?: GeneratedScriptData | null): string[] {
  if (!data) return [];
  const ytMeta = data.youtube_metadata ?? data.seo?.youtube_metadata;
  const legacySeo: any = data.seo?.seo ?? data.seo ?? {};
  return (
    (ytMeta?.thumbnail_text?.length ? ytMeta.thumbnail_text : null) ??
    (legacySeo?.thumbnail_brief ?? []).map((t: any) => t?.text_overlay).filter(Boolean) ??
    []
  );
}

async function userHasThumbnailPhotos(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_profiles')
    .select('thumbnail_images')
    .eq('id', userId)
    .maybeSingle();
  const imgs = (data?.thumbnail_images ?? {}) as Record<string, string>;
  return !!(imgs.photo1 || imgs.photo2);
}

type Props = {
  data?: GeneratedScriptData | null;
  ideaTitle?: string;
  ideaDescription?: string;
  topic?: string;
  scriptRowId?: string | null;
  /** True when the script is unlocked (assigned) or unlocked this session */
  isUnlocked?: boolean;
  fromAssigned?: boolean;
  initialGeneratedThumbnail?: GeneratedThumbnailItem | null;
  /** Switch user to the Full Script tab to unlock */
  onGoToScript?: () => void;
};

export function StudioThumbnailsPanel({
  data,
  ideaTitle,
  ideaDescription,
  topic = '',
  scriptRowId,
  isUnlocked: isUnlockedProp = false,
  fromAssigned = false,
  initialGeneratedThumbnail = null,
  onGoToScript,
}: Props) {
  const router = useRouter();
  const texts = extractThumbnailTexts(data);
  const titles = data?.youtube_metadata?.titles ?? data?.seo?.youtube_metadata?.titles ?? [];

  const isUnlocked = isUnlockedProp || fromAssigned;

  const [showFacePopup, setShowFacePopup] = useState(false);
  const [showPhotoPopup, setShowPhotoPopup] = useState(false);
  const [checkingPhotos, setCheckingPhotos] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [generatedList, setGeneratedList] = useState<GeneratedThumbnailItem[]>(() => {
    const fromData = normalizeGeneratedThumbnailList(data?.thumbnail_generated);
    if (fromData.length) return fromData;
    return initialGeneratedThumbnail?.public_url ? [initialGeneratedThumbnail] : [];
  });

  useEffect(() => {
    const fromData = normalizeGeneratedThumbnailList(data?.thumbnail_generated);
    if (fromData.length) setGeneratedList(fromData);
  }, [data?.thumbnail_generated]);

  const [pFiles, setPFiles] = useState<Partial<Record<PhotoKey, File>>>({});
  const [pPreviews, setPPreviews] = useState<Partial<Record<PhotoKey, string>>>({});
  const [pError, setPError] = useState<string | null>(null);
  const [pUploading, setPUploading] = useState(false);
  const inputRefs = useRef<Partial<Record<PhotoKey, HTMLInputElement | null>>>({});

  const openFacePopupForText = (text: string, index: number) => {
    if (!isUnlocked) {
      setError('Unlock the script first to generate a thumbnail.');
      return;
    }
    setError(null);
    setPendingText(text);
    setGeneratingIndex(index);
    setShowFacePopup(true);
  };

  const runGenerate = async (isFace: boolean, thumbnailText: string) => {
    if (!isUnlocked) {
      setError('Unlock the script first to generate a thumbnail.');
      setShowFacePopup(false);
      return;
    }
    if (!data?.script) {
      setError('Generate a script first before creating a thumbnail.');
      return;
    }
    const text = thumbnailText.trim();
    if (!text) {
      setError('No thumbnail text selected.');
      return;
    }

    setGenerating(true);
    setError(null);
    setShowFacePopup(false);
    setShowPhotoPopup(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }

      const result = await ApiService.generateThumbnail({
        userId: session.user.id,
        title: ideaTitle || data.title || 'Untitled',
        description: ideaDescription || '',
        isFace,
        script: data.script,
        thumbnail_text: text,
      });

      const thumbnailPayload = result.thumbnail;
      const displayItems = normalizeGeneratedThumbnailList(thumbnailPayload);
      const display =
        displayItems[0] ?? normalizeGeneratedThumbnail(thumbnailPayload);

      if (display?.error) {
        throw new Error(display.error);
      }
      if (!display?.public_url) {
        throw new Error('Thumbnail generation returned no image URL.');
      }

      const newItems = displayItems.length ? displayItems : [display];
      setGeneratedList((prev) => {
        const next = [...prev];
        for (const item of newItems) {
          if (item.public_url && !next.some((p) => p.public_url === item.public_url)) {
            next.push(item);
          }
        }
        return next;
      });

      const saved = await saveGeneratedThumbnailToScript({
        scriptRowId,
        fromAssigned: fromAssigned || isUnlocked,
        userId: session.user.id,
        title: ideaTitle || data.title || '',
        topic: topic || data.title || ideaTitle || '',
        description: ideaDescription || '',
        script: data.script,
        thumbnail: thumbnailPayload,
      });
      if (!saved.ok) {
        console.error('[thumbnail save]', saved.error);
        setError(
          saved.error ||
            'Thumbnail generated but failed to save. Please try again.',
        );
      } else if (data) {
        const existing = normalizeGeneratedThumbnailList(data.thumbnail_generated);
        const merged = [...existing];
        for (const item of newItems) {
          if (item.public_url && !merged.some((p) => p.public_url === item.public_url)) {
            merged.push(item);
          }
        }
        (data as GeneratedScriptData).thumbnail_generated = merged;
      }

      window.dispatchEvent(new Event('creditsUpdated'));
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate thumbnail.';
      const status = err?.status as number | undefined;
      const looksInsufficient =
        status === 402 ||
        /credit|insufficient|not enough/i.test(msg);
      if (looksInsufficient) {
        setShowInsufficient(true);
      } else {
        setError(msg);
      }
    } finally {
      setGenerating(false);
      setPendingText(null);
      setGeneratingIndex(null);
    }
  };

  const handleFaceChoice = async (isFace: boolean) => {
    const text = pendingText;
    if (!text) {
      setError('No thumbnail text selected.');
      setShowFacePopup(false);
      return;
    }

    if (!isFace) {
      await runGenerate(false, text);
      return;
    }

    setCheckingPhotos(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      const hasPhotos = await userHasThumbnailPhotos(session.user.id);
      if (hasPhotos) {
        await runGenerate(true, text);
      } else {
        setShowFacePopup(false);
        setShowPhotoPopup(true);
      }
    } finally {
      setCheckingPhotos(false);
    }
  };

  const onPickPhoto = (key: PhotoKey, file: File | null) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setPError('Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPError('Each photo must be under 5 MB.');
      return;
    }
    setPError(null);
    setPFiles((prev) => ({ ...prev, [key]: file }));
    setPPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  const uploadPhotosThenGenerate = async () => {
    const text = pendingText;
    if (!text) {
      setPError('No thumbnail text selected.');
      return;
    }
    const entries = PHOTO_SLOTS.filter((s) => pFiles[s.key]);
    if (!entries.length) {
      setPError('Upload at least one photo to continue.');
      return;
    }
    setPUploading(true);
    setPError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      const uid = session.user.id;
      const thumbnailImages: ThumbnailImages = { photo1: '', photo2: '' };

      for (const slot of entries) {
        const file = pFiles[slot.key]!;
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${uid}/${slot.key}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(THUMBNAIL_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path);
        thumbnailImages[slot.key] = pub.publicUrl;
      }

      const { error: dbErr } = await supabase.from('user_profiles').upsert({
        id: uid,
        thumbnail_images: thumbnailImages,
        updated_at: new Date().toISOString(),
      });
      if (dbErr) throw new Error(dbErr.message);

      await runGenerate(true, text);
    } catch (err: any) {
      setPError(err?.message || 'Failed to upload photos.');
    } finally {
      setPUploading(false);
    }
  };

  if (!data || texts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-6 py-14 text-center">
        <p className="text-base font-semibold text-[#1d1d1f] mb-1">No thumbnails yet</p>
        <p className="text-sm text-gray-500">
          Generate a script to get thumbnail text overlays for your video.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-5 py-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1f] text-white text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 mb-2">
            <Sparkles className="w-3 h-3 text-amber-300" />
            {CREDITS_PER_THUMBNAIL} credits
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-[#1d1d1f] tracking-tight">
            Generate AI thumbnail
          </h2>
          <p className="text-sm text-[#6e6e73] font-light mt-1 leading-relaxed max-w-xl">
            {isUnlocked ? (
              <>
                Turn your script&apos;s thumbnail text into a finished YouTube image. Each generation
                costs <span className="font-semibold text-[#1d1d1f]">{CREDITS_PER_THUMBNAIL} credits</span>
                {' '}— choose a text option below, then pick with your photo or a faceless style.
              </>
            ) : (
              <>
                Unlock your script on the Full Script tab first. After unlock, you can generate an AI
                thumbnail for <span className="font-semibold text-[#1d1d1f]">{CREDITS_PER_THUMBNAIL} credits</span>.
              </>
            )}
          </p>
        </div>

        {!isUnlocked && (
          <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#3d3d3a]">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-[#6e6e73]" />
            <span>
              Thumbnail generation is available only after you unlock the script. Open{' '}
              <button
                type="button"
                onClick={() => onGoToScript?.()}
                className="font-semibold text-[#1d1d1f] underline underline-offset-2"
              >
                Full Script
              </button>{' '}
              and unlock it to continue. Each generation costs{' '}
              <span className="font-semibold text-[#1d1d1f]">{CREDITS_PER_THUMBNAIL} credits</span>.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1d1d1f]">Thumbnail text options</h3>
              <p className="text-xs text-[#6e6e73] font-light mt-0.5">
                Pick a text option and generate an AI thumbnail for {CREDITS_PER_THUMBNAIL} credits.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {texts.map((text, i) => {
              const isThisGenerating = generating && generatingIndex === i;
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-[#1d1d1f] to-[#3d3d3a] relative flex items-center justify-center p-6">
                    <p className="text-white text-center font-black text-lg sm:text-xl leading-tight drop-shadow-lg uppercase tracking-tight">
                      {text}
                    </p>
                    <span className="absolute bottom-2 right-2 text-[10px] text-white/50 font-medium">
                      16:9 preview
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                        Thumbnail {i + 1}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1d1d1f] mb-3">{text}</p>
                    {titles[i] && (
                      <p className="text-xs text-gray-400 mb-3 line-clamp-2">{titles[i]}</p>
                    )}
                    {isUnlocked ? (
                      <button
                        type="button"
                        onClick={() => openFacePopupForText(text, i)}
                        disabled={generating}
                        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#1d1d1f] hover:bg-black text-white px-3 py-2 rounded-xl transition-colors disabled:opacity-60"
                      >
                        {isThisGenerating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        {isThisGenerating ? 'Generating…' : 'Generate thumbnail'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onGoToScript?.()}
                        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 bg-[#f5f5f7] hover:bg-gray-200 text-[#1d1d1f] px-3 py-2 rounded-xl transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Unlock script first
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {generatedList.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-[#1d1d1f]">Generated thumbnails</h3>
              <p className="text-xs text-[#6e6e73] font-light mt-0.5">
                Saved to your script · {generatedList.length} image
                {generatedList.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {generatedList.map((item, i) => (
                <div
                  key={`${item.public_url}-${i}`}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                      Generated {i + 1}
                    </span>
                    {item.public_url && (
                      <a
                        href={item.public_url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] border border-gray-200 px-2 py-1 rounded-md hover:bg-gray-200"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                    )}
                  </div>
                  <div className="p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.public_url || ''}
                      alt={`Generated thumbnail ${i + 1}`}
                      className="w-full rounded-xl border border-gray-100 aspect-video object-cover"
                    />
                    {item.prompt && (
                      <p className="mt-3 text-xs text-[#6e6e73] leading-relaxed">
                        {item.prompt}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Face choice */}
      {showFacePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-200/80 p-6 sm:p-8 max-w-lg w-full">
            <button
              type="button"
              onClick={() => {
                setShowFacePopup(false);
                setPendingText(null);
                setGeneratingIndex(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#1d1d1f]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight pr-8">
              How should this thumbnail look?
            </h2>
            <p className="text-sm text-[#6e6e73] font-light mt-1.5 mb-3 leading-relaxed">
              Using text:{' '}
              <span className="font-semibold text-[#1d1d1f]">
                “{pendingText}”
              </span>
            </p>
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold">Costs {CREDITS_PER_THUMBNAIL} credits</span>
                {' '}— deducted when generation starts. Faceless or with your photo uses the same rate.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={checkingPhotos || generating}
                onClick={() => void handleFaceChoice(true)}
                className="rounded-2xl border border-gray-200 hover:border-[#1d1d1f] bg-[#f5f5f7] hover:bg-white p-5 text-left transition-all disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-3">
                  {checkingPhotos ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#1d1d1f]" />
                  ) : (
                    <User className="w-5 h-5 text-[#1d1d1f]" />
                  )}
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f]">With my photo</p>
                <p className="text-xs text-[#6e6e73] font-light mt-1 leading-relaxed">
                  Use the photos saved in your profile for a face-forward thumbnail.
                </p>
              </button>
              <button
                type="button"
                disabled={checkingPhotos || generating}
                onClick={() => void handleFaceChoice(false)}
                className="rounded-2xl border border-gray-200 hover:border-[#1d1d1f] bg-[#f5f5f7] hover:bg-white p-5 text-left transition-all disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-3">
                  <UserX className="w-5 h-5 text-[#1d1d1f]" />
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f]">Faceless channel</p>
                <p className="text-xs text-[#6e6e73] font-light mt-1 leading-relaxed">
                  Cinematic scene and text only — no personal photos.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo upload if missing */}
      {showPhotoPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-200/80 p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setShowPhotoPopup(false);
                setPendingText(null);
                setGeneratingIndex(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#1d1d1f]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] border border-gray-200 flex items-center justify-center mb-4">
              <Camera className="w-6 h-6 text-[#1d1d1f]" />
            </div>
            <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight pr-8">
              Add thumbnail photos
            </h2>
            <p className="text-sm text-[#6e6e73] font-light mt-1.5 mb-5 leading-relaxed">
              Upload 1–2 clear photos of yourself so we can generate face-forward thumbnails.
              This uses {CREDITS_PER_THUMBNAIL} credits once generation starts.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {PHOTO_SLOTS.map((slot) => (
                <div key={slot.key}>
                  <input
                    ref={(el) => {
                      inputRefs.current[slot.key] = el;
                    }}
                    type="file"
                    accept={IMAGE_TYPES.join(',')}
                    className="hidden"
                    onChange={(e) => onPickPhoto(slot.key, e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => inputRefs.current[slot.key]?.click()}
                    className="w-full aspect-square rounded-2xl border border-dashed border-gray-300 bg-[#f5f5f7] hover:border-gray-400 overflow-hidden relative"
                  >
                    {pPreviews[slot.key] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pPreviews[slot.key]}
                        alt={slot.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-[#6e6e73] font-medium">{slot.label}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
            {pError && (
              <p className="text-xs text-red-600 mb-3 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {pError}
              </p>
            )}
            <button
              type="button"
              disabled={pUploading || generating}
              onClick={() => void uploadPhotosThenGenerate()}
              className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {(pUploading || generating) && <Loader2 className="w-4 h-4 animate-spin" />}
              {pUploading ? 'Uploading…' : generating ? 'Generating…' : `Save & generate (${CREDITS_PER_THUMBNAIL} credits)`}
            </button>
          </div>
        </div>
      )}

      {showInsufficient && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200/80 p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-[#1d1d1f] mb-2">Not enough credits</h2>
            <p className="text-sm text-[#6e6e73] font-light leading-relaxed mb-6">
              Thumbnail generation costs {CREDITS_PER_THUMBNAIL} credits. Upgrade your plan to keep
              creating thumbnails.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowInsufficient(false);
                  router.push('/pricing');
                }}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium"
              >
                View Plans
              </button>
              <button
                type="button"
                onClick={() => setShowInsufficient(false)}
                className="w-full py-2 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
