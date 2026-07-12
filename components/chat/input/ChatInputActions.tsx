
import React, { useState } from 'react';
import { ArrowUp, X, Edit2, Loader2, Mic, Languages, Maximize2, Minimize2, Save, AudioWaveform, PhoneOff, MoreHorizontal } from 'lucide-react';
import { AttachmentMenu } from './AttachmentMenu';
import { ToolsMenu } from './ToolsMenu';
import { IconStop, IconScenarios } from '../../icons/CustomIcons';
import { CHAT_INPUT_BUTTON_CLASS } from '../../../constants/appConstants';
import { ChatInputActionsProps } from '../../../types';

export interface ExtendedChatInputActionsProps extends ChatInputActionsProps {
    editMode?: 'update' | 'resend';
    isNativeAudioModel?: boolean;
    onStartLiveSession?: () => void;
    isLiveConnected?: boolean;
}

export const ChatInputActions: React.FC<ExtendedChatInputActionsProps> = ({
    onAttachmentAction,
    disabled,
    isGoogleSearchEnabled,
    onToggleGoogleSearch,
    isCodeExecutionEnabled,
    onToggleCodeExecution,
    isUrlContextEnabled,
    onToggleUrlContext,
    isDeepSearchEnabled,
    onToggleDeepSearch,
    onAddYouTubeVideo,
    onCountTokens,
    onRecordButtonClick,
    isRecording,
    isMicInitializing,
    isTranscribing,
    isLoading,
    onStopGenerating,
    isEditing,
    onCancelEdit,
    canSend,
    isWaitingForUpload,
    t,
    onCancelRecording,
    onTranslate,
    isTranslating,
    inputText,
    onToggleFullscreen,
    isFullscreen,
    editMode,
    isNativeAudioModel,
    onStartLiveSession,
    isLiveConnected,
    onOpenScenariosModal,
    onToggleCanvasPrompt,
    isCanvasPromptActive,
    onToggleAutoCanvas,
    isAutoCanvasEnabled
}) => {
    const micIconSize = 20;
    const sendIconSize = 20;
    const [isOverflowOpen, setIsOverflowOpen] = useState(false);

    return (
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
                <AttachmentMenu onAction={onAttachmentAction} disabled={disabled} t={t as any} />
                <ToolsMenu
                    isGoogleSearchEnabled={isGoogleSearchEnabled}
                    onToggleGoogleSearch={onToggleGoogleSearch}
                    isCodeExecutionEnabled={isCodeExecutionEnabled}
                    onToggleCodeExecution={onToggleCodeExecution}
                    isUrlContextEnabled={isUrlContextEnabled}
                    onToggleUrlContext={onToggleUrlContext}
                    isDeepSearchEnabled={isDeepSearchEnabled}
                    onToggleDeepSearch={onToggleDeepSearch}
                    onAddYouTubeVideo={onAddYouTubeVideo}
                    onCountTokens={onCountTokens}
                    disabled={disabled}
                    t={t as any}
                    onToggleCanvasPrompt={onToggleCanvasPrompt}
                    isCanvasPromptActive={isCanvasPromptActive}
                    onToggleAutoCanvas={onToggleAutoCanvas}
                    isAutoCanvasEnabled={isAutoCanvasEnabled}
                />
                {onOpenScenariosModal && (
                    <button
                        type="button"
                        onClick={onOpenScenariosModal}
                        disabled={disabled}
                        className={`${CHAT_INPUT_BUTTON_CLASS} hidden sm:flex bg-transparent text-[var(--theme-icon-settings)] hover:bg-[var(--theme-bg-tertiary)]`}
                        aria-label={t('scenariosManage_aria')}
                        title={t('scenariosManage_title')}
                    >
                        <IconScenarios size={20} />
                    </button>
                )}
                <div className="relative sm:hidden">
                    <button type="button" onClick={() => setIsOverflowOpen(open => !open)} className={`${CHAT_INPUT_BUTTON_CLASS} bg-transparent text-[var(--theme-icon-settings)] hover:bg-[var(--theme-bg-tertiary)]`} aria-haspopup="menu" aria-expanded={isOverflowOpen} aria-label={t('more_actions')} title={t('more_actions')}>
                        <MoreHorizontal size={20} />
                    </button>
                    {isOverflowOpen && (
                        <div role="menu" className="absolute bottom-12 left-0 z-50 min-w-52 rounded-xl border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)] p-1.5 shadow-xl">
                            {onOpenScenariosModal && <button role="menuitem" type="button" onClick={() => { setIsOverflowOpen(false); onOpenScenariosModal(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)]"><IconScenarios size={20} />{t('scenariosManage_title')}</button>}
                            <button role="menuitem" type="button" disabled={!inputText.trim() || isEditing || disabled || isTranslating} onClick={() => { setIsOverflowOpen(false); onTranslate(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)] disabled:opacity-50"><Languages size={20} />{t(isTranslating ? 'translating_button_title' : 'translate_button_title')}</button>
                            {onToggleFullscreen && <button role="menuitem" type="button" onClick={() => { setIsOverflowOpen(false); onToggleFullscreen(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-tertiary)]">{isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}{t(isFullscreen ? 'fullscreen_tooltip_collapse' : 'fullscreen_tooltip_expand')}</button>}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                {isRecording && (
                    <button
                        type="button"
                        onClick={onCancelRecording}
                        className="px-3 py-1.5 text-xs sm:text-sm bg-transparent hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)] rounded-md transition-colors"
                        aria-label={t('cancelRecording_aria')}
                        title={t('cancelRecording_aria')}
                    >
                        {t('cancel')}
                    </button>
                )}

                {onToggleFullscreen && (
                    <button
                        type="button"
                        onClick={onToggleFullscreen}
                        disabled={disabled}
                        className={`${CHAT_INPUT_BUTTON_CLASS} hidden sm:flex bg-transparent text-[var(--theme-icon-settings)] hover:bg-[var(--theme-bg-tertiary)]`}
                        aria-label={isFullscreen ? t('fullscreen_tooltip_collapse') : t('fullscreen_tooltip_expand')}
                        title={isFullscreen ? t('fullscreen_tooltip_collapse') : t('fullscreen_tooltip_expand')}
                    >
                        {isFullscreen ? <Minimize2 size={micIconSize} strokeWidth={2} /> : <Maximize2 size={micIconSize} strokeWidth={2} />}
                    </button>
                )}

                <button
                    type="button"
                    onClick={onTranslate}
                    disabled={!inputText.trim() || isEditing || disabled || isTranscribing || isMicInitializing || isTranslating}
                    className={`${CHAT_INPUT_BUTTON_CLASS} hidden sm:flex bg-transparent text-[var(--theme-icon-settings)] hover:bg-[var(--theme-bg-tertiary)]`}
                    aria-label={isTranslating ? t('translating_button_title') : t('translate_button_title')}
                    title={isTranslating ? t('translating_button_title') : t('translate_button_title')}
                >
                    {isTranslating ? (
                        <Loader2 size={micIconSize} className="animate-spin text-[var(--theme-text-link)]" strokeWidth={2} />
                    ) : (
                        <Languages size={micIconSize} strokeWidth={2} />
                    )}
                </button>

                {/* Live Session Button for Native Audio Model */}
                {isNativeAudioModel && onStartLiveSession && !isRecording && !isTranscribing && (
                    <button
                        type="button"
                        onClick={onStartLiveSession}
                        disabled={disabled}
                        className={`${CHAT_INPUT_BUTTON_CLASS} ${isLiveConnected ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 animate-pulse' : 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'}`}
                        aria-label={t(isLiveConnected ? 'live_session_end' : 'live_session_start')}
                        title={t(isLiveConnected ? 'live_session_end' : 'live_session_start')}
                    >
                        {isLiveConnected ? (
                            <PhoneOff size={micIconSize} strokeWidth={2} />
                        ) : (
                            <AudioWaveform size={micIconSize} strokeWidth={2} />
                        )}
                    </button>
                )}

                {/* Standard Record Button */}
                {!isLiveConnected && (
                    <button
                        type="button"
                        onClick={onRecordButtonClick}
                        disabled={disabled || isTranscribing || isMicInitializing}
                        className={`${CHAT_INPUT_BUTTON_CLASS} ${isRecording ? 'mic-recording-animate' : 'bg-transparent text-[var(--theme-icon-settings)] hover:bg-[var(--theme-bg-tertiary)]'}`}
                        aria-label={
                            isRecording ? t('voiceInput_stop_aria') :
                                isTranscribing ? t('voiceInput_transcribing_aria') :
                                    isMicInitializing ? t('mic_initializing') : t('voiceInput_start_aria')
                        }
                        title={
                            isRecording ? t('voiceInput_stop_aria') :
                                isTranscribing ? t('voiceInput_transcribing_aria') :
                                    isMicInitializing ? t('mic_initializing') : t('voiceInput_start_aria')
                        }
                    >
                        {isTranscribing || isMicInitializing ? (
                            <Loader2 size={micIconSize} className="animate-spin text-[var(--theme-text-link)]" strokeWidth={2} />
                        ) : (
                            <Mic size={micIconSize} strokeWidth={2} />
                        )}
                    </button>
                )}

                {isLoading ? (
                    <button type="button" onClick={onStopGenerating} className={`${CHAT_INPUT_BUTTON_CLASS} bg-[var(--theme-bg-danger)] hover:bg-[var(--theme-bg-danger-hover)] text-[var(--theme-icon-stop)]`} aria-label={t('stopGenerating_aria')} title={t('stopGenerating_title')}><IconStop size={12} /></button>
                ) : isEditing ? (
                    <>
                        <button type="button" onClick={onCancelEdit} className={`${CHAT_INPUT_BUTTON_CLASS} bg-transparent hover:bg-[var(--theme-bg-tertiary)] text-[var(--theme-icon-settings)]`} aria-label={t('cancelEdit_aria')} title={t('cancelEdit_title')}><X size={sendIconSize} strokeWidth={2} /></button>
                        <button type="submit" disabled={!canSend} className={`${CHAT_INPUT_BUTTON_CLASS} bg-amber-500 hover:bg-amber-600 text-white disabled:bg-[var(--theme-bg-tertiary)] disabled:text-[var(--theme-text-tertiary)]`} aria-label={t('updateMessage_aria')} title={t('updateMessage_title')}>
                            {editMode === 'update' ? <Save size={sendIconSize} strokeWidth={2} /> : <Edit2 size={sendIconSize} strokeWidth={2} />}
                        </button>
                    </>
                ) : (
                    <button
                        type="submit"
                        disabled={!canSend || isWaitingForUpload}
                        className={`${CHAT_INPUT_BUTTON_CLASS} bg-[var(--theme-bg-accent)] hover:bg-[var(--theme-bg-accent-hover)] text-[var(--theme-text-accent)] disabled:bg-[var(--theme-bg-tertiary)] disabled:text-[var(--theme-text-tertiary)]`}
                        aria-label={isWaitingForUpload ? t('upload_waiting') : t('sendMessage_aria')}
                        title={isWaitingForUpload ? t('upload_waiting_detail') : t('sendMessage_title')}
                    >
                        {isWaitingForUpload ? (
                            <Loader2 size={sendIconSize} className="animate-spin" strokeWidth={2} />
                        ) : (
                            <ArrowUp size={sendIconSize} strokeWidth={2} />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};
