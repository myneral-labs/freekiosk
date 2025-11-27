import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import RNBrightness from 'react-native-brightness-newarch';
import WebViewComponent from '../components/WebViewComponent';
import MotionDetector from '../components/MotionDetector';
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
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const [defaultBrightness, setDefaultBrightness] = useState<number>(0.5);
  const [screensaverBrightness, setScreensaverBrightness] = useState<number>(0);
  const [inactivityEnabled, setInactivityEnabled] = useState(true);
  const [inactivityDelay, setInactivityDelay] = useState(600000);
  const [motionEnabled, setMotionEnabled] = useState(false);
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
          console.log(`[DEBUG Brightness] Luminosité normale appliquée: ${Math.round(defaultBrightness * 100)}%`);
        } catch (error) {
          console.error('[DEBUG Brightness] Erreur application luminosité:', error);
        }
      })();
    } else {
      console.log('[DEBUG Brightness] Screensaver active, skipping brightness restore');
    }
  }, [defaultBrightness, isScreensaverActive]);

  useEffect(() => {
    if (isScreensaverActive) {
      enableScreensaverEffects();
    }
  }, [isScreensaverActive, screensaverBrightness]);

  useEffect(() => {
    if (screensaverEnabled && inactivityEnabled) {
      resetTimer();
    } else {
      clearTimer();
      setIsScreensaverActive(false);
    }
  }, [screensaverEnabled, inactivityEnabled, inactivityDelay]);


  const loadSettings = async (): Promise<void> => {
    try {
      const savedUrl = await StorageService.getUrl();
      const savedAutoReload = await StorageService.getAutoReload();
      const savedKioskEnabled = await StorageService.getKioskEnabled();
      const savedScreensaverEnabled = await StorageService.getScreensaverEnabled();
      const savedDefaultBrightness = await StorageService.getDefaultBrightness();
      const savedScreensaverBrightness = await StorageService.getScreensaverBrightness();
      const savedInactivityEnabled = await StorageService.getScreensaverInactivityEnabled();
      const savedInactivityDelay = await StorageService.getScreensaverInactivityDelay();
      const savedMotionEnabled = await StorageService.getScreensaverMotionEnabled();

      console.log('[DEBUG loadSettings] URL:', savedUrl);
      console.log('[DEBUG loadSettings] Screensaver enabled:', savedScreensaverEnabled);
      console.log('[DEBUG loadSettings] Default brightness:', savedDefaultBrightness);
      console.log('[DEBUG loadSettings] Screensaver brightness:', savedScreensaverBrightness);
      console.log('[DEBUG loadSettings] Inactivity enabled:', savedInactivityEnabled);
      console.log('[DEBUG loadSettings] Inactivity delay (ms):', savedInactivityDelay);
      console.log('[DEBUG loadSettings] Motion enabled:', savedMotionEnabled);

      if (savedUrl) setUrl(savedUrl);
      setAutoReload(savedAutoReload);
      setScreensaverEnabled(savedScreensaverEnabled ?? false);
      setDefaultBrightness(savedDefaultBrightness ?? 0.5);
      setScreensaverBrightness(savedScreensaverBrightness ?? 0);
      setInactivityEnabled(savedInactivityEnabled ?? true);
      setInactivityDelay(savedInactivityDelay ?? 600000);
      setMotionEnabled(savedMotionEnabled ?? false);

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
    if (screensaverEnabled && inactivityEnabled) {
      timerRef.current = setTimeout(() => {
        setIsScreensaverActive(true);
      }, inactivityDelay);
      console.log('[DEBUG] Inactivity timer reset');
    }
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      console.log('[DEBUG] Inactivity timer cleared');
    }
  };

  const onUserInteraction = () => {
    console.log('[DEBUG] User interaction detected, resetting timer');
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

  const onMotionDetected = () => {
    console.log('[DEBUG MOTION] Motion detected!');
    if (isScreensaverActive) {
      console.log('[DEBUG MOTION] Waking up screensaver and resetting timer');
      setIsScreensaverActive(false);
      resetTimer(); // IMPORTANT: Reset timer after waking up
    } else {
      console.log('[DEBUG MOTION] Screensaver not active, ignoring');
    }
  };

  const enableScreensaverEffects = async () => {
    try {
      await RNBrightness.setBrightnessLevel(screensaverBrightness);
      console.log(`Screensaver activé : luminosité à ${Math.round(screensaverBrightness * 100)}%`);
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

      {/* Motion Detector - Only active when screensaver is ON */}
      <MotionDetector
        enabled={motionEnabled && isScreensaverActive}
        onMotionDetected={onMotionDetected}
        sensitivity="medium"
      />

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
