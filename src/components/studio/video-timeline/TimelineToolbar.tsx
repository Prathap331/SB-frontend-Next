'use client';

import { Copy, Scissors, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { formatTimecode } from '@/lib/video-editor/timecode';

type Props = {
  currentTime: number;
  duration: number;
  pixelsPerSecond: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function TimelineToolbar({
  currentTime,
  duration,
  pixelsPerSecond,
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onSplit,
  onDuplicate,
  onDelete,
  onZoomIn,
  onZoomOut,
}: Props) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6e73]">Timeline</span>
      <span className="text-[11px] tabular-nums text-[#a1a1a6]">
        {formatTimecode(currentTime)} / {formatTimecode(duration)}
      </span>

      <div className="ml-2 flex items-center gap-1">
        <ToolBtn label="Undo" disabled={!canUndo} onClick={onUndo}>
          Undo
        </ToolBtn>
        <ToolBtn label="Redo" disabled={!canRedo} onClick={onRedo}>
          Redo
        </ToolBtn>
      </div>

      <div className="mx-1 h-4 w-px bg-gray-200" />

      <ToolBtn label="Split (S)" disabled={!hasSelection} onClick={onSplit} icon>
        <Scissors className="h-3.5 w-3.5" />
        Split
      </ToolBtn>
      <ToolBtn label="Duplicate" disabled={!hasSelection} onClick={onDuplicate} icon>
        <Copy className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn label="Delete" disabled={!hasSelection} onClick={onDelete} icon>
        <Trash2 className="h-3.5 w-3.5" />
      </ToolBtn>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onZoomOut}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-[#6e6e73] hover:text-[#1d1d1f]"
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[52px] text-center text-[11px] tabular-nums text-[#6e6e73]">
          {pixelsPerSecond}px/s
        </span>
        <button
          type="button"
          onClick={onZoomIn}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-[#6e6e73] hover:text-[#1d1d1f]"
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  disabled,
  label,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-35 ${
        icon ? '' : ''
      }`}
    >
      {children}
    </button>
  );
}
