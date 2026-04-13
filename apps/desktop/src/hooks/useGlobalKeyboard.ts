import { useEffect } from 'react';
import { useUiStore } from '../stores/uiStore';

export function useGlobalKeyboard() {
  const toggleLeftSidebar = useUiStore((s) => s.toggleLeftSidebar);
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel);
  const setActiveRightTab = useUiStore((s) => s.setActiveRightTab);
  const openSettings = useUiStore((s) => s.openSettings);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+, opens settings even when focused in input
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault();
        openSettings();
        return;
      }

      // Ignore when focus is inside an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            toggleLeftSidebar();
            break;
          case 'j':
            e.preventDefault();
            toggleRightPanel();
            break;
          case 'l':
            e.preventDefault();
            // Show right panel if hidden, switch to chat tab, focus chat input
            if (!useUiStore.getState().rightPanelVisible) {
              useUiStore.getState().toggleRightPanel();
            }
            setActiveRightTab('chat');
            // Give React time to mount the chat panel before focusing
            setTimeout(() => {
              window.dispatchEvent(new Event('pyide:focus-chat-input'));
            }, 50);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLeftSidebar, toggleRightPanel, setActiveRightTab, openSettings]);
}
