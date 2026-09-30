'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { TimelineClip } from '@/lib/video-editor/types';
import { overlayDisplayTextForEditor } from '@/lib/video-editor/infographics';
import {
  colorToInputValue,
  emptyListItem,
  fieldLabel,
  formatArrayField,
  getByPath,
  getStorybitEditorSpec,
  groupStorybitFields,
  isPlaceholderDefault,
  isMultilineField,
  listBounds,
  LUCIDE_ICON_OPTIONS,
  parseArrayField,
  setByPath,
  type StorybitEditorField,
} from '@/lib/video-editor/storybitEditorFields';
import { isStorybitAnimationType } from '@/remotion/animationTypes';
import { LucideIconView } from '@/remotion/icons';

const FIELD_CLASS =
  'w-full rounded-xl border border-gray-200 bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#1d1d1f] focus:ring-2 focus:ring-[#1d1d1f]/10';

const INFOGRAPHIC_PLACEMENTS: { id: string; label: string }[] = [
  { id: 'top_left', label: 'Top left' },
  { id: 'top', label: 'Top' },
  { id: 'top_right', label: 'Top right' },
  { id: 'center_left', label: 'Middle left' },
  { id: 'center', label: 'Center' },
  { id: 'center_right', label: 'Middle right' },
  { id: 'bottom_left', label: 'Bottom left' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'bottom_right', label: 'Bottom right' },
  { id: 'full_frame', label: 'Full frame' },
];

