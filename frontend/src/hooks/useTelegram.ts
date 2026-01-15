import { useEffect, useState, useCallback, useRef } from 'react';
import { retrieveLaunchParams, postEvent } from '@telegram-apps/sdk';

interface ThemeParams {
  bgColor: string;
  textColor: string;
  hintColor: string;
  linkColor: string;
  buttonColor: string;
  buttonTextColor: string;
  secondaryBgColor: string;
}

interface UseTelegramReturn {
  isReady: boolean;
  initData: string | null;
  userId: number | null;
  themeParams: ThemeParams;
  showBackButton: (onClick: () => void) => void;
  hideBackButton: () => void;
  showMainButton: (text: string, onClick: () => void) => void;
  hideMainButton: () => void;
  setMainButtonLoading: (loading: boolean) => void;
  expand: () => void;
}

const DEFAULT_THEME: ThemeParams = {
  bgColor: '#ffffff',
  textColor: '#000000',
  hintColor: '#999999',
  linkColor: '#2481cc',
  buttonColor: '#2481cc',
  buttonTextColor: '#ffffff',
  secondaryBgColor: '#f0f0f0',
};

export function useTelegram(): UseTelegramReturn {
  const [isReady, setIsReady] = useState(false);
  const [initData, setInitData] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeParams>(DEFAULT_THEME);

  const backButtonCallbackRef = useRef<(() => void) | null>(null);
  const mainButtonCallbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const initTelegram = () => {
      try {
        const launchParams = retrieveLaunchParams();

        // Get init data
        if (launchParams.initDataRaw) {
          setInitData(launchParams.initDataRaw);
        }

        // Get user ID
        if (launchParams.initData?.user?.id) {
          setUserId(launchParams.initData.user.id);
        }

        // Get theme params
        if (launchParams.themeParams) {
          const tp = launchParams.themeParams;
          setTheme({
            bgColor: tp.bgColor || DEFAULT_THEME.bgColor,
            textColor: tp.textColor || DEFAULT_THEME.textColor,
            hintColor: tp.hintColor || DEFAULT_THEME.hintColor,
            linkColor: tp.linkColor || DEFAULT_THEME.linkColor,
            buttonColor: tp.buttonColor || DEFAULT_THEME.buttonColor,
            buttonTextColor: tp.buttonTextColor || DEFAULT_THEME.buttonTextColor,
            secondaryBgColor: tp.secondaryBgColor || DEFAULT_THEME.secondaryBgColor,
          });
        }

        // Expand viewport
        try {
          postEvent('web_app_expand');
        } catch {
          // Ignore if not in Telegram
        }

        // Signal ready
        try {
          postEvent('web_app_ready');
        } catch {
          // Ignore if not in Telegram
        }

        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize Telegram SDK:', error);
        // Still set ready for development outside Telegram
        setIsReady(true);
      }
    };

    initTelegram();

    // Handle back button clicks
    const handleBackButton = () => {
      if (backButtonCallbackRef.current) {
        backButtonCallbackRef.current();
      }
    };

    // Handle main button clicks
    const handleMainButton = () => {
      if (mainButtonCallbackRef.current) {
        mainButtonCallbackRef.current();
      }
    };

    // Listen for Telegram events
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.eventType === 'back_button_pressed') {
        handleBackButton();
      } else if (event.data?.eventType === 'main_button_pressed') {
        handleMainButton();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const showBackButton = useCallback((onClick: () => void) => {
    backButtonCallbackRef.current = onClick;
    try {
      postEvent('web_app_setup_back_button', { is_visible: true });
    } catch {
      // Ignore if not in Telegram
    }
  }, []);

  const hideBackButton = useCallback(() => {
    backButtonCallbackRef.current = null;
    try {
      postEvent('web_app_setup_back_button', { is_visible: false });
    } catch {
      // Ignore if not in Telegram
    }
  }, []);

  const showMainButton = useCallback((text: string, onClick: () => void) => {
    mainButtonCallbackRef.current = onClick;
    try {
      postEvent('web_app_setup_main_button', {
        is_visible: true,
        text,
        color: theme.buttonColor,
        text_color: theme.buttonTextColor,
      });
    } catch {
      // Ignore if not in Telegram
    }
  }, [theme.buttonColor, theme.buttonTextColor]);

  const hideMainButton = useCallback(() => {
    mainButtonCallbackRef.current = null;
    try {
      postEvent('web_app_setup_main_button', { is_visible: false });
    } catch {
      // Ignore if not in Telegram
    }
  }, []);

  const setMainButtonLoading = useCallback((loading: boolean) => {
    try {
      postEvent('web_app_setup_main_button', { is_progress_visible: loading });
    } catch {
      // Ignore if not in Telegram
    }
  }, []);

  const expand = useCallback(() => {
    try {
      postEvent('web_app_expand');
    } catch {
      // Ignore if not in Telegram
    }
  }, []);

  return {
    isReady,
    initData,
    userId,
    themeParams: theme,
    showBackButton,
    hideBackButton,
    showMainButton,
    hideMainButton,
    setMainButtonLoading,
    expand,
  };
}
