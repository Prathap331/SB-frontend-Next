'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Crown,
  LogOut,
  Camera,
  CreditCard,
  User,
  Lock,
  Vault,
  Video,
  FileText,
  ChevronDown,
  LogIn,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import { stripKeywordPrefix } from '@/lib/keyword-routes';
import {
  fetchRecentTopics,
  TOTAL_STAGES,
  type RecentTopicItem,
} from '@/lib/recent-topics';
import type { ProfileTabId } from '@/app/profile/page';

const AVATAR_COLORS = [
  '#16a34a', '#1e3a5f', '#1a5276', '#145a32', '#6c3483',
  '#943126', '#784212', '#0e6655', '#2e4057',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Right-panel views driven by URL */
export type StudioSideView =
  | null
  | 'content-vault'
  | 'my-scripts'
  | 'pricing'
  | ProfileTabId;

const PROFILE_TABS: ProfileTabId[] = [
  'profile', 'thumbnails', 'channel', 'subscription', 'billing', 'password',
];

/** Canonical href for each studio view (under /app for library pages) */
export function hrefForStudioView(view: Exclude<StudioSideView, null>): string {
  switch (view) {
    case 'content-vault':
      return '/app/content-vault';
    case 'my-scripts':
      return '/app/my-scripts';
    case 'pricing':
      return '/pricing';
    case 'profile':
      return '/app/profile';
    case 'scripts':
      return '/app/my-scripts';
    default:
      return `/app/profile?tab=${view}`;
  }
}

export function studioViewFromLocation(
  pathname: string,
  searchParams: URLSearchParams | { get: (k: string) => string | null },
): StudioSideView {
  const bare = stripKeywordPrefix(pathname);
  if (bare === '/content-vault' || bare.startsWith('/content-vault/')) return 'content-vault';
  if (bare === '/my-scripts' || bare.startsWith('/my-scripts/')) return 'my-scripts';
  if (bare === '/pricing' || bare.startsWith('/pricing/')) return 'pricing';
  if (bare === '/profile' || bare.startsWith('/profile/')) {
    const tab = searchParams.get('tab');
    if (tab === 'scripts') return 'my-scripts';
    if (tab && PROFILE_TABS.includes(tab as ProfileTabId)) return tab as ProfileTabId;
    return 'profile';
  }
  return null;
}

type Props = {
  activeTopic?: string;
  refreshKey?: number;
  /** Called after a nav click (e.g. close mobile drawer) */
  onNavigate?: () => void;
};

export default function StudioSidebar({
  activeTopic,
  refreshKey = 0,
  onNavigate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { searchPath, studioHomePath, landingPath } = useKeywordNavigation();
  const [recent, setRecent] = useState<RecentTopicItem[]>([]);
  const [userName, setUserName] = useState('Creator');
  const [plan, setPlan] = useState('Free plan');
  const [creditsLeft, setCreditsLeft] = useState(0);
  const [creditsTotal, setCreditsTotal] = useState(150);
  const [userId, setUserId] = useState<string | null>(null);
  const [recentExpanded, setRecentExpanded] = useState(false);

  const RECENT_PREVIEW_COUNT = 4;

  const activeView = useMemo(
    () => studioViewFromLocation(pathname, searchParams),
    [pathname, searchParams],
  );

  // Load recent topics directly from saved_ideas (scoped by auth userId)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user?.id) {
        setRecent([]);
        setUserId(null);
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      const list = await fetchRecentTopics(uid);
      if (!cancelled) setRecent(list);
    };

    void load();

    const onUpdated = () => { void load(); };
    window.addEventListener('studio-storage-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('studio-storage-updated', onUpdated);
    };
  }, [activeTopic, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    const loadCredits = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const uid = session.user.id;
      setUserId(uid);
      const meta = session.user.user_metadata ?? {};
      const metaName = meta.full_name || meta.name;
      if (metaName) setUserName(metaName);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, credits_remaining, user_tier')
        .eq('id', uid)
        .maybeSingle();

      if (cancelled) return;
      if (profile?.full_name) setUserName(profile.full_name);

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('credits, plan, payment_status, validity')
        .eq('userId', uid)
        .order('purchased_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const planName = sub?.plan || profile?.user_tier || 'Free';
      setPlan(`${planName} plan`);

      const totals: Record<string, number> = { Free: 150, Plus: 500, Pro: 1200 };
      const total = totals[planName] ?? totals[String(planName).charAt(0).toUpperCase() + String(planName).slice(1)] ?? 150;
      setCreditsTotal(total);

      if (sub?.credits != null) setCreditsLeft(sub.credits);
      else if (profile?.credits_remaining != null) setCreditsLeft(profile.credits_remaining);
    };

    void loadCredits();

    const onCreditsUpdated = () => { void loadCredits(); };
    window.addEventListener('creditsUpdated', onCreditsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('creditsUpdated', onCreditsUpdated);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate?.();
    router.push('/auth');
  };

  const go = (view: Exclude<StudioSideView, null>) => {
    onNavigate?.();
    const href = hrefForStudioView(view);
    // Library / profile already include /app; pricing still uses landing prefix
    router.push(href.startsWith('/app') ? href : landingPath(href));
  };

  const isLoggedIn = !!userId;
  const displayName = isLoggedIn ? userName : 'GO';
  const displayPlan = isLoggedIn ? plan : 'Free plan';
  const displayCreditsLeft = isLoggedIn ? creditsLeft : 0;
  const displayCreditsTotal = isLoggedIn ? creditsTotal : 150;
  const displayPct = Math.min(
    100,
    Math.round((displayCreditsLeft / Math.max(displayCreditsTotal, 1)) * 100),
  );
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  const goNewTopic = () => {
    onNavigate?.();
    router.push(studioHomePath);
  };

  return (
    <aside className="flex flex-col h-full w-[260px] flex-shrink-0 bg-[#f7f8fa] border-r border-gray-200/80">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={() => { onNavigate?.(); router.push(studioHomePath); }}
          className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
        >
          <Image
            src="/header-logo.png"
            alt="Storio"
            width={120}
            height={32}
            className="h-7 w-auto"
            style={{ width: 'auto' }}
            priority
          />
        </button>
      </div>

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'thin' }}>
        <button
          type="button"
          onClick={goNewTopic}
          className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold px-3 py-2.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New topic
        </button>

        {isLoggedIn && (
          <>
            <p className="px-2 mb-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
              Recent topics
            </p>
            <div className="space-y-0.5 mb-6">
              {recent.length === 0 && (
                <p className="px-2 py-3 text-xs text-gray-400">No topics yet — search to get started.</p>
              )}
              {(recentExpanded ? recent : recent.slice(0, RECENT_PREVIEW_COUNT)).map((rec) => {
                const active = !activeView && rec.topic.toLowerCase() === (activeTopic ?? '').toLowerCase();
                const stages = rec.stagesCompleted;
                const date = rec.createdAt
                  ? new Date(rec.createdAt).toLocaleDateString()
                  : null;
                return (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      onNavigate?.();
                      router.push(searchPath(rec.topic));
                    }}
                    className={`w-full flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                      active
                        ? 'bg-[#e8f0fe] text-[#1a73e8]'
                        : 'hover:bg-white text-[#1d1d1f]'
                    }`}
                  >
                    <Search className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${active ? 'text-[#1a73e8]' : 'text-gray-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${active ? 'text-[#1a73e8]' : 'text-[#1d1d1f]'}`}>
                        {rec.topic}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${active ? 'text-[#5b9af5]' : 'text-gray-400'}`}>
                        {date ? `${date} · ` : ''}{rec.ideasCount} ideas · {stages}/{TOTAL_STAGES} stages
                      </p>
                    </div>
                  </button>
                );
              })}
              {recent.length > RECENT_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setRecentExpanded((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-500 hover:bg-white hover:text-[#1d1d1f] transition-colors"
                  aria-expanded={recentExpanded}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${recentExpanded ? 'rotate-180' : ''}`}
                  />
                  {recentExpanded
                    ? 'Show less'
                    : `Show ${recent.length - RECENT_PREVIEW_COUNT} more`}
                </button>
              )}
            </div>
          </>
        )}

        <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-[#8b7ec8] uppercase">
          Library
        </p>
        <nav className="space-y-0.5 mb-5">
          <SidebarLink
            icon={Vault}
            label="Content Vault"
            active={activeView === 'content-vault'}
            onClick={() => go('content-vault')}
          />
          {isLoggedIn ? (
            <SidebarLink
              icon={FileText}
              label="My Scripts"
              active={activeView === 'my-scripts'}
              onClick={() => go('my-scripts')}
            />
          ) : (
            <SidebarLink
              icon={LogIn}
              label="Sign in"
              onClick={() => {
                onNavigate?.();
                try {
                  localStorage.setItem('post_auth_redirect', window.location.href);
                } catch { /* ignore */ }
                router.push(landingPath('/auth'));
              }}
            />
          )}
        </nav>

        {isLoggedIn && (
          <>
            <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-[#8b7ec8] uppercase">
              Account
            </p>
            <nav className="space-y-0.5">
              <SidebarLink
                icon={Video}
                label="Channel Memory"
                active={activeView === 'channel'}
                onClick={() => go('channel')}
              />
              <SidebarLink
                icon={Camera}
                label="Thumbnail Photos"
                active={activeView === 'thumbnails'}
                onClick={() => go('thumbnails')}
              />
              <SidebarLink
                icon={Crown}
                label="Subscription"
                active={activeView === 'subscription'}
                onClick={() => go('subscription')}
              />
              <SidebarLink
                icon={CreditCard}
                label="Billing"
                active={activeView === 'billing'}
                onClick={() => go('billing')}
              />
              <SidebarLink
                icon={Lock}
                label="Update Password"
                active={activeView === 'password'}
                onClick={() => go('password')}
              />
              <SidebarLink
                icon={User}
                label="Profile"
                active={activeView === 'profile'}
                onClick={() => go('profile')}
              />
              <SidebarLink
                icon={LogOut}
                label="Logout"
                onClick={handleLogout}
                danger
              />
            </nav>
          </>
        )}
      </div>

      <div className="border-t border-gray-200/80 bg-[#fafbfc] px-4 py-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Minutes left</span>
          <span className="text-xs text-gray-500 font-medium">
            {displayCreditsLeft} / {displayCreditsTotal}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden mb-3.5">
          <div
            className="h-full rounded-full bg-[#6366f1] transition-all"
            style={{ width: `${displayPct}%` }}
          />
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{ backgroundColor: getAvatarColor(displayName) }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#1d1d1f] truncate">{displayName}</p>
            <p className="text-[11px] text-gray-500 truncate">{displayPlan}</p>
          </div>
          <button
            type="button"
            onClick={() => go('pricing')}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors flex-shrink-0 ${
              activeView === 'pricing'
                ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                : 'border-gray-200 bg-white text-[#1d1d1f] hover:bg-gray-50'
            }`}
          >
            <Crown className={`w-3 h-3 ${activeView === 'pricing' ? 'text-amber-300' : 'text-amber-500'}`} />
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  icon: Icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : active
          ? 'bg-white text-[#1d1d1f] font-semibold shadow-sm'
          : 'text-[#1d1d1f] hover:bg-white'
      }`}
    >
      <Icon
        className={`w-3.5 h-3.5 flex-shrink-0 ${
          danger ? 'text-red-500' : active ? 'text-[#8b7ec8]' : 'text-gray-400'
        }`}
      />
      {label}
    </button>
  );
}
