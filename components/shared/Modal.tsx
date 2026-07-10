
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useWindowContext } from '../../contexts/WindowContext';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalIsolationState {
  stack: string[];
  originalInert: Map<HTMLElement, boolean>;
  observer?: MutationObserver;
}

const isolationByDocument = new WeakMap<Document, ModalIsolationState>();
let nextModalId = 0;

const getFocusableElements = (container: HTMLElement): HTMLElement[] => (
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(element => (
    !element.hidden
    && !element.closest('[inert]')
    && element.getAttribute('aria-hidden') !== 'true'
    && element.getClientRects().length > 0
  ))
);

const syncDocumentIsolation = (targetDocument: Document, state: ModalIsolationState) => {
  const topModalId = state.stack[state.stack.length - 1];
  const bodyChildren = Array.from(targetDocument.body.children).filter(
    (element): element is HTMLElement => element instanceof targetDocument.defaultView!.HTMLElement
  );
  const topModal = bodyChildren.find(element => element.dataset.modalRoot === topModalId);

  for (const element of bodyChildren) {
    if (!state.originalInert.has(element)) {
      state.originalInert.set(element, element.inert);
    }

    const isLiveRegion = element.dataset.liveRegionRoot === 'true';
    element.inert = !isLiveRegion && element !== topModal;
  }
};

const registerModal = (targetDocument: Document, modalId: string) => {
  const state = isolationByDocument.get(targetDocument) ?? {
    stack: [],
    originalInert: new Map<HTMLElement, boolean>(),
  };

  if (!state.observer && targetDocument.defaultView) {
    state.observer = new targetDocument.defaultView.MutationObserver(() => {
      syncDocumentIsolation(targetDocument, state);
    });
    state.observer.observe(targetDocument.body, { childList: true });
  }

  state.stack = state.stack.filter(id => id !== modalId);
  state.stack.push(modalId);
  isolationByDocument.set(targetDocument, state);
  syncDocumentIsolation(targetDocument, state);
};

const unregisterModal = (targetDocument: Document, modalId: string) => {
  const state = isolationByDocument.get(targetDocument);
  if (!state) return;

  state.stack = state.stack.filter(id => id !== modalId);
  if (state.stack.length > 0) {
    syncDocumentIsolation(targetDocument, state);
    return;
  }

  for (const [element, wasInert] of state.originalInert) {
    if (element.isConnected) element.inert = wasInert;
  }
  state.observer?.disconnect();
  isolationByDocument.delete(targetDocument);
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  contentClassName?: string;
  backdropClassName?: string;
  noPadding?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  contentClassName = '',
  backdropClassName = 'bg-black bg-opacity-60 backdrop-blur-sm',
  noPadding = false,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  initialFocusRef,
}) => {
  const [isActuallyOpen, setIsActuallyOpen] = useState(isOpen);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const modalIdRef = useRef('');
  if (!modalIdRef.current) modalIdRef.current = `modal-${++nextModalId}`;
  const isOpenRef = useRef(isOpen);
  const onCloseRef = useRef(onClose);
  const { document: targetDocument } = useWindowContext();

  useEffect(() => {
    isOpenRef.current = isOpen;
    onCloseRef.current = onClose;
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setIsActuallyOpen(true);
    } else {
      const timer = setTimeout(() => setIsActuallyOpen(false), 300); // Corresponds to modal-exit-animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isActuallyOpen) return;

    const modalId = modalIdRef.current;
    registerModal(targetDocument, modalId);
    return () => unregisterModal(targetDocument, modalId);
  }, [isActuallyOpen, targetDocument]);

  useEffect(() => {
    if (!isActuallyOpen) return;

    const previouslyFocused = targetDocument.activeElement instanceof targetDocument.defaultView!.HTMLElement
      ? targetDocument.activeElement
      : null;
    const targetWindow = targetDocument.defaultView;
    const focusFrame = targetWindow?.requestAnimationFrame(() => {
      const content = modalContentRef.current;
      if (!content) return;

      const initialFocus = initialFocusRef?.current
        ?? content.querySelector<HTMLElement>('[data-autofocus], [autofocus]')
        ?? getFocusableElements(content)[0]
        ?? content;
      initialFocus.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const content = modalContentRef.current;
      if (!content) return;

      if (event.key === 'Escape') {
        if (isOpenRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(content);
      if (focusableElements.length === 0) {
        event.preventDefault();
        content.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = targetDocument.activeElement;

      if (!content.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    targetDocument.addEventListener('keydown', handleKeyDown);
    return () => {
      targetDocument.removeEventListener('keydown', handleKeyDown);
      if (focusFrame !== undefined) targetWindow?.cancelAnimationFrame(focusFrame);
      targetWindow?.requestAnimationFrame(() => {
        if (previouslyFocused?.isConnected && !previouslyFocused.closest('[inert]')) {
          previouslyFocused.focus();
        }
      });
    };
  }, [initialFocusRef, isActuallyOpen, targetDocument]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the click is on the backdrop itself, not on any of its children
    if (e.target === e.currentTarget) {
        onClose();
    }
  };

  if (!isActuallyOpen) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[2100] flex items-center justify-center ${noPadding ? '' : 'p-2 sm:p-4'} ${backdropClassName}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      data-modal-root={modalIdRef.current}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalContentRef}
        tabIndex={-1}
        className={`${contentClassName} ${isOpen ? 'modal-enter-animation' : 'modal-exit-animation'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    targetDocument.body
  );
};
