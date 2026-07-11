
import React, { useState, useEffect } from 'react';
import { PictureInPicture, PictureInPicture2, RefreshCw, CheckCircle2, AlertCircle, DownloadCloud, UploadCloud, MoreHorizontal } from 'lucide-react';
import { ModelOption } from '../../types';
import { translations } from '../../utils/appUtils';
import { IconNewChat, IconSidebarToggle, IconScenarios } from '../icons/CustomIcons';
import { HeaderModelSelector } from './HeaderModelSelector';

interface HeaderProps {
  onNewChat: () => void;
  onOpenSettingsModal: () => void;
  onOpenScenariosModal: () => void;
  onToggleHistorySidebar: () => void;
  isLoading: boolean;
  currentModelName?: string;
  availableModels: ModelOption[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  isSwitchingModel: boolean;
  isHistorySidebarOpen: boolean;
  onLoadCanvasPrompt: () => void;
  isCanvasPromptActive: boolean;
  t: (key: keyof typeof translations) => string;
  isKeyLocked: boolean;
  isPipSupported: boolean;
  isPipActive: boolean;
  onTogglePip: () => void;
  themeId: string;
  thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  onSetThinkingLevel: (level: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH') => void;
  pullStatus: 'idle' | 'syncing' | 'success' | 'error';
  pushStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastPullTime: number | null;
  lastPushTime: number | null;
  onPullFromServer: () => void;
  onPushToServer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewChat,
  onOpenSettingsModal,
  onOpenScenariosModal,
  onToggleHistorySidebar,
  isLoading,
  currentModelName,
  availableModels,
  selectedModelId,
  onSelectModel,
  isSwitchingModel,
  isHistorySidebarOpen,
  onLoadCanvasPrompt,
  isCanvasPromptActive,
  t,
  isKeyLocked,
  isPipSupported,
  isPipActive,
  onTogglePip,
  themeId,
  thinkingLevel,
  onSetThinkingLevel,
  pullStatus,
  pushStatus,
  lastPullTime,
  lastPushTime,
  onPullFromServer,
  onPushToServer,
}) => {
  const [newChatShortcut, setNewChatShortcut] = useState('');
  const [pipShortcut, setPipShortcut] = useState('');
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? 'Cmd' : 'Ctrl';
    setNewChatShortcut(`${modifier} + Shift + N`);
    setPipShortcut(`${modifier} + Shift + P`);
  }, []);

  const headerButtonBase = "w-11 h-11 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 ease-[cubic-bezier(0.19,1,0.22,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg-primary)] focus-visible:ring-[var(--theme-border-focus)] hover:scale-105 active:scale-95";
  const headerButtonInactive = "bg-transparent text-[var(--theme-icon-settings)] hover:bg-[var(--theme-bg-tertiary)] hover:text-[var(--theme-text-primary)] active:bg-[var(--theme-bg-tertiary)] active:text-[var(--theme-text-primary)]";
  const headerButtonActive = "text-[var(--theme-text-link)] bg-[var(--theme-bg-accent)]/10 hover:bg-[var(--theme-bg-accent)]/20";

  const canvasPromptAriaLabel = isCanvasPromptActive
    ? t('canvasHelperActive_aria')
    : t('canvasHelperInactive_aria');
  const canvasPromptTitle = isCanvasPromptActive
    ? t('canvasHelperActive_title')
    : t('canvasHelperInactive_title');

  const iconSize = 20;
  const strokeWidth = 2;

  const getStatusIcon = (status: 'idle' | 'syncing' | 'success' | 'error', type: 'pull' | 'push') => {
    switch (status) {
      case 'syncing':
        return <RefreshCw size={iconSize} strokeWidth={strokeWidth} className="animate-spin text-[var(--theme-text-link)]" />;
      case 'success':
        return <CheckCircle2 size={iconSize} strokeWidth={strokeWidth} className="text-emerald-500" />;
      case 'error':
        return <AlertCircle size={iconSize} strokeWidth={strokeWidth} className="text-red-500" />;
      default:
        return type === 'pull' 
          ? <DownloadCloud size={iconSize} strokeWidth={strokeWidth} /> 
          : <UploadCloud size={iconSize} strokeWidth={strokeWidth} />;
    }
  };

  const syncLabel = (type: 'pull' | 'push', status: HeaderProps['pullStatus'], lastTime: number | null) => {
    const action = t(type === 'pull' ? 'sync_pull' : 'sync_push');
    const statusText = t(`sync_status_${status}` as keyof typeof translations);
    const last = lastTime ? ` · ${t('sync_last')}: ${new Date(lastTime).toLocaleTimeString()}` : '';
    return `${action} · ${statusText}${last}`;
  };

  return (
    <header className={`${themeId === 'pearl' ? 'bg-[var(--theme-bg-primary)]' : 'bg-[var(--theme-bg-secondary)]'} pl-2 pr-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:pl-3 sm:pr-3 sm:pb-3 sm:pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between gap-2 sm:gap-3 flex-shrink-0 relative z-20 transition-[padding] duration-200`}>

      {/* Left Section: Navigation & Model Selector */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleHistorySidebar}
          className={`${headerButtonBase} ${headerButtonInactive} md:hidden`}
          aria-label={isHistorySidebarOpen ? t('historySidebarClose') : t('historySidebarOpen')}
          title={isHistorySidebarOpen ? t('historySidebarClose_short') : t('historySidebarOpen_short')}
        >
          <IconSidebarToggle size={iconSize} strokeWidth={strokeWidth} />
        </button>

        <HeaderModelSelector
          currentModelName={currentModelName}
          availableModels={availableModels}
          selectedModelId={selectedModelId}
          onSelectModel={onSelectModel}
          isSwitchingModel={isSwitchingModel}
          isLoading={isLoading}
          t={t}
          thinkingLevel={thinkingLevel}
          onSetThinkingLevel={onSetThinkingLevel}
        />
      </div>

      {/* Right Section: Action Buttons (Redesigned) */}
      <div className="flex items-center gap-1 sm:gap-2.5 justify-end flex-shrink-0">

        {/* Pull Button */}
        <button
          onClick={onPullFromServer}
          disabled={pullStatus === 'syncing' || pushStatus === 'syncing'}
          className={`${headerButtonBase} ${headerButtonInactive} ${pullStatus !== 'idle' ? 'bg-[var(--theme-bg-tertiary)]' : ''} hidden md:flex`}
          aria-label={syncLabel('pull', pullStatus, lastPullTime)}
          title={syncLabel('pull', pullStatus, lastPullTime)}
        >
          {getStatusIcon(pullStatus, 'pull')}
        </button>

        {/* Push Button */}
        <button
          onClick={onPushToServer}
          disabled={pullStatus === 'syncing' || pushStatus === 'syncing'}
          className={`${headerButtonBase} ${headerButtonInactive} ${pushStatus !== 'idle' ? 'bg-[var(--theme-bg-tertiary)]' : ''} hidden md:flex`}
          aria-label={syncLabel('push', pushStatus, lastPushTime)}
          title={syncLabel('push', pushStatus, lastPushTime)}
        >
          {getStatusIcon(pushStatus, 'push')}
        </button>

        {/* 3. PiP Button (Expand) */}
        {isPipSupported && (
          <button
            onClick={onTogglePip}
            className={`${headerButtonBase} ${headerButtonInactive} hidden md:flex`}
            aria-label={t(isPipActive ? 'pipExit' : 'pipEnter')}
            title={`${t(isPipActive ? 'pipExit' : 'pipEnter')} (${pipShortcut})`}
          >
            {isPipActive ? <PictureInPicture2 size={iconSize} strokeWidth={strokeWidth} /> : <PictureInPicture size={iconSize} strokeWidth={strokeWidth} />}
          </button>
        )}

        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => setIsOverflowOpen(open => !open)}
            className={`${headerButtonBase} ${headerButtonInactive}`}
            aria-haspopup="menu"
            aria-expanded={isOverflowOpen}
            aria-label={t('more_actions')}
            title={t('more_actions')}
          >
            <MoreHorizontal size={iconSize} />
          </button>
          {isOverflowOpen && (
            <div role="menu" className="absolute right-0 top-12 z-50 min-w-56 rounded-xl border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)] p-1.5 shadow-xl">
              <button role="menuitem" disabled={pullStatus === 'syncing' || pushStatus === 'syncing'} onClick={() => { setIsOverflowOpen(false); onPullFromServer(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] disabled:opacity-60">
                {getStatusIcon(pullStatus, 'pull')} <span>{syncLabel('pull', pullStatus, lastPullTime)}</span>
              </button>
              <button role="menuitem" disabled={pullStatus === 'syncing' || pushStatus === 'syncing'} onClick={() => { setIsOverflowOpen(false); onPushToServer(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] disabled:opacity-60">
                {getStatusIcon(pushStatus, 'push')} <span>{syncLabel('push', pushStatus, lastPushTime)}</span>
              </button>
              {isPipSupported && <button role="menuitem" onClick={() => { setIsOverflowOpen(false); onTogglePip(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)]">
                {isPipActive ? <PictureInPicture2 size={iconSize} /> : <PictureInPicture size={iconSize} />} <span>{t(isPipActive ? 'pipExit' : 'pipEnter')}</span>
              </button>}
            </div>
          )}
        </div>

        {/* 4. New Chat Button (formerly Settings) */}
        <button
          onClick={onNewChat}
          className={`${headerButtonBase} ${headerButtonInactive} md:hidden`}
          aria-label={t('headerNewChat_aria')}
          title={`${t('newChat')} (${newChatShortcut})`}
        >
          <IconNewChat size={iconSize} strokeWidth={strokeWidth} />
        </button>
      </div>
    </header>
  );
};
