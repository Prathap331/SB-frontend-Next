'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { TimelineClip } from '@/lib/video-editor/types';
import { overlayDisplayTextForEditor } from '@/lib/video-editor/infographics';
import {
  colorToInputValue,
  editorColorFieldLabel,
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
  resolveStyleSlotColor,
  setByPath,
  styleColorPath,
  styleColorSlotFromPath,
  textColorSlotForField,
  type StorybitEditorField,
} from '@/lib/video-editor/storybitEditorFields';
import { isStorybitAnimationType } from '@/remotion/animationTypes';
import { LucideIconView } from '@/remotion/icons';
import { COLOR_SLOTS } from '@/remotion/compositions/templates/storybit/core/style';

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

function formatIconLabel(name: string): string {
  return name
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function IconDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value.trim();

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const options = useMemo(() => {
    const names: string[] = [...LUCIDE_ICON_OPTIONS];
    if (selected && !names.includes(selected)) names.unshift(selected);
    const q = query.trim().toLowerCase().replace(/[-_]+/g, ' ');
    if (!q) return names;
    return names.filter((name) => {
      const label = formatIconLabel(name).toLowerCase();
      return name.toLowerCase().includes(query.trim().toLowerCase()) || label.includes(q);
    });
  }, [query, selected]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f] outline-none hover:border-gray-300 focus:border-[#1d1d1f] focus:ring-2 focus:ring-[#1d1d1f]/10"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white">
          <LucideIconView name={selected || 'circle'} size={16} color="#1d1d1f" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left">
          {selected ? formatIconLabel(selected) : 'Choose icon'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 text-[#6e6e73] ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons"
            className="w-full border-b border-gray-100 px-3 py-2 text-xs text-[#1d1d1f] outline-none"
          />
          <div className="max-h-56 overflow-y-auto py-1" role="listbox">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-[#a1a1a6]">No icons match.</p>
            ) : (
              options.map((name) => {
                const active = name === selected;
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(name);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
                      active ? 'bg-[#f5f5f7] font-semibold text-[#1d1d1f]' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                      <LucideIconView name={name} size={16} color="#1d1d1f" />
                    </span>
                    <span className="min-w-0 truncate">{formatIconLabel(name)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function textFieldColorProps(
  field: StorybitEditorField,
  props: Record<string, unknown>,
  onPickColor: (path: string) => void,
  listKey?: string,
) {
  const slot = textColorSlotForField(field, listKey);
  const isText = field.type === 'text' || field.type === 'array';
  return {
    textColor: resolveStyleSlotColor(props, slot),
    textColorTitle: COLOR_SLOTS[slot].label,
    onPickTextColor: isText ? () => onPickColor(styleColorPath(slot)) : undefined,
  };
}

function CompactColorChip({
  value,
  onPick,
  title = 'Text colour',
}: {
  value: string;
  onPick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onPick}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white hover:border-gray-300"
    >
      <span
        className="h-5 w-5 rounded-full border border-gray-200"
        style={{ background: colorToInputValue(value) }}
      />
    </button>
  );
}

function ScalarField({
  field,
  value,
  onChange,
  onPickColor,
  textColor,
  textColorTitle,
  onPickTextColor,
}: {
  field: StorybitEditorField;
  value: unknown;
  onChange: (next: unknown) => void;
  onPickColor: (path: string) => void;
  textColor?: string;
  textColorTitle?: string;
  onPickTextColor?: () => void;
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
        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{editorColorFieldLabel(field)}</p>
        <button
          type="button"
          onClick={() => onPickColor(field.path)}
          className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
        >
          <span
            className="h-5 w-5 flex-shrink-0 rounded-full border border-gray-200"
            style={{ background: colorToInputValue(hex || textColor || '#ffffff') }}
          />
          {hex || textColor || 'Pick colour'}
        </button>
        <FieldCaption field={field} />
      </div>
    );
  }

  if (field.type === 'icon') {
    return (
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
        <IconDropdown value={typeof value === 'string' ? value : ''} onChange={onChange} />
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
        <div className="flex items-start gap-2">
          <textarea
            rows={2}
            value={formatArrayField(value)}
            onChange={(e) => onChange(parseArrayField(e.target.value, /number|value/i.test(field.fills ?? '')))}
            className={`${FIELD_CLASS} min-w-0 flex-1 resize-none`}
          />
          {onPickTextColor ? (
            <CompactColorChip value={textColor ?? ''} onPick={onPickTextColor} title={textColorTitle} />
          ) : null}
        </div>
        <FieldCaption field={field} />
      </label>
    );
  }

  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const multiline = field.type === 'text' && isMultilineField(field);
  return (
    <label className="mb-3 block">
      <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">{label}</p>
      <div className="flex items-start gap-2">
        {multiline ? (
          <textarea
            rows={3}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className={`${FIELD_CLASS} min-w-0 flex-1 resize-none`}
          />
        ) : (
          <input
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className={`${FIELD_CLASS} min-w-0 flex-1`}
          />
        )}
        {onPickTextColor ? (
          <CompactColorChip value={textColor ?? ''} onPick={onPickTextColor} title={textColorTitle} />
        ) : null}
      </div>
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
  onPropsChange: (next: Record<string, unknown>, changedPath?: string) => void;
  onPickColor: (path: string, index?: number) => void;
}) {
  const items = Array.isArray(props[listKey]) ? (props[listKey] as unknown[]) : [];
  const bounds = listBounds(listField.limits);
  const primitive = itemFields.length === 0;
  const primitiveSlot = textColorSlotForField(listField, listKey);
  const primitiveColor = resolveStyleSlotColor(props, primitiveSlot);
  const primitiveTitle = COLOR_SLOTS[primitiveSlot].label;

  const setItems = (next: unknown[]) => onPropsChange({ ...props, [listKey]: next }, listKey);

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
                <div className="flex items-start gap-2">
                  <input
                    value={typeof item === 'string' || typeof item === 'number' ? String(item) : ''}
                    onChange={(e) => {
                      const next = items.slice();
                      next[index] = e.target.value;
                      setItems(next);
                    }}
                    className={`${FIELD_CLASS} min-w-0 flex-1`}
                  />
                  <CompactColorChip
                    value={primitiveColor}
                    onPick={() => onPickColor(styleColorPath(primitiveSlot))}
                    title={primitiveTitle}
                  />
                </div>
              ) : (
                itemFields.map((field) => (
                    <ScalarField
                      key={field.path}
                      field={field}
                      value={getByPath(props, field.path, index)}
                      onChange={(next) => onPropsChange(setByPath(props, field.path, next, index), field.path)}
                      onPickColor={(path) => onPickColor(path, index)}
                      {...textFieldColorProps(field, props, onPickColor, listKey)}
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
  onPropsChange: (next: Record<string, unknown>, changedPath?: string) => void;
  onPickColor: (path: string, listIndex?: number) => void;
}) {
  const { content, colors, appearance } = useMemo(() => groupStorybitFields(spec.inputs), [spec.inputs]);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  return (
    <>
      {content.map((group) =>
        group.kind === 'scalar' ? (
          <ScalarField
            key={group.field.path}
            field={group.field}
            value={getByPath(props, group.field.path)}
            onChange={(next) => onPropsChange(setByPath(props, group.field.path, next), group.field.path)}
            onPickColor={(path) => onPickColor(path)}
            {...textFieldColorProps(group.field, props, onPickColor)}
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

      {colors.length > 0 && (
        <div className="mb-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">Colours</p>
          {colors.map((field) => {
            const slot = styleColorSlotFromPath(field.path);
            const resolved = slot ? resolveStyleSlotColor(props, slot) : undefined;
            return (
              <ScalarField
                key={field.path}
                field={field}
                value={getByPath(props, field.path)}
                onChange={(next) => onPropsChange(setByPath(props, field.path, next), field.path)}
                onPickColor={(path) => onPickColor(path)}
                textColor={resolved}
              />
            );
          })}
        </div>
      )}

      {appearance.length > 0 && (
        <div className="mt-1 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setAppearanceOpen((open) => !open)}
            className="mb-2 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]"
          >
            Fonts
            {appearanceOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {appearanceOpen &&
            appearance.map((field) => (
              <ScalarField
                key={field.path}
                field={field}
                value={getByPath(props, field.path)}
                onChange={(next) => onPropsChange(setByPath(props, field.path, next), field.path)}
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
      <div className="mb-3 flex items-start gap-2">
        <textarea
          value={displayValue}
          rows={3}
          onChange={(e) => onDisplayText(e.target.value)}
          className={`${FIELD_CLASS} min-w-0 flex-1 resize-none`}
        />
        <CompactColorChip value={color} onPick={onPickColor} />
      </div>
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
  onPropsChange: (next: Record<string, unknown>, changedPath?: string) => void;
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
