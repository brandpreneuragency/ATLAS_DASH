import type { ReactNode } from 'react';
import { ReusablePageTemplate } from '../pageTemplate/ReusablePageTemplate';

interface SettingsPanelsProps {
  leftHeader?: ReactNode;
  leftMain?: ReactNode;
  centerHeader?: ReactNode;
  centerMain?: ReactNode;
  rightHeader?: ReactNode;
  rightMain?: ReactNode;
  rightFooter?: ReactNode;
}

// Three-column layout (left list | center detail | right AI chat) — mirrors
// the outer main-row design used by task/doc mode where the center panel
// shares the main container with an AI sidebar. The right panel is open
// by default and each Settings sub-tab passes its own chat content via
// `rightMain`/`rightFooter`, so every sub-tab gets its own independent
// chat window with the same look as the task-mode AI sidebar.
export function SettingsPanels({
  leftHeader,
  leftMain,
  centerHeader,
  centerMain,
  rightHeader,
  rightMain,
  rightFooter,
}: SettingsPanelsProps) {
  return (
    <ReusablePageTemplate
      className="settings-panels"
      left={{ open: true, widthVw: 24, minWidthVw: 18, maxWidthVw: 38, headerHeight: 'auto' }}
      center={{ open: true, minWidthVw: 36, maxWidthVw: 100, headerHeight: 'auto' }}
      right={{
        open: true,
        widthVw: 28,
        minWidthVw: 22,
        maxWidthVw: 40,
        headerHeight: 'auto',
        footerHeight: 'auto',
      }}
      slots={{
        leftHeader,
        leftMain,
        centerHeader,
        centerMain,
        rightHeader,
        rightMain,
        rightFooter,
      }}
    />
  );
}
