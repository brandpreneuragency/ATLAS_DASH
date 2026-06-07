import { Extension } from '@tiptap/core';

export const INLINE_TEXT_PRESETS = ['h1', 'h2', 'h3'] as const;

export type InlineTextPresetName = (typeof INLINE_TEXT_PRESETS)[number];

const INLINE_PRESET_STYLES: Record<InlineTextPresetName, string> = {
  h1: 'font-size: var(--inline-preset-h1-size); font-weight: 700; line-height: 1.2;',
  h2: 'font-size: var(--inline-preset-h2-size); font-weight: 600; line-height: 1.3;',
  h3: 'font-size: var(--inline-preset-h3-size); font-weight: 600; line-height: 1.35;',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineTextPreset: {
      setInlineTextPreset: (preset: InlineTextPresetName) => ReturnType
      unsetInlineTextPreset: () => ReturnType
    }
  }
}

declare module '@tiptap/extension-text-style' {
  interface TextStyleAttributes {
    textPreset?: InlineTextPresetName | null
  }
}

export const InlineTextPreset = Extension.create({
  name: 'inlineTextPreset',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          textPreset: {
            default: null,
            parseHTML: element => {
              const value = element.getAttribute('data-text-preset');

              return value && INLINE_TEXT_PRESETS.includes(value as InlineTextPresetName)
                ? value
                : null;
            },
            renderHTML: attributes => {
              const preset = attributes.textPreset as InlineTextPresetName | null | undefined;

              if (!preset || !INLINE_TEXT_PRESETS.includes(preset)) {
                return {};
              }

              return {
                'data-text-preset': preset,
                style: INLINE_PRESET_STYLES[preset],
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setInlineTextPreset:
        (preset: InlineTextPresetName) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { textPreset: preset }).run();
        },
      unsetInlineTextPreset:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { textPreset: null }).removeEmptyTextStyle().run();
        },
    };
  },
});
