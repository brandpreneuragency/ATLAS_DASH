import type { ReactNode } from 'react';

export type PanelId = 'left' | 'center' | 'right';

export interface PageTemplatePanelConfig {
  /**
   * Controlled open state. When provided, the panel open state is fully controlled.
   */
  open?: boolean;
  /**
   * Uncontrolled default open state. Ignored when `open` is provided.
   * @default true
   */
  defaultOpen?: boolean;
  /**
   * Controlled width in vw. When provided, width is fully controlled.
   */
  widthVw?: number;
  /**
   * Uncontrolled default width in vw. Ignored when `widthVw` is provided.
   */
  defaultWidthVw?: number;
  /**
   * Minimum width in vw. Required.
   */
  minWidthVw: number;
  /**
   * Maximum width in vw. Required.
   */
  maxWidthVw: number;
  /**
   * Header height as a CSS length (e.g. "4vh", "32px").
   * @default "4vh"
   */
  headerHeight?: string;
  /**
   * Footer height as a CSS length (e.g. "10vh", "64px").
   * @default "10vh"
   */
  footerHeight?: string;
}

export interface PageTemplateSlots {
  leftHeader?: ReactNode;
  leftMain?: ReactNode;
  leftFooter?: ReactNode;
  centerHeader?: ReactNode;
  centerMain?: ReactNode;
  centerFooter?: ReactNode;
  rightHeader?: ReactNode;
  rightMain?: ReactNode;
  rightFooter?: ReactNode;
}

export interface ReusablePageTemplateProps {
  left?: PageTemplatePanelConfig;
  center?: PageTemplatePanelConfig;
  right?: PageTemplatePanelConfig;
  /**
   * Called whenever a panel width changes from a resize drag.
   */
  onPanelResize?: (panel: PanelId, widthVw: number) => void;
  /**
   * Called whenever a panel open state changes from a toggle.
   */
  onPanelOpenChange?: (panel: PanelId, open: boolean) => void;
  slots: PageTemplateSlots;
  /**
   * Optional extra class name applied to the root container.
   */
  className?: string;
}
