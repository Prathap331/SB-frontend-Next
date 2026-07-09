'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const DEFAULT_STEPS = [
  'Understanding your topic',
  'Web searching for factual information',
  'Analysing the data',
  'Generating Content Ideas for YouTube',
  'Finishing',
];

const STEP_DURATION_MS = 3500;
const FINISH_HOLD_MS = 700;

interface GenerationProgressOverlayProps {
  isOpen: boolean;
  ready?: boolean;
  onFinished?: () => void;
  steps?: string[];
  subtext?: string;
}

export default function GenerationProgressOverlay({
  isOpen,
  ready = false,
  onFinished,
  steps = DEFAULT_STEPS,
  subtext = "Usually under 5 minutes. We'll keep working in the background.",
}: GenerationProgressOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const finishedRef = useRef(false);
  const lastStepIndex = steps.length - 1;

  useEffect(() => {
    if (isOpen) {
      finishedRef.current = false;
      setVisible(true);
      setCurrentStep(0);
      return;
    }

    if (!ready) {
      setVisible(false);
      setCurrentStep(0);
    }
  }, [isOpen, ready]);

  // Advance through steps until the final one
  useEffect(() => {
    if (!visible || currentStep >= lastStepIndex) return;

    const timer = window.setTimeout(() => {
      setCurrentStep((step) => Math.min(step + 1, lastStepIndex));
    }, STEP_DURATION_MS);

    return () => clearTimeout(timer);
  }, [visible, currentStep, lastStepIndex]);

  // On final step, wait for backend then close
  useEffect(() => {
    if (!visible || !ready || currentStep < lastStepIndex || finishedRef.current) return;

    finishedRef.current = true;
    const timer = window.setTimeout(() => {
      onFinished?.();
      setVisible(false);
      setCurrentStep(0);
    }, FINISH_HOLD_MS);

    return () => clearTimeout(timer);
  }, [visible, ready, currentStep, lastStepIndex, onFinished]);

  useEffect(() => {
    if (!visible) return;

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [visible]);

  if (!visible) return null;

  const activeLabel = steps[currentStep] ?? steps[lastStepIndex];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#1d1d1f]/25 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-3xl border border-gray-200/80 bg-white px-8 py-9 text-center shadow-xl shadow-black/10"
        role="status"
        aria-live="polite"
        aria-busy={!ready}
      >
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f5f7] border border-gray-200">
          <Loader2 className="h-6 w-6 animate-spin text-[#1d1d1f]" />
        </div>

        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-5">
          Step {currentStep + 1} of {steps.length}
        </p>

        <div className="min-h-[3.5rem] flex items-center justify-center mb-6 px-2">
          <p
            key={currentStep}
            className="generation-step-shimmer text-lg sm:text-xl font-semibold tracking-tight leading-snug"
          >
            {activeLabel}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {steps.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index < currentStep
                  ? 'w-2 bg-[#1d1d1f]'
                  : index === currentStep
                  ? 'w-6 bg-[#1d1d1f]'
                  : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <p className="text-sm leading-relaxed text-[#6e6e73]">{subtext}</p>
      </div>
    </div>
  );
}
