import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDarkModeStore = defineStore('darkMode', () => {
  const isDark = ref(false);
  const fontSize = ref<'normal' | 'large' | 'xlarge'>('normal');

  function init() {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') {
      isDark.value = true;
    } else if (stored === null) {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    const storedFontSize = localStorage.getItem('fontSize');
    if (storedFontSize) {
      fontSize.value = storedFontSize as typeof fontSize.value;
    }

    applyDarkMode();
    applyFontSize();
  }

  function toggle() {
    isDark.value = !isDark.value;
    localStorage.setItem('darkMode', String(isDark.value));
    applyDarkMode();
  }

  function setFontSize(size: typeof fontSize.value) {
    fontSize.value = size;
    localStorage.setItem('fontSize', size);
    applyFontSize();
  }

  function applyDarkMode() {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function applyFontSize() {
    document.documentElement.classList.remove('text-base', 'text-lg', 'text-xl');
    switch (fontSize.value) {
      case 'large':
        document.documentElement.classList.add('text-lg');
        break;
      case 'xlarge':
        document.documentElement.classList.add('text-xl');
        break;
      default:
        document.documentElement.classList.add('text-base');
    }
  }

  init();

  return { isDark, fontSize, toggle, setFontSize };
});
