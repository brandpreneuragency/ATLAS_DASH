import { useState } from 'react';
import { X, Cpu, Users, Zap, Palette, LogOut, UserCircle2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';

type SettingsSection = 'models' | 'agents' | 'actions' | 'appearance' | null;

export function SettingsPanel() {
  const setSettingsPanelOpen = useUIStore((s) => s.setSettingsPanelOpen);
  const [activeSection, setActiveSection] = useState<SettingsSection>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const busy = useAuthStore((s) => s.busy);

  const menuItems: { id: Exclude<SettingsSection, null>; icon: typeof Cpu; label: string; description: string }[] = [
    { id: 'models', icon: Cpu, label: 'Models', description: 'AI providers and model selection' },
    { id: 'agents', icon: Users, label: 'Agents', description: 'Manage writer and task agents' },
    { id: 'actions', icon: Zap, label: 'Actions', description: 'Quick prompts and saved actions' },
    { id: 'appearance', icon: Palette, label: 'Appearance', description: 'Text size, font, language, theme' },
  ];

  return (
    <div
      id="settings-panel"
      className="flex-col h-full shrink-0"
      style={{
        display: 'flex',
        minHeight: 0,
        background: 'var(--c-background-2)',
        borderRight: '1px solid var(--layout-border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 row"
        style={{
          height: 42,
          padding: '0 12px',
          borderBottom: '1px solid var(--layout-border)',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 className="semibold" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>Settings</h3>
        <button
          type="button"
          onClick={() => setSettingsPanelOpen(false)}
          aria-label="Close settings"
          className="btn-icon"
          style={{ width: 24, height: 24 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Account card */}
      <div
        id="settings-account-card"
        className="shrink-0 flex-col"
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--layout-border)',
          gap: 10,
        }}
      >
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <div
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'var(--c-accent-center-panel)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <UserCircle2 size={18} />
          </div>
          <div className="flex-col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
            <span
              className="semibold"
              style={{
                fontSize: 'var(--fs-sm)',
                color: 'var(--c-text-1)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.displayName ?? 'Not signed in'}
            </span>
            <span
              className="subtle"
              style={{
                fontSize: 'var(--fs-10)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.email ?? ''}
            </span>
          </div>
          {user && (
            <span
              className="subtle"
              style={{
                fontSize: 'var(--fs-10)',
                background: 'var(--c-background-3)',
                border: '1px solid var(--c-border-1)',
                borderRadius: 9999,
                padding: '1px 8px',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'var(--c-accent-center-panel)',
                flexShrink: 0,
              }}
            >
              {user.role}
            </span>
          )}
        </div>
        <button
          id="settings-logout-btn"
          type="button"
          onClick={() => { void logout(); }}
          disabled={!user || busy}
          className="btn"
          style={{
            justifyContent: 'center',
            gap: 6,
            padding: '6px 10px',
            fontSize: 'var(--fs-xs)',
            fontWeight: 500,
            color: 'var(--c-danger)',
            background: 'transparent',
            border: '1px solid var(--c-border-1)',
          }}
        >
          <LogOut size={13} />
          <span>{busy ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>

      {/* Menu */}
      <div className="flex-col flex-1" style={{ padding: 8, gap: 4, overflow: 'auto' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className="btn w-full"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 'var(--fs-sm)',
                justifyContent: 'flex-start',
                gap: 10,
                background: isActive ? 'var(--c-background-4)' : undefined,
                color: isActive ? 'var(--c-accent-center-panel)' : undefined,
                textAlign: 'left',
                alignItems: 'center',
              }}
            >
              <Icon size={14} />
              <div className="flex-col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                <span className="semibold" style={{ fontSize: 'var(--fs-sm)' }}>{item.label}</span>
                <span className="subtle" style={{ fontSize: 'var(--fs-10)' }}>{item.description}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
