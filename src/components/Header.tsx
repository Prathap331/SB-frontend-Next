"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Crown, User, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    // React to login / logout events from anywhere in the app
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
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
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center hover:opacity-75 transition-opacity duration-200">
          <Image
            src="/Logo.png"
            alt="Storybit"
            width={140}
            height={36}
            className="h-8 w-auto"
            style={{ width: 'auto' }}
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-3">
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
            <Link href="/profile">
              <button className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200">
                <User className="w-4 h-4 text-[#1d1d1f]" />
              </button>
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
            <Link href="/pricing" onClick={() => setIsMenuOpen(false)}>
              <button className="w-full flex items-center gap-2 text-sm font-medium text-[#1d1d1f] px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
                <Crown className="w-4 h-4 text-amber-500" />
                Upgrade
              </button>
            </Link>
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
                  <User className="w-4 h-4" />
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
