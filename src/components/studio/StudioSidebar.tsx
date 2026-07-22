'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import {
  getRecentTopics,
  countCompletedStages,
  TOTAL_STAGES,
  type StudioTopicRecord,
} from '@/lib/studio-storage';
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

/** null = topic workspace; otherwise a right-panel library/account view */
export type StudioSideView =
  | null
  | 'content-vault'
  | ProfileTabId;

type Props = {
  activeTopic?: string;
  refreshKey?: number;
  activeView?: StudioSideView;
  onSelectView?: (view: StudioSideView) => void;
  onSelectTopic?: () => void;
};

export default function StudioSidebar({
  activeTopic,
  refreshKey = 0,
  activeView = null,
  onSelectView,
  onSelectTopic,
}: Props) {
  const router = useRouter();
  const { searchPath, homePath } = useKeywordNavigation();
  const [recent, setRecent] = useState<StudioTopicRecord[]>([]);
  const [userName, setUserName] = useState('Creator');
  const [plan, setPlan] = useState('Free plan');
  const [creditsLeft, setCreditsLeft] = useState(0);
  const [creditsTotal, setCreditsTotal] = useState(50);

  const reloadRecent = () => setRecent(getRecentTopics());

  useEffect(() => {
    reloadRecent();
  }, [activeTopic, refreshKey]);

  useEffect(() => {
    const onStorage = () => reloadRecent();
    window.addEventListener('storage', onStorage);
    window.addEventListener('studio-storage-updated', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('studio-storage-updated', onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const uid = session.user.id;
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

      const totals: Record<string, number> = { Free: 50, Plus: 100, Pro: 200 };
      const total = totals[planName] ?? totals[String(planName).charAt(0).toUpperCase() + String(planName).slice(1)] ?? 100;
      setCreditsTotal(total);

      if (sub?.credits != null) setCreditsLeft(sub.credits);
      else if (profile?.credits_remaining != null) setCreditsLeft(profile.credits_remaining);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const go = (view: StudioSideView) => {
    onSelectView?.(view);
  };

  const pct = Math.min(100, Math.round((creditsLeft / Math.max(creditsTotal, 1)) * 100));
  const initial = userName.trim().charAt(0).toUpperCase() || '?';

  return (
    <aside className="flex flex-col h-full w-[260px] flex-shrink-0 bg-[#f7f8fa] border-r border-gray-200/80">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={() => router.push(homePath)}
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
        <p className="text-[11px] text-gray-500 mt-1 font-medium tracking-wide">AI Creator Studio</p>
      </div>

      <div className="px-4 mb-4">
        <button
          type="button"
          onClick={() => router.push(homePath)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#1d1d1f] shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New topic
        </button>
      </div>

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'thin' }}>
        <p className="px-2 mb-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
          Recent topics
        </p>
        <div className="space-y-0.5 mb-6">
          {recent.length === 0 && (
            <p className="px-2 py-3 text-xs text-gray-400">No topics yet — search to get started.</p>
          )}
          {recent.map((rec) => {
            const active = !activeView && rec.topic.toLowerCase() === (activeTopic ?? '').toLowerCase();
            const stages = countCompletedStages(rec);
            const date = new Date(rec.updatedAt).toLocaleDateString();
            return (
              <button
                key={rec.topic}
                type="button"
                onClick={() => {
                  onSelectTopic?.();
                  go(null);
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
                    {date} · {stages}/{TOTAL_STAGES} stages
                  </p>
                </div>
              </button>
            );
          })}
        </div>

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
          <SidebarLink
            icon={Video}
            label="Channel Memory"
            active={activeView === 'channel'}
            onClick={() => go('channel')}
          />
        </nav>

        <p className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest text-[#8b7ec8] uppercase">
          Account
        </p>
        <nav className="space-y-0.5">
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
          <SidebarLink icon={LogOut} label="Logout" onClick={handleLogout} />
          <SidebarLink
            icon={User}
            label="Profile"
            active={activeView === 'profile'}
            onClick={() => go('profile')}
          />
        </nav>
      </div>

      <div className="border-t border-gray-200/80 bg-[#fafbfc] px-4 py-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Minutes left</span>
          <span className="text-xs text-gray-500 font-medium">
            {creditsLeft} / {creditsTotal}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden mb-3.5">
          <div
            className="h-full rounded-full bg-[#6366f1] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{ backgroundColor: getAvatarColor(userName) }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#1d1d1f] truncate">{userName}</p>
            <p className="text-[11px] text-gray-500 truncate">{plan}</p>
          </div>
          <button
            type="button"
            onClick={() => go('subscription')}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1d1d1f] hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Crown className="w-3 h-3 text-amber-500" />
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        active
          ? 'bg-white text-[#1d1d1f] font-semibold shadow-sm'
          : 'text-[#1d1d1f] hover:bg-white'
      }`}
    >
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-[#8b7ec8]' : 'text-gray-400'}`} />
      {label}
    </button>
  );
}
