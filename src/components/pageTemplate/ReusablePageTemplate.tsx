import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type {
  PageTemplatePanelConfig,
  PanelId,
  ReusablePageTemplateProps,
} from './types';
import { usePanelResize } from './usePanelResize';
import './pageTemplate.css';

const DEFAULT_HEADER_HEIGHT = '4vh';
const DEFAULT_FOOTER_HEIGHT = '10vh';

interface ResolvedPanelConfig {
  open: boolean;
  widthVw: number;
  minWidthVw: number;
  maxWidthVw: number;
  headerHeight: string;
  footerHeight: string;
}

function resolvePanelConfig(
  config: PageTemplatePanelConfig | undefined,
  defaults: PageTemplatePanelConfig,
  defaultOpenFallback: boolean,
  defaultWidthFallback: number,
): ResolvedPanelConfig {
  const merged: PageTemplatePanelConfig = { ...defaults, ...config };
  return {
    open: merged.open ?? merged.defaultOpen ?? defaults.open ?? defaultOpenFallback,
    widthVw:
      merged.widthVw ??
      merged.defaultWidthVw ??
      defaults.widthVw ??
      defaults.defaultWidthVw ??
      defaultWidthFallback,
    minWidthVw: merged.minWidthVw ?? defaults.minWidthVw ?? 10,
    maxWidthVw: merged.maxWidthVw ?? defaults.maxWidthVw ?? 100,
    headerHeight: merged.headerHeight ?? defaults.headerHeight ?? DEFAULT_HEADER_HEIGHT,
    footerHeight: merged.footerHeight ?? defaults.footerHeight ?? DEFAULT_FOOTER_HEIGHT,
  };
}

interface PanelSlots {
  header?: ReactNode;
  main?: ReactNode;
  footer?: ReactNode;
}

interface PanelBlockProps {
  side: 'left' | 'center' | 'right';
  widthVw: number;
  config: ResolvedPanelConfig;
  slots: PanelSlots;
  isOpen: boolean;
}

function PanelBlock({ side, widthVw, config, slots, isOpen }: PanelBlockProps) {
  const style: CSSProperties = {
    ['--pt-panel-width' as string]: `${widthVw}vw`,
    ['--pt-header-height' as string]: config.headerHeight,
    ['--pt-footer-height' as string]: config.footerHeight,
  };
  const sideClass = `reusable-page-template__panel--${side}`;
  const className = [
    'reusable-page-template__panel',
    sideClass,
    isOpen ? '' : 'reusable-page-template__panel--hidden',
  ]
    .filter(Boolean)
    .join(' ');

  const renderSection = (
    kind: 'header' | 'main' | 'footer',
    content: ReactNode,
  ): ReactNode => {
    const isMain = kind === 'main';
    if (content == null && !isMain) return null;
    const sectionClass = [
      'reusable-page-template__section',
      `reusable-page-template__section--${kind}`,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <div className={sectionClass} data-section={kind}>
        {content}
      </div>
    );
  };

  return (
    <div
      className={className}
      data-panel={side}
      data-open={isOpen ? 'true' : 'false'}
      style={style}
    >
      {renderSection('header', slots.header)}
      {renderSection('main', slots.main)}
      {renderSection('footer', slots.footer)}
    </div>
  );
}

export function ReusablePageTemplate(props: ReusablePageTemplateProps) {
  const { left, center, right, slots, onPanelResize, onPanelOpenChange, className } = props;

  // Defaults from the spec.
  const defaultLeft: PageTemplatePanelConfig = {
    open: true,
    defaultOpen: true,
    widthVw: 20,
    defaultWidthVw: 20,
    minWidthVw: 20,
    maxWidthVw: 40,
    headerHeight: DEFAULT_HEADER_HEIGHT,
    footerHeight: DEFAULT_FOOTER_HEIGHT,
  };
  const defaultRight: PageTemplatePanelConfig = {
    open: true,
    defaultOpen: true,
    widthVw: 30,
    defaultWidthVw: 30,
    minWidthVw: 20,
    maxWidthVw: 50,
    headerHeight: DEFAULT_HEADER_HEIGHT,
    footerHeight: DEFAULT_FOOTER_HEIGHT,
  };
  const defaultCenter: PageTemplatePanelConfig = {
    open: true,
    defaultOpen: true,
    minWidthVw: 50,
    maxWidthVw: 100,
    headerHeight: DEFAULT_HEADER_HEIGHT,
    footerHeight: DEFAULT_FOOTER_HEIGHT,
  };

  const leftResolved = resolvePanelConfig(left, defaultLeft, true, 20);
  const centerResolved = resolvePanelConfig(center, defaultCenter, true, 100);
  const rightResolved = resolvePanelConfig(right, defaultRight, true, 30);

  // The center panel is always visible.
  const centerIsOpen = true;
  // The host fully controls open state for left/right. The optional
  // `onPanelOpenChange` callback is reserved for future internal toggles
  // (the current template places toggle UI inside slot content).
  void (onPanelOpenChange as ((panel: PanelId, open: boolean) => void) | undefined);

  const leftHandle = usePanelResize({
    widthVw: leftResolved.widthVw,
    minWidthVw: leftResolved.minWidthVw,
    maxWidthVw: leftResolved.maxWidthVw,
    direction: 'right',
    onResize: (next) => onPanelResize?.('left', next),
    opposingMinWidthVw: centerResolved.minWidthVw,
  });

  const rightHandle = usePanelResize({
    widthVw: rightResolved.widthVw,
    minWidthVw: rightResolved.minWidthVw,
    maxWidthVw: rightResolved.maxWidthVw,
    direction: 'left',
    onResize: (next) => onPanelResize?.('right', next),
    opposingMinWidthVw: centerResolved.minWidthVw,
  });

  const rootClassName = useMemo(
    () => ['reusable-page-template', className].filter(Boolean).join(' '),
    [className],
  );

  return (
    <div className={rootClassName} role="group" aria-label="Reusable page template">
      <div className="reusable-page-template__row">
        <PanelBlock
          side="left"
          widthVw={leftResolved.widthVw}
          config={leftResolved}
          isOpen={leftResolved.open}
          slots={{
            header: slots.leftHeader,
            main: slots.leftMain,
            footer: slots.leftFooter,
          }}
        />

        {leftResolved.open && (
          <div
            className="reusable-page-template__handle"
            data-handle="left"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize left panel"
            tabIndex={0}
            onPointerDown={leftHandle.onPointerDown}
          />
        )}

        <PanelBlock
          side="center"
          widthVw={0}
          config={centerResolved}
          isOpen={centerIsOpen}
          slots={{
            header: slots.centerHeader,
            main: slots.centerMain,
            footer: slots.centerFooter,
          }}
        />

        {rightResolved.open && (
          <div
            className="reusable-page-template__handle"
            data-handle="right"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize right panel"
            tabIndex={0}
            onPointerDown={rightHandle.onPointerDown}
          />
        )}

        <PanelBlock
          side="right"
          widthVw={rightResolved.widthVw}
          config={rightResolved}
          isOpen={rightResolved.open}
          slots={{
            header: slots.rightHeader,
            main: slots.rightMain,
            footer: slots.rightFooter,
          }}
        />
      </div>
    </div>
  );
}

// Re-export utility types for convenience in the preview / consumers.
export type { PageTemplateSlots } from './types';
