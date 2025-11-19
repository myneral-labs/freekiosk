import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import RNBrightness from 'react-native-brightness-newarch';
import WebViewComponent from '../components/WebViewComponent';
import { StorageService } from '../utils/storage';
import KioskModule from '../utils/KioskModule';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type KioskScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Kiosk'>;

interface KioskScreenProps {
  navigation: KioskScreenNavigationProp;
}

let tapCount = 0;
let tapTimer: any = null;

const KioskScreen: React.FC<KioskScreenProps> = ({ navigation }) => {
  const [url, setUrl] = useState<string>('');
  const [autoReload, setAutoReload] = useState<boolean>(false);
  const [screensaverEnabled, setScreensaverEnabled] = useState(false);
  const [screensaverDelay, setScreensaverDelay] = useState(600000);
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [defaultBrightness, setDefaultBrightness] = useState<number>(1);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      loadSettings();
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      clearTimer();
      setIsScreensaverActive(false);
      // On ne restaure pas la luminosité volontairement
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation]);

  useEffect(() => {
    if (!isScreensaverActive) {
      (async () => {
        try {
          await RNBrightness.setBrightnessLevel(defaultBrightness);
          console.log(`Luminosité appliquée: ${Math.round(defaultBrightness * 100)}%`);
        } catch (error) {
          console.error('Erreur application luminosité:', error);
        }
      })();
    }
  }, [defaultBrightness, isScreensaverActive]);

  useEffect(() => {
    if (isScreensaverActive) {
      enableScreensaverEffects();
    }
  }, [isScreensaverActive]);

  useEffect(() => {
    if (screensaverEnabled) {
      resetTimer();
    } else {
      clearTimer();
      setIsScreensaverActive(false);
    }
  }, [screensaverEnabled, screensaverDelay]);

  const loadSettings = async (): Promise<void> => {
    try {
      const savedUrl = await StorageService.getUrl();
      const savedAutoReload = await StorageService.getAutoReload();
      const savedKioskEnabled = await StorageService.getKioskEnabled();
      const savedScreensaverEnabled = await StorageService.getScreensaverEnabled();
      const savedScreensaverDelay = await StorageService.getScreensaverDelay();
      const savedDefaultBrightness = await StorageService.getDefaultBrightness();

      if (savedUrl) setUrl(savedUrl);
      setAutoReload(savedAutoReload);
      setScreensaverEnabled(savedScreensaverEnabled ?? false);
      setScreensaverDelay(savedScreensaverDelay ?? 600000);
      setDefaultBrightness(savedDefaultBrightness ?? 1);

      if (savedKioskEnabled) {
        try {
          await KioskModule.startLockTask();
          console.log('[KioskScreen] Lock task enabled');
        } catch {
          console.log('[KioskScreen] Failed to start lock task');
        }
      } else {
        try {
          await KioskModule.stopLockTask();
          console.log('[KioskScreen] Lock task disabled');
        } catch {
          console.log('[KioskScreen] Not in lock task mode');
        }
      }
    } catch (error) {
      console.error('[KioskScreen] loadSettings error:', error);
    }
  };

  const resetTimer = () => {
    clearTimer();
    if (screensaverEnabled) {
      timerRef.current = setTimeout(() => {
        setIsScreensaverActive(true);
      }, screensaverDelay);
      console.log('[DEBUG] Timer reset');
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      console.log('[DEBUG] Timer cleared');
    }
  };

  // Cette fonction sera appelée par WebViewComponent à chaque interaction utilisateur détectée
  const onUserInteraction = () => {
    resetTimer();
    if (isScreensaverActive) {
      setIsScreensaverActive(false);
      console.log('[DEBUG] Screensaver deactivated by user interaction');
    }
  };

  const onScreensaverTap = () => {
    setIsScreensaverActive(false);
    resetTimer();
    console.log('[DEBUG] Screensaver deactivated by tap on overlay');
  };

  const enableScreensaverEffects = async () => {
    try {
      await RNBrightness.setBrightnessLevel(0);
      console.log('Screensaver activé : luminosité à 0');
    } catch (error) {
      console.error('Erreur activation luminosité screensaver:', error);
    }
  };

  const handleSecretTap = (): void => {
    tapCount++;
    if (tapTimer) clearTimeout(tapTimer);

    if (tapCount === 5) {
      tapCount = 0;
      clearTimer();
      setIsScreensaverActive(false);
      navigation.navigate('Pin');
      console.log('[DEBUG] Navigating to PIN screen');
    }

    tapTimer = setTimeout(() => {
      tapCount = 0;
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <WebViewComponent url={url} autoReload={autoReload} onUserInteraction={onUserInteraction} />

      <TouchableOpacity
        style={styles.secretButton}
        onPress={handleSecretTap}
        activeOpacity={1}
      />

      {isScreensaverActive && screensaverEnabled && (
        <TouchableOpacity
          style={styles.screensaverOverlay}
          activeOpacity={1}
          onPress={onScreensaverTap}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  secretButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
  },
  screensaverOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
    opacity: 1,
    zIndex: 1000,
  },
});

export default KioskScreen;
