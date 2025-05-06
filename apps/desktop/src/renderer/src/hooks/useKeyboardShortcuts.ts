import { useEffect } from "react";

type KeyboardShortcutConfig = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key === shortcut.key;
        const metaKeyMatch = shortcut.metaKey ? e.metaKey : true;
        const ctrlKeyMatch = shortcut.ctrlKey ? e.ctrlKey : true;
        const altKeyMatch = shortcut.altKey ? e.altKey : true;
        const shiftKeyMatch = shortcut.shiftKey ? e.shiftKey : true;

        if (keyMatch && metaKeyMatch && ctrlKeyMatch && altKeyMatch && shiftKeyMatch) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts]);
}
