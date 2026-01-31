
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppSettings, ChatMessage, SideViewContent } from '../../types';
import { CANVAS_SYSTEM_PROMPT, DEFAULT_SYSTEM_INSTRUCTION, BBOX_SYSTEM_PROMPT } from '../../constants/appConstants';
import { useAppSettings } from '../core/useAppSettings';
import { useChat } from '../chat/useChat';
import { useAppUI } from '../core/useAppUI';
import { useAppEvents } from '../core/useAppEvents';
import { usePictureInPicture } from '../core/usePictureInPicture';
import { useDataManagement } from '../useDataManagement';
import { getTranslator, logService, applyThemeToDocument } from '../../utils/appUtils';
import { networkInterceptor } from '../../services/networkInterceptor';

export const useAppLogic = () => {
  const { appSettings, setAppSettings, currentTheme, language } = useAppSettings();
  const t = useMemo(() => getTranslator(language), [language]);

  // Initialize Network Interceptor
  useEffect(() => {
    networkInterceptor.mount();
  }, []);

  // Update Interceptor Configuration when settings change
  useEffect(() => {
    const shouldUseProxy = appSettings.useCustomApiConfig && appSettings.useApiProxy;
    networkInterceptor.configure(!!shouldUseProxy, appSettings.apiProxyUrl);
  }, [appSettings.useCustomApiConfig, appSettings.useApiProxy, appSettings.apiProxyUrl]);

  const chatState = useChat(appSettings, setAppSettings, language);

  const uiState = useAppUI();
  const { setIsHistorySidebarOpen } = uiState;

  // Side Panel State
  const [sidePanelContent, setSidePanelContent] = useState<SideViewContent | null>(null);

  const handleOpenSidePanel = useCallback((content: SideViewContent) => {
    setSidePanelContent(content);
    // Auto-collapse sidebar on smaller screens if opening side panel
    if (window.innerWidth < 1280) {
      setIsHistorySidebarOpen(false);
    }
  }, [setIsHistorySidebarOpen]);

  const handleCloseSidePanel = useCallback(() => {
    setSidePanelContent(null);
  }, []);

  // Close SidePanel on window resize if width is too narrow
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidePanelContent(null);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pipState = usePictureInPicture(uiState.setIsHistorySidebarOpen);

  // Sync styles to PiP window when theme changes
  useEffect(() => {
    if (pipState.pipWindow && pipState.pipWindow.document) {
      applyThemeToDocument(pipState.pipWindow.document, currentTheme, appSettings);
    }
  }, [pipState.pipWindow, currentTheme, appSettings]);

  const eventsState = useAppEvents({
    appSettings,
    startNewChat: chatState.startNewChat,
    handleClearCurrentChat: chatState.handleClearCurrentChat,
    currentChatSettings: chatState.currentChatSettings,
    handleSelectModelInHeader: chatState.handleSelectModelInHeader,
    isSettingsModalOpen: uiState.isSettingsModalOpen,
    isPreloadedMessagesModalOpen: uiState.isPreloadedMessagesModalOpen,
    setIsLogViewerOpen: uiState.setIsLogViewerOpen,
    onTogglePip: pipState.togglePip,
    isPipSupported: pipState.isPipSupported,
    pipWindow: pipState.pipWindow,
    isLoading: chatState.isLoading,
    onStopGenerating: chatState.handleStopGenerating
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting'>('idle');

  const activeChat = chatState.savedSessions.find(s => s.id === chatState.activeSessionId);
  const sessionTitle = activeChat?.title || t('newChat');

  const dataManagement = useDataManagement({
    appSettings,
    setAppSettings,
    savedSessions: chatState.savedSessions,
    updateAndPersistSessions: chatState.updateAndPersistSessions,
    savedGroups: chatState.savedGroups,
    updateAndPersistGroups: chatState.updateAndPersistGroups,
    savedScenarios: chatState.savedScenarios,
    handleSaveAllScenarios: chatState.handleSaveAllScenarios,
    t,
    activeChat,
    scrollContainerRef: chatState.scrollContainerRef,
    currentTheme,
    language,
  });

  const handleExportChat = useCallback(async (format: 'png' | 'html' | 'txt' | 'json') => {
    if (!activeChat) return;
    setExportStatus('exporting');
    try {
      await dataManagement.exportChatLogic(format);
    } catch (error) {
      logService.error(`Chat export failed (format: ${format})`, { error });
      alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExportStatus('idle');
      setIsExportModalOpen(false);
    }
  }, [activeChat, dataManagement]);

  useEffect(() => {
    logService.info('App initialized.');
  }, []);

  const { activeSessionId, setCurrentChatSettings } = chatState;

  // Track which suggestion was used to activate a special mode (Canvas/BBox)
  const [activeSuggestionType, setActiveSuggestionType] = useState<'organize' | 'smart_board' | 'bbox' | null>(null);

  const { currentChatSettings } = chatState;

  // Clear active suggestion if system instruction is reset to default
  useEffect(() => {
    if (currentChatSettings.systemInstruction === DEFAULT_SYSTEM_INSTRUCTION) {
      setActiveSuggestionType(null);
    }
  }, [currentChatSettings.systemInstruction]);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    setAppSettings(newSettings);
    if (activeSessionId && setCurrentChatSettings) {
      setCurrentChatSettings(prevChatSettings => ({
        ...prevChatSettings,
        modelId: newSettings.modelId,
        temperature: newSettings.temperature,
        topP: newSettings.topP,
        systemInstruction: newSettings.systemInstruction,
        showThoughts: newSettings.showThoughts,
        ttsVoice: newSettings.ttsVoice,
        thinkingBudget: newSettings.thinkingBudget,
        thinkingLevel: newSettings.thinkingLevel,
        lockedApiKey: null,
        mediaResolution: newSettings.mediaResolution,
      }));
    }
  }, [setAppSettings, activeSessionId, setCurrentChatSettings]);

  const handleLoadCanvasPromptAndSave = useCallback(() => {
    const isCurrentlyCanvasPrompt = currentChatSettings.systemInstruction === CANVAS_SYSTEM_PROMPT;
    const newSystemInstruction = isCurrentlyCanvasPrompt ? DEFAULT_SYSTEM_INSTRUCTION : CANVAS_SYSTEM_PROMPT;

    // Toggling from toolbar clears any suggestion-specific highlight
    setActiveSuggestionType(null);

    setAppSettings(prev => ({ ...prev, systemInstruction: newSystemInstruction }));
    if (activeSessionId && setCurrentChatSettings) {
      setCurrentChatSettings(prevSettings => ({ ...prevSettings, systemInstruction: newSystemInstruction }));
    }

    // Focus input after toggling canvas mode
    setTimeout(() => {
      const textarea = document.querySelector('textarea[aria-label="Chat message input"]') as HTMLTextAreaElement;
      if (textarea) textarea.focus();
    }, 50);
  }, [currentChatSettings.systemInstruction, setAppSettings, activeSessionId, setCurrentChatSettings]);

  const { isAutoSendOnSuggestionClick } = appSettings;
  const { handleSendMessage, setCommandedInput } = chatState;

  const handleSuggestionClick = useCallback((type: 'homepage' | 'organize' | 'smart_board' | 'follow-up' | 'bbox', text: string) => {
    if (type === 'organize' || type === 'smart_board' || type === 'bbox') {
      const targetPrompt = (type === 'organize' || type === 'smart_board') ? CANVAS_SYSTEM_PROMPT : BBOX_SYSTEM_PROMPT;
      const isCurrentlyTarget = currentChatSettings.systemInstruction === targetPrompt;
      const isCurrentlyThisSuggestion = activeSuggestionType === type;

      let newSystemInstruction = DEFAULT_SYSTEM_INSTRUCTION;

      if (!isCurrentlyTarget) {
        // Not in this mode at all -> Turn it on and highlight this suggestion
        newSystemInstruction = targetPrompt;
        setActiveSuggestionType(type);
      } else if (isCurrentlyThisSuggestion) {
        // Already in this mode AND this suggestion is highlighted -> Turn it off
        newSystemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
        setActiveSuggestionType(null);
      } else {
        // Already in this mode but a DIFFERENT suggestion or toolbar activated it -> Keep mode ON but switch highlight to this one
        newSystemInstruction = targetPrompt;
        setActiveSuggestionType(type);
      }

      // For BBox, we also want to ensure code execution is enabled when turning it on
      const shouldEnableCode = type === 'bbox' && newSystemInstruction === BBOX_SYSTEM_PROMPT;

      setAppSettings(prev => ({
        ...prev,
        systemInstruction: newSystemInstruction,
        isCodeExecutionEnabled: shouldEnableCode ? true : prev.isCodeExecutionEnabled
      }));

      if (activeSessionId && setCurrentChatSettings) {
        setCurrentChatSettings(prevSettings => ({
          ...prevSettings,
          systemInstruction: newSystemInstruction,
          isCodeExecutionEnabled: shouldEnableCode ? true : prevSettings.isCodeExecutionEnabled
        }));
      }
    }
    if (type === 'follow-up' && (isAutoSendOnSuggestionClick ?? true)) {
      handleSendMessage({ text });
    } else {
      setCommandedInput({ text: text + '\n', id: Date.now() });
      setTimeout(() => {
        const textarea = document.querySelector('textarea[aria-label="Chat message input"]') as HTMLTextAreaElement;
        if (textarea) textarea.focus();
      }, 0);
    }
  }, [currentChatSettings.systemInstruction, isAutoSendOnSuggestionClick, handleSendMessage, setCommandedInput, setAppSettings, activeSessionId, setCurrentChatSettings]);

  const handleSetThinkingLevel = useCallback((level: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH') => {
    setAppSettings(prev => ({ ...prev, thinkingLevel: level }));
    if (activeSessionId && setCurrentChatSettings) {
      setCurrentChatSettings(prev => ({ ...prev, thinkingLevel: level }));
    }
  }, [setAppSettings, activeSessionId, setCurrentChatSettings]);

  const { apiModels, isSwitchingModel } = chatState;

  const getCurrentModelDisplayName = useCallback(() => {
    const modelIdToDisplay = currentChatSettings.modelId || appSettings.modelId;
    if (isSwitchingModel) return t('appSwitchingModel');
    const model = apiModels.find(m => m.id === modelIdToDisplay);
    if (model) return model.name;
    if (modelIdToDisplay) {
      let n = modelIdToDisplay.split('/').pop()?.replace('gemini-', 'Gemini ') || modelIdToDisplay;
      return n.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').replace(' Preview ', ' Preview ');
    }
    return apiModels.length === 0 ? t('appNoModelsAvailable') : t('appNoModelSelected');
  }, [currentChatSettings.modelId, appSettings.modelId, isSwitchingModel, apiModels, t]);

  return {
    appSettings, setAppSettings, currentTheme, language, t,
    chatState, uiState, pipState, eventsState, dataManagement,
    sidePanelContent, handleOpenSidePanel, handleCloseSidePanel,
    isExportModalOpen, setIsExportModalOpen, exportStatus, handleExportChat,
    activeChat, sessionTitle,
    handleSaveSettings,
    handleLoadCanvasPromptAndSave,
    handleSuggestionClick,
    handleSetThinkingLevel,
    getCurrentModelDisplayName,
    activeSuggestionType,
  };
};
