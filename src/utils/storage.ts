import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  URL: '@kiosk_url',
  PIN: '@kiosk_pin',
  AUTO_RELOAD: '@kiosk_auto_reload',
  KIOSK_ENABLED: '@kiosk_enabled',
  AUTO_LAUNCH: '@kiosk_auto_launch',
  SCREENSAVER_ENABLED: '@screensaver_enabled',
  SCREENSAVER_DELAY: '@screensaver_delay',
  DEFAULT_BRIGHTNESS: '@default_brightness'
};

export const StorageService = {
  //URL
  saveUrl: async (url: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.URL, url);
    } catch (error) {
      console.error('Error saving URL:', error);
    }
  },

  getUrl: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(KEYS.URL);
    } catch (error) {
      console.error('Error getting URL:', error);
      return null;
    }
  },

  //PIN
  savePin: async (pin: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.PIN, pin);
    } catch (error) {
      console.error('Error saving PIN:', error);
    }
  },

  getPin: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(KEYS.PIN);
    } catch (error) {
      console.error('Error getting PIN:', error);
      return null;
    }
  },

  //AUTORELOAD
  saveAutoReload: async (value: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.AUTO_RELOAD, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving auto reload:', error);
    }
  },

  getAutoReload: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(KEYS.AUTO_RELOAD);
      return value ? JSON.parse(value) : false;
    } catch (error) {
      console.error('Error getting auto reload:', error);
      return false;
    }
  },

  //KIOSKMODE
  saveKioskEnabled: async (value: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.KIOSK_ENABLED, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving kiosk enabled:', error);
    }
  },

  getKioskEnabled: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(KEYS.KIOSK_ENABLED);
      // Par défaut FALSE (kiosk activé si null)
      return value === null ? false : JSON.parse(value);
    } catch (error) {
      console.error('Error getting kiosk enabled:', error);
      return false; // Default OFF
    }
  },

  //AUTOLAUNCH
  saveAutoLaunch: async (value: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.AUTO_LAUNCH, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving auto launch:', error);
    }
  },

  getAutoLaunch: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(KEYS.AUTO_LAUNCH);
      return value ? JSON.parse(value) : false;
    } catch (error) {
      console.error('Error getting auto launch:', error);
      return false;
    }
  },

  //CLEAR ALL
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.URL,
        KEYS.PIN,
        KEYS.AUTO_RELOAD,
        KEYS.KIOSK_ENABLED,
        KEYS.AUTO_LAUNCH,
        KEYS.SCREENSAVER_DELAY,
        KEYS.SCREENSAVER_ENABLED,
        KEYS.DEFAULT_BRIGHTNESS,
      ]);
    } catch (error) {
      console.error('Error clearing all storage keys:', error);
    }
  },

  //SCREENSAVER
  saveScreensaverEnabled: async (value: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.SCREENSAVER_ENABLED, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving screensaver enabled:', error);
    }
  },

  getScreensaverEnabled: async (): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(KEYS.SCREENSAVER_ENABLED);
      // Par défaut FALSE si clé absente
      return value === null ? false : JSON.parse(value);
    } catch (error) {
      console.error('Error getting screensaver enabled:', error);
      return false;
    }
  },

  saveScreensaverDelay: async (value: number): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.SCREENSAVER_DELAY, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving screensaver delay:', error);
    }
  },

  getScreensaverDelay: async (): Promise<number> => {
    try {
      const value = await AsyncStorage.getItem(KEYS.SCREENSAVER_DELAY);
      // Par défaut 600000 ms (10 minutes) si clé absente
      return value === null ? 60000 : JSON.parse(value);
    } catch (error) {
      console.error('Error getting screensaver delay:', error);
      return 600000;
    }
  },

  //BRIGHTNESS
  saveDefaultBrightness: async (value: number): Promise<void> => {
    try {
      await AsyncStorage.setItem(KEYS.DEFAULT_BRIGHTNESS, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving default brightness:', error);
    }
  },

  getDefaultBrightness: async (): Promise<number> => {
    try {
      const value = await AsyncStorage.getItem(KEYS.DEFAULT_BRIGHTNESS);
      // Par défaut 1 (100%) si clé absente
      return value === null ? 1 : JSON.parse(value);
    } catch (error) {
      console.error('Error getting default brightness:', error);
      return 1;
    }
  },

};
