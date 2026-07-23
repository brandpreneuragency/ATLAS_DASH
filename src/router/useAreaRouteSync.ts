import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';
import type { Area } from '../types/areas';

/**
 * Keeps the pre-existing uiStore mode flags (`chatMode`/`crmMode`/settings)
 * in sync with the active URL area, so components that were already reading
 * those flags directly (`LeftNarrowSidebar`, `CRMAISidebar`, `AppLayout`'s
 * `selectActiveWorkspaceMode`, ...) keep working unchanged. Only the existing,
 * already-tested setters are called here — no new mode state is introduced.
 *
 * Today/Files have no legacy mode of their own yet (their real screens are a
 * later phase); entering them normalizes to the same "documents" baseline
 * `LeftNarrowSidebar`'s own Documents button already produces.
 */
export function useAreaRouteSync(area: Area): void {
  const setChatMode = useUIStore((s) => s.setChatMode);
  const setCrmMode = useUIStore((s) => s.setCrmMode);
  const openSettings = useUIStore((s) => s.openSettings);
  const crmMode = useUIStore((s) => s.crmMode);
  const chatMode = useUIStore((s) => s.chatMode);
  const settingsActiveView = useUIStore((s) => s.activeView);

  useEffect(() => {
    if (area === 'agent') {
      if (!chatMode) setChatMode(true);
    } else if (area === 'clients') {
      if (!crmMode) setCrmMode(true);
    } else if (area === 'settings') {
      if (settingsActiveView !== 'settings') openSettings();
    } else {
      // work / today / files: fall back to the plain documents baseline.
      if (chatMode || crmMode || settingsActiveView === 'settings') setChatMode(false);
    }
    // Intentionally re-run only when the resolved area changes; the mode
    // flags themselves are outputs of this effect, not additional triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area]);
}
