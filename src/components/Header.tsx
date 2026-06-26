"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Crown, User, Menu, X, Clock, File } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AVATAR_COLORS = [
  '#1e3a5f', '#1a5276', '#145a32', '#6c3483',
  '#943126', '#784212', '#0e6655', '#2e4057',
  '#4a235a', '#1b4f72', '#7b241c', '#117a65',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  const bg = getAvatarColor(name);
  const dim = size === 'md' ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-sm';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {letter}
    </div>
  );
}

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [userName, setUserName] = useState('');

  const fetchCredits = async (userId: string) => {
    // 1. Try subscriptions table first
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('credits')
      .eq('userId', userId)
      .order('purchased_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      setCredits(sub.credits ?? null);
      return;
    }

    // 2. Fall back to profiles table
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('credits_remaining')
      .eq('id', userId)
      .single();

    if (profile) setCredits(profile.credits_remaining ?? null);
  };

  const fetchUserName = async (userId: string, metadata?: Record<string, any>) => {
    const metaName = metadata?.full_name || metadata?.name;
    if (metaName) { setUserName(metaName); return; }
    const { data } = await supabase.from('user_profiles').select('full_name').eq('id', userId).single();
    if (data?.full_name) setUserName(data.full_name);
  };

  useEffect(() => {

    let creditsChannel: any = null;
  
    supabase.auth.getSession().then(({ data: { session } }) => {
  
      setIsLoggedIn(!!session);
  
      if (session) {
  
        fetchCredits(session.user.id);
        fetchUserName(session.user.id, session.user.user_metadata);
  
        creditsChannel = supabase
          .channel('credits-live-update')
  
          // subscriptions table updates
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'subscriptions',
              filter: `userId=eq.${session.user.id}`,
            },
            (payload) => {
              setCredits(payload.new.credits);
            }
          )
  
          // user_profiles updates
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_profiles',
              filter: `id=eq.${session.user.id}`,
            },
            (payload) => {
              setCredits(payload.new.credits_remaining);
            }
          )
  
          .subscribe();
  
      } else {
        setCredits(null);
        setUserName('');
      }
    });
  
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
  
        setIsLoggedIn(!!session);
  
        if (session) {
          fetchCredits(session.user.id);
          fetchUserName(session.user.id, session.user.user_metadata);
        } else {
          setCredits(null);
          setUserName('');
        }
      });
  
    return () => {
  
      subscription.unsubscribe();
  
      if (creditsChannel) {
        supabase.removeChannel(creditsChannel);
      }
    };
  
  }, []);

  useEffect(() => {

    const handleCreditsUpdate = async () => {
  
      const { data: { session } } = await supabase.auth.getSession();
  
      if (session) {
        fetchCredits(session.user.id);
      }
    };
  
    window.addEventListener("creditsUpdated", handleCreditsUpdate);
  
    return () => {
      window.removeEventListener("creditsUpdated", handleCreditsUpdate);
    };
  
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-2xl border-b border-gray-200/60 shadow-sm'
          : 'bg-white/70 backdrop-blur-xl'
      }`}
    >
      <div className="max-w-8xl mx-auto px-8   h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center hover:opacity-75 transition-opacity duration-200">
          <Image
            src="/header-logo.png"
            alt="storio"
            width={140}
            height={36}
            className="h-8 w-auto"
            style={{ width: 'auto' }}
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-3">
          <Link href="/scripts">
            <button className="flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] px-4 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
              <File className='w-3.5 h-3.5 text-amber-500'/>
              Script Vault
            </button>
          </Link>
          <Link href="/pricing">
            <button className="flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] px-4 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              Upgrade
            </button>
          </Link>
          
          {!isLoggedIn ? (
            <Link href="/auth">
              <button className="text-sm font-medium text-white bg-[#1d1d1f] px-4 py-1.5 rounded-full hover:bg-black transition-all duration-200">
                Sign In
              </button>
            </Link>
          ) : (
            <Link className='flex items-center border border-gray-200 rounded-full hover:border-gray-300 transition-all duration-200' href="/profile">
              {credits !== null && (
                <div className="flex items-center gap-1.5 px-4 py-1.5">
                  <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="text-sm font-semibold">{credits}</span>
                </div>
              )}
              <UserAvatar name={userName || '?'} />
            </Link>
          )}
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/90 backdrop-blur-2xl border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-5 py-4 flex flex-col gap-2">
            <Link href="/scripts" onClick={() => setIsMenuOpen(false)}>
              <button className="w-full flex items-center gap-2 text-sm font-medium text-[#1d1d1f] px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
              <File className='w-4 h-4 text-amber-500'/>
                Script Vault
              </button>
            </Link>
            <Link href="/pricing" onClick={() => setIsMenuOpen(false)}>
              <button className="w-full flex items-center gap-2 text-sm font-medium text-[#1d1d1f] px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
                <Crown className="w-4 h-4 text-amber-500" />
                Upgrade
              </button>
            </Link>
            {isLoggedIn && credits !== null && (
              <div className="flex items-center gap-2 px-4 py-2.5">
                <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="text-sm font-semibold">{credits} credits remaining</span>
              </div>
            )}
            {!isLoggedIn ? (
              <Link href="/auth" onClick={() => setIsMenuOpen(false)}>
                <button className="w-full flex items-center gap-2 text-sm font-medium text-[#1d1d1f] px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              </Link>
            ) : (
              <Link href="/profile" onClick={() => setIsMenuOpen(false)}>
                <button className="w-full flex items-center gap-2 text-sm font-medium text-[#1d1d1f] px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
                  <UserAvatar name={userName || '?'} size="md" />
                  Profile
                </button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
