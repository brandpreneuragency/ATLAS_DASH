import type { ReactNode } from 'react';
import { ReusablePageTemplate } from '../pageTemplate/ReusablePageTemplate';

interface SettingsPanelsProps {
  leftHeader?: ReactNode;
  leftMain?: ReactNode;
  centerHeader?: ReactNode;
  centerMain?: ReactNode;
}

// Two-column layout (left list | center detail). The AI chat sidebar that
// previously occupied the right column has been removed.
export function SettingsPanels({
  leftHeader,
  leftMain,
  centerHeader,
  centerMain,
}: SettingsPanelsProps) {
  return (
    <ReusablePageTemplate
      className="settings-panels"
      left={{ open: true, widthVw: 24, minWidthVw: 18, maxWidthVw: 38, headerHeight: 'auto' }}
      center={{ open: true, minWidthVw: 36, maxWidthVw: 100, headerHeight: 'auto' }}
      right={{ open: false, widthVw: 0, minWidthVw: 0, maxWidthVw: 0 }}
      slots={{
        leftHeader,
        leftMain,
        centerHeader,
        centerMain,
      }}
    />
  );
}