function FieldCaption({ field }: { field: StorybitEditorField }) {
  const extra = [field.required ? 'Required' : null, field.limits, field.hint].filter(Boolean).join(' · ');
  if (!extra) return null;
  return <p className="mt-1 text-[10px] leading-relaxed text-[#a1a1a6]">{extra}</p>;
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [query, setQuery] = useState(value);
  useEffect(() => {
    setQuery(value);
  }, [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LUCIDE_ICON_OPTIONS.slice(0, 18);
    return LUCIDE_ICON_OPTIONS.filter((name) => name.includes(q)).slice(0, 18);
  }, [query]);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
          <LucideIconView name={value || query || 'circle'} size={16} color="#1d1d1f" />
        </span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Lucide icon name"
          className={FIELD_CLASS}
        />
      </div>
      <div className="grid grid-cols-6 gap-1">
        {filtered.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => {
              setQuery(name);
              onChange(name);
            }}
            className={`flex h-8 items-center justify-center rounded-md border ${
              name === value ? 'border-[#1d1d1f] bg-white' : 'border-transparent bg-[#f5f5f7] hover:border-gray-200'
            }`}
          >
            <LucideIconView name={name} size={15} color="#1d1d1f" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorSwatchButton({
  value,
  onPick,
}: {
  value: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
    >
      <span
        className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
        style={{ background: colorToInputValue(value) }}
      />
      {value || 'Pick colour'}
    </button>
  );
}

function ScalarField({
  field,
  value,
  onChange,
  onPickColor,
}: {
  field: StorybitEditorField;
  value: unknown;
  onChange: (next: unknown) => void;
  onPickColor: (path: string) => void;
}) {
  const label = fieldLabel(field);
  if (field.type === 'choice' && field.values?.length) {
    const current = typeof value === 'string' ? value : '';
    const fallback = !isPlaceholderDefault(field.default) && typeof field.default === 'string' ? field.default : '';
    return (
      <label className="mb-3 block">
        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
        <select
          value={current || fallback || field.values[0]}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
        >
          {!field.required && <option value="">Default</option>}
          {field.values.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <FieldCaption field={field} />
      </label>
    );
  }

  if (field.type === 'color') {
    const hex = typeof value === 'string' && !isPlaceholderDefault(value) ? value : '';
    return (
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
        <ColorSwatchButton value={hex} onPick={() => onPickColor(field.path)} />
        <FieldCaption field={field} />
      </div>
    );
  }

  if (field.type === 'icon') {
    return (
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
        <IconPicker value={typeof value === 'string' ? value : ''} onChange={onChange} />
        <FieldCaption field={field} />
      </div>
    );
  }

  if (field.type === 'number') {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value !== '' ? Number(value) : '';
    return (
      <label className="mb-3 block">
        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
        <input
          type="number"
          value={Number.isFinite(n) ? n : ''}
          onChange={(e) => {
            const next = e.target.value;
            if (next === '') {
              onChange('');
              return;
            }
            const parsed = Number(next);
            onChange(Number.isFinite(parsed) ? parsed : next);
          }}
          className={FIELD_CLASS}
        />
        <FieldCaption field={field} />
      </label>
    );
  }

  if (field.type === 'array') {
    return (
      <label className="mb-3 block">
        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
        <textarea
          rows={2}
          value={formatArrayField(value)}
          onChange={(e) => onChange(parseArrayField(e.target.value, /number|value/i.test(field.fills ?? '')))}
          className={`${FIELD_CLASS} resize-none`}
        />
        <FieldCaption field={field} />
      </label>
    );
  }

  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const multiline = field.type === 'text' && isMultilineField(field);
  return (
    <label className="mb-3 block">
      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
      {multiline ? (
        <textarea
          rows={3}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_CLASS} resize-none`}
        />
      ) : (
        <input value={text} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS} />
      )}
      <FieldCaption field={field} />
    </label>
  );
}

function ListEditor({
  listKey,
  listField,
  itemFields,
  props,
  onPropsChange,
  onPickColor,
}: {
  listKey: string;
  listField: StorybitEditorField;
  itemFields: StorybitEditorField[];
  props: Record<string, unknown>;
  onPropsChange: (next: Record<string, unknown>) => void;
  onPickColor: (path: string, index: number) => void;
}) {
  const items = Array.isArray(props[listKey]) ? (props[listKey] as unknown[]) : [];
  const bounds = listBounds(listField.limits);
  const primitive = itemFields.length === 0;

  const setItems = (next: unknown[]) => onPropsChange({ ...props, [listKey]: next });

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[#6e6e73]">{fieldLabel(listField)}</p>
        <button
          type="button"
          disabled={items.length >= bounds.max}
          onClick={() => setItems([...items, emptyListItem(itemFields)])}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-[#f5f5f7] px-2 py-1 text-[11px] font-semibold text-[#1d1d1f] hover:bg-gray-200 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="mb-2 text-[10px] text-[#a1a1a6]">No items yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${listKey}-${index}`} className="rounded-xl border border-gray-100 bg-white p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#a1a1a6]">
                  {index + 1}
                </p>
                <button
                  type="button"
                  disabled={items.length <= bounds.min}
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  className="rounded-md p-1 text-[#a1a1a6] hover:bg-gray-100 hover:text-[#1d1d1f] disabled:opacity-30"
                  aria-label="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {primitive ? (
                <input
                  value={typeof item === 'string' || typeof item === 'number' ? String(item) : ''}
                  onChange={(e) => {
                    const next = items.slice();
                    next[index] = e.target.value;
                    setItems(next);
                  }}
                  className={FIELD_CLASS}
                />
              ) : (
                itemFields.map((field) => (
                  <ScalarField
                    key={field.path}
                    field={{ ...field, path: field.path }}
                    value={getByPath(props, field.path, index)}
                    onChange={(next) => onPropsChange(setByPath(props, field.path, next, index))}
                    onPickColor={() => onPickColor(field.path, index)}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}
      <FieldCaption field={listField} />
    </div>
  );
}

function StorybitPropsForm({
  spec,
  props,
  onPropsChange,
  onPickColor,
}: {
  spec: NonNullable<ReturnType<typeof getStorybitEditorSpec>>;
  props: Record<string, unknown>;
  onPropsChange: (next: Record<string, unknown>) => void;
  onPickColor: (path: string, listIndex?: number) => void;
}) {
  const { content, appearance } = useMemo(() => groupStorybitFields(spec.inputs), [spec.inputs]);
  const [appearanceOpen, setAppearanceOpen] = useState(true);

  return (
    <>
      {content.map((group) =>
        group.kind === 'scalar' ? (
          <ScalarField
            key={group.field.path}
            field={group.field}
            value={getByPath(props, group.field.path)}
            onChange={(next) => onPropsChange(setByPath(props, group.field.path, next))}
            onPickColor={(path) => onPickColor(path)}
          />
        ) : (
          <ListEditor
            key={group.key}
            listKey={group.key}
            listField={group.listField}
            itemFields={group.itemFields}
            props={props}
            onPropsChange={onPropsChange}
            onPickColor={(path, index) => onPickColor(path, index)}
          />
        ),
      )}

      {appearance.length > 0 && (
        <div className="mt-1 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setAppearanceOpen((open) => !open)}
            className="mb-2 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]"
          >
            Colours & fonts
            {appearanceOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {appearanceOpen &&
            appearance.map((field) => (
              <ScalarField
                key={field.path}
                field={field}
                value={getByPath(props, field.path)}
                onChange={(next) => onPropsChange(setByPath(props, field.path, next))}
                onPickColor={(path) => onPickColor(path)}
              />
            ))}
        </div>
      )}
    </>
  );
}

function LegacyOverlayFields({
  clip,
  onDisplayText,
  onPickColor,
}: {
  clip: TimelineClip;
  onDisplayText: (value: string) => void;
  onPickColor: () => void;
}) {
  const displayValue = overlayDisplayTextForEditor(clip.remotion?.props, clip.text || '');
  const color =
    (typeof clip.remotion?.props.colorHint === 'string' && clip.remotion.props.colorHint) ||
    (typeof clip.remotion?.props.color === 'string' && clip.remotion.props.color) ||
    clip.textColor ||
    '#ffffff';
  return (
    <>
      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Display text</p>
      <textarea
        value={displayValue}
        rows={3}
        onChange={(e) => onDisplayText(e.target.value)}
        className={`mb-3 ${FIELD_CLASS} resize-none`}
      />
      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Colour hint</p>
      <ColorSwatchButton value={color} onPick={onPickColor} />
      <p className="mt-1 text-[10px] leading-relaxed text-[#a1a1a6]">
        Colour hint is styling only — it is not shown as on-screen copy.
      </p>
    </>
  );
}

export function InfographicClipEditor({
  clip,
  onPropsChange,
  onPlacement,
  onPickColor,
  onLegacyDisplayText,
  onLegacyPickColor,
}: {
  clip: TimelineClip;
  onPropsChange: (next: Record<string, unknown>) => void;
  onPlacement: (placement: string) => void;
  onPickColor: (path: string, listIndex?: number) => void;
  onLegacyDisplayText: (value: string) => void;
  onLegacyPickColor: () => void;
}) {
  const animationType = clip.remotion?.animationType;
  const spec = isStorybitAnimationType(animationType) ? getStorybitEditorSpec(animationType) : null;
  const placement = clip.placement || clip.remotion?.placement || 'center';
  const props = clip.remotion?.props ?? {};

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
        {spec ? `Edit ${spec.name}` : 'Edit overlay'}
      </p>
      {spec ? (
        <StorybitPropsForm
          spec={spec}
          props={props}
          onPropsChange={onPropsChange}
          onPickColor={onPickColor}
        />
      ) : (
        <LegacyOverlayFields
          clip={clip}
          onDisplayText={onLegacyDisplayText}
          onPickColor={onLegacyPickColor}
        />
      )}
      <p className="mb-1.5 mt-2 text-[11px] font-semibold text-[#6e6e73]">Position</p>
      <select
        value={INFOGRAPHIC_PLACEMENTS.some((p) => p.id === placement) ? placement : 'center'}
        onChange={(e) => onPlacement(e.target.value)}
        className="mb-1 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
      >
        {INFOGRAPHIC_PLACEMENTS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
