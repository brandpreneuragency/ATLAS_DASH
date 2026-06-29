import type { ReactNode } from 'react';
import { ReusablePageTemplate } from '../pageTemplate/ReusablePageTemplate';

interface SettingsPanelsProps {
  leftHeader?: ReactNode;
  leftMain?: ReactNode;
  centerHeader?: ReactNode;
  centerMain?: ReactNode;
}

// Left + center only (right panel closed) — the shared layout for every
// Settings sub-tab, per the redesign spec.
export function SettingsPanels({ leftHeader, leftMain, centerHeader, centerMain }: SettingsPanelsProps) {
  return (
    <ReusablePageTemplate
      className="settings-panels"
      left={{ open: true, widthVw: 24, minWidthVw: 18, maxWidthVw: 38, headerHeight: 'auto' }}
      center={{ open: true, minWidthVw: 50, maxWidthVw: 100, headerHeight: 'auto' }}
      right={{ open: false, minWidthVw: 0, maxWidthVw: 0 }}
      slots={{
        leftHeader,
        leftMain,
        centerHeader,
        centerMain,
      }}
    />
  );
}
