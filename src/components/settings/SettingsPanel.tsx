import { useState } from 'react';
import { X, Cpu, Users, Zap, Palette } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

type SettingsSection = 'models' | 'actions' | 'appearance' | null;

export function SettingsPanel() {
  const { setSettingsPanelOpen, activeModal, setActiveModal } = useUIStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>(null);

  const openModelsModal = () => {
    setActiveModal('modelManagement');
    setActiveSection('models');
  };

  const openAgentsModal = () => {
    setActiveModal('agentsManager');
  };

  const menuItems: { id: Exclude<SettingsSection, null>; icon: typeof Cpu; label: string; description: string }[] = [
    { id: 'models', icon: Cpu, label: 'Models', description: 'AI providers and model selection' },
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
          height: 'fit-content',
          padding: '0 0 0 16px',
          borderBottom: '1px solid var(--layout-border)',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 className="semibold" style={{ fontSize: 'var(--fs-base)', margin: 0 }}>Settings</h3>
        <button
          type="button"
          onClick={() => setSettingsPanelOpen(false)}
          aria-label="Close settings"
          className="btn-icon"
          style={{ width: 'var(--control-height-sm)', height: 'var(--control-height-sm)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Menu */}
      <div className="flex-col flex-1" style={{ padding: 8, gap: 4, overflow: 'auto' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isModels = item.id === 'models';
          const isActive = isModels
            ? activeModal === 'modelManagement'
            : activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => (isModels ? openModelsModal() : setActiveSection(item.id))}
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
                <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{item.description}</span>
              </div>
            </button>
          );
        })}

        {/* Agents button - opens modal */}
        <button
          type="button"
          onClick={openAgentsModal}
          className="btn w-full"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 'var(--fs-sm)',
            justifyContent: 'flex-start',
            gap: 10,
            textAlign: 'left',
            alignItems: 'center',
          }}
        >
          <Users size={14} />
          <div className="flex-col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
            <span className="semibold" style={{ fontSize: 'var(--fs-sm)' }}>Agents</span>
            <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>Manage writer and task agents</span>
          </div>
        </button>
      </div>
    </div>
  );
}
