import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  NativeModules,
  StyleSheet,
  Alert,
  Linking,
  FlatList,
} from 'react-native';
import Slider from '@react-native-community/slider';
import CookieManager from '@react-native-cookies/cookies';
import { Camera } from 'react-native-vision-camera';
import { StorageService } from '../utils/storage';
import { saveSecurePin, hasSecurePin, clearSecurePin } from '../utils/secureStorage';
import CertificateModuleTyped, { CertificateInfo } from '../utils/CertificateModule';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

const { KioskModule } = NativeModules;

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface SettingsScreenProps {
  navigation: SettingsScreenNavigationProp;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [url, setUrl] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [isPinConfigured, setIsPinConfigured] = useState<boolean>(false);
  const [autoReload, setAutoReload] = useState<boolean>(false);
  const [kioskEnabled, setKioskEnabled] = useState<boolean>(false);
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState<boolean>(false);
  const [screensaverEnabled, setScreensaverEnabled] = useState<boolean>(false);
  const [inactivityDelay, setInactivityDelay] = useState<string>('10');
  const [motionEnabled, setMotionEnabled] = useState<boolean>(false);
  const [screensaverBrightness, setScreensaverBrightness] = useState<number>(0);
  const [defaultBrightness, setDefaultBrightness] = useState<number>(0.5);
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);

  useEffect(() => {
    loadSettings();
    loadCertificates();
  }, []);

  const loadSettings = async (): Promise<void> => {
    const savedUrl = await StorageService.getUrl();
    const savedAutoReload = await StorageService.getAutoReload();
    const savedKioskEnabled = await StorageService.getKioskEnabled();
    const savedAutoLaunch = await StorageService.getAutoLaunch();
    const savedScreensaverEnabled = await StorageService.getScreensaverEnabled();
    const savedDefaultBrightness = await StorageService.getDefaultBrightness();

    // New screensaver architecture
    const savedInactivityDelay = await StorageService.getScreensaverInactivityDelay();
    const savedMotionEnabled = await StorageService.getScreensaverMotionEnabled();
    const savedScreensaverBrightness = await StorageService.getScreensaverBrightness();

    // Check if a secure PIN is already configured
    const hasPinConfigured = await hasSecurePin();
    setIsPinConfigured(hasPinConfigured);

    if (savedUrl) setUrl(savedUrl);
    if (hasPinConfigured) {
      setPin('');
    }

    setAutoReload(savedAutoReload);
    setKioskEnabled(savedKioskEnabled);
    setAutoLaunchEnabled(savedAutoLaunch ?? false);
    setScreensaverEnabled(savedScreensaverEnabled ?? false);
    setDefaultBrightness(savedDefaultBrightness ?? 0.5);

    setMotionEnabled(savedMotionEnabled ?? false);
    setScreensaverBrightness(savedScreensaverBrightness ?? 0);

    if (savedInactivityDelay && !isNaN(savedInactivityDelay)) {
      setInactivityDelay(String(Math.floor(savedInactivityDelay / 60000)));
    } else {
      setInactivityDelay('10');
    }
  };

  const loadCertificates = async (): Promise<void> => {
    try {
      const certs = await CertificateModuleTyped.getAcceptedCertificates();
      setCertificates(certs);
    } catch (error) {
      console.log('Error loading certificates:', error);
    }
  };

  const toggleAutoLaunch = async (value: boolean) => {
    setAutoLaunchEnabled(value);
    await StorageService.saveAutoLaunch(value);
    try {
      if (value) {
        await KioskModule.enableAutoLaunch();
      } else {
        await KioskModule.disableAutoLaunch();
      }
    } catch (error) {
      Alert.alert('Error', `Failed to update auto launch: ${error}`);
    }
  };


  const toggleMotionDetection = async (value: boolean) => {
    if (value) {
      const permission = await Camera.requestCameraPermission();
      if (permission === 'denied') {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required for motion detection.\n\nPlease enable camera permission in device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
      if (permission === 'granted') {
        setMotionEnabled(true);
      }
    } else {
      setMotionEnabled(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!url) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    // Trim whitespace
    let finalUrl = url.trim();
    const urlLower = finalUrl.toLowerCase();

    // Security: Block dangerous URL schemes
    if (urlLower.startsWith('file://')) {
      Alert.alert('Security Error', 'File URLs are not allowed for security reasons.\n\nPlease use http:// or https:// URLs only.');
      return;
    }
    if (urlLower.startsWith('javascript:')) {
      Alert.alert('Security Error', 'JavaScript URLs are not allowed for security reasons.\n\nPlease use http:// or https:// URLs only.');
      return;
    }
    if (urlLower.startsWith('data:')) {
      Alert.alert('Security Error', 'Data URLs are not allowed for security reasons.\n\nPlease use http:// or https:// URLs only.');
      return;
    }

    // Auto-add https:// if no protocol specified
    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
      // Check if it looks like a valid domain (contains at least one dot)
      if (finalUrl.includes('.')) {
        finalUrl = 'https://' + finalUrl;
        console.log('[Settings] Auto-added https:// to URL:', finalUrl);

        // Update the input field to show the complete URL
        setUrl(finalUrl);

        Alert.alert(
          'URL Updated',
          `Added https:// to your URL:\n\n${finalUrl}\n\nClick Save again to confirm.`,
          [{ text: 'OK' }]
        );
        return;
      } else {
        Alert.alert('Invalid URL', 'Please enter a valid URL (e.g., example.com or https://example.com)');
        return;
      }
    }

    // Only validate PIN if user entered a new one
    if (pin && pin.length > 0) {
      if (pin.length < 4) {
        Alert.alert('Error', 'PIN code must contain at least 4 digits');
        return;
      }
    } else if (!isPinConfigured) {
      // No PIN configured yet and user didn't enter one
      Alert.alert('Error', 'Please enter a PIN code');
      return;
    }

    // Validate inactivity delay
    const inactivityDelayNumber = parseInt(inactivityDelay, 10);
    if (isNaN(inactivityDelayNumber) || inactivityDelayNumber <= 0) {
      Alert.alert('Error', 'Please enter a valid positive number for inactivity delay');
      return;
    }

    await StorageService.saveUrl(finalUrl);

    // Save PIN only if user entered a new one
    if (pin && pin.length >= 4) {
      await saveSecurePin(pin);
      await StorageService.savePin('');
      setIsPinConfigured(true);
    }

    await StorageService.saveAutoReload(autoReload);
    await StorageService.saveKioskEnabled(kioskEnabled);
    await StorageService.saveAutoLaunch(autoLaunchEnabled);
    await StorageService.saveScreensaverEnabled(screensaverEnabled);
    await StorageService.saveDefaultBrightness(defaultBrightness);

    // Save new screensaver architecture (inactivity is always enabled)
    await StorageService.saveScreensaverInactivityEnabled(true);
    await StorageService.saveScreensaverInactivityDelay(inactivityDelayNumber * 60000);
    await StorageService.saveScreensaverMotionEnabled(motionEnabled);
    await StorageService.saveScreensaverBrightness(screensaverBrightness);

    if (kioskEnabled) {
      try {
        await KioskModule.startLockTask();
        Alert.alert('Success', 'Configuration saved\nScreen pinning enabled - swipe gestures blocked', [
          { text: 'OK', onPress: () => navigation.navigate('Kiosk') },
        ]);
      } catch (error) {
        Alert.alert('Warning', 'Configuration saved\nDevice Owner not configured - screen pinning unavailable', [
          { text: 'OK', onPress: () => navigation.navigate('Kiosk') },
        ]);
      }
    } else {
      try {
        await KioskModule.stopLockTask();
      } catch (error) {
        console.log('Not in lock task mode');
      }
      Alert.alert('Success', 'Configuration saved\nScreen pinning disabled - swipe up to exit', [
        { text: 'OK', onPress: () => navigation.navigate('Kiosk') },
      ]);
    }
  };

  const handleResetSettings = async (): Promise<void> => {
    Alert.alert(
      'Reset Settings',
      'This will erase all settings (URL, PIN, preferences, SSL certificates, and cookies) and restart the app with default values.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all storage including secure PIN
              await StorageService.clearAll();
              await CertificateModuleTyped.clearAcceptedCertificates();
              await clearSecurePin(); // Clear PIN from Android Keystore

              // Clear all cookies
              await CookieManager.clearAll();

              setUrl('');
              setPin('');
              setIsPinConfigured(false);
              setAutoReload(false);
              setKioskEnabled(false);
              setAutoLaunchEnabled(false);
              setScreensaverEnabled(false);
              setInactivityDelay('10');
              setMotionEnabled(false);
              setScreensaverBrightness(0);
              setDefaultBrightness(0.5);
              setCertificates([]);

              try {
                await KioskModule.stopLockTask();
              } catch {
                // ignore
              }

              Alert.alert('Success', 'Settings reset successfully!\nPIN and all data cleared.\n\nPlease configure the app again.', [
                { text: 'OK', onPress: () => navigation.navigate('Kiosk') },
              ]);
            } catch (error) {
              Alert.alert('Error', `Failed to reset settings: ${error}`);
            }
          },
        },
      ],
    );
  };

  const handleExitKioskMode = async (): Promise<void> => {
    Alert.alert(
      'Exit Kiosk Mode',
      'Are you sure you want to exit kiosk mode?\n\nThis will close the application and disable the lock.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await KioskModule.exitKioskMode();
              if (!result) {
                Alert.alert('Info', 'Kiosk mode disabled');
              }
            } catch (error) {
              Alert.alert('Error', `Unable to exit: ${error}`);
            }
          },
        },
      ],
    );
  };

  const handleRemoveCertificate = async (fingerprint: string, url: string): Promise<void> => {
    Alert.alert(
      'Remove Certificate',
      `Remove accepted certificate for:\n\n${url}\n\nFingerprint: ${fingerprint.substring(0, 16)}...\n\nYou will be asked again next time you visit this site.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await CertificateModuleTyped.removeCertificate(fingerprint);
              await loadCertificates(); // Reload list
              Alert.alert('Success', 'Certificate removed successfully');
            } catch (error) {
              Alert.alert('Error', `Failed to remove certificate: ${error}`);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <Text style={styles.title}>⚙️ Kiosk Configuration</Text>

        {/* Vos sections existantes... */}
        <View style={styles.section}>
          <Text style={styles.label}>🌐 URL to Display</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com"
            keyboardType="url"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>Example: https://www.freekiosk.app</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>🔐 PIN Code</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPin}
            placeholder={isPinConfigured ? "••••" : "1234"}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
          />
          <Text style={styles.hint}>
            {isPinConfigured
              ? "✓ PIN configured - Leave empty to keep current PIN, or enter a new one to change it"
              : "Minimum 4 digits (default: 1234)"}
          </Text>
        </View>

        {/* NOUVELLE SECTION : Luminosité par défaut */}
        <View style={styles.section}>
          <Text style={styles.label}>💡 Default Brightness</Text>
          <Text style={styles.hint}>Set the default screen brightness level (0% - 100%)</Text>
          <View style={{ marginTop: 15 }}>
            <Text style={styles.brightnessValue}>{Math.round(defaultBrightness * 100)}%</Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={defaultBrightness}
              onValueChange={setDefaultBrightness}
              minimumTrackTintColor="#0066cc"
              maximumTrackTintColor="#ddd"
              thumbTintColor="#0066cc"
            />
          </View>
        </View>

        {/* Vos autres sections existantes (Auto Launch, Pin App, etc.) */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>🚀 Auto Launch</Text>
              <Text style={styles.hint}>Enable or disable automatic launch on device startup</Text>
            </View>
            <Switch
              value={autoLaunchEnabled}
              onValueChange={toggleAutoLaunch}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={autoLaunchEnabled ? '#0066cc' : '#f4f3f4'}
            />
          </View>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ For non-Device Owner devices, please enable the "Appear on top" permission in the system settings.
            </Text>
            <Text style={styles.hint}>This permission is only necessary for the auto launch feature to work.</Text>
            <TouchableOpacity style={styles.saveButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.saveButtonText}>📲 Open Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>📌 Pin App to Screen</Text>
              <Text style={styles.hint}>
                Lock app in kiosk mode (requires Device Owner)
                {'\n'}
                When ON: Swipe gestures blocked, need PIN to exit
                {'\n'}
                When OFF: Swipe up to exit normally
              </Text>
            </View>
            <Switch
              value={kioskEnabled}
              onValueChange={setKioskEnabled}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={kioskEnabled ? '#0066cc' : '#f4f3f4'}
            />
          </View>
          {!kioskEnabled && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>⚠️ Warning: With screen pinning disabled, users can swipe up to exit the app</Text>
            </View>
          )}
          {kioskEnabled && (
            <View style={styles.infoSubBox}>
              <Text style={styles.infoSubText}>ℹ️ Screen pinning enabled: Only 5-tap gesture + PIN code allows exit</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>🔄 Automatic Reload</Text>
              <Text style={styles.hint}>Automatically reload the page on error</Text>
            </View>
            <Switch
              value={autoReload}
              onValueChange={setAutoReload}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={autoReload ? '#0066cc' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Screensaver Settings - Unified Section */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>🛌 Screensaver</Text>
              <Text style={styles.hint}>Enable or disable screensaver activation</Text>
            </View>
            <Switch
              value={screensaverEnabled}
              onValueChange={setScreensaverEnabled}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={screensaverEnabled ? '#0066cc' : '#f4f3f4'}
            />
          </View>

          {screensaverEnabled && (
            <>
              {/* Screensaver Brightness */}
              <View style={{ marginTop: 20 }}>
                <Text style={styles.label}>💡 Screensaver Brightness</Text>
                <Text style={styles.hint}>Screen brightness when screensaver is active</Text>

                {/* Brightness Presets */}
                <View style={{ flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.presetButton, screensaverBrightness === 0 && styles.presetButtonActive]}
                    onPress={() => setScreensaverBrightness(0)}
                  >
                    <Text style={[styles.presetButtonText, screensaverBrightness === 0 && styles.presetButtonTextActive]}>
                      Black Screen
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetButton, screensaverBrightness === 0.05 && styles.presetButtonActive]}
                    onPress={() => setScreensaverBrightness(0.05)}
                  >
                    <Text style={[styles.presetButtonText, screensaverBrightness === 0.05 && styles.presetButtonTextActive]}>
                      Dim 5%
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.presetButton, screensaverBrightness === 0.1 && styles.presetButtonActive]}
                    onPress={() => setScreensaverBrightness(0.1)}
                  >
                    <Text style={[styles.presetButtonText, screensaverBrightness === 0.1 && styles.presetButtonTextActive]}>
                      Dim 10%
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Brightness Slider */}
                <View style={{ marginTop: 15 }}>
                  <Text style={styles.brightnessValue}>{Math.round(screensaverBrightness * 100)}%</Text>
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={0}
                    maximumValue={1}
                    step={0.01}
                    value={screensaverBrightness}
                    onValueChange={setScreensaverBrightness}
                    minimumTrackTintColor="#0066cc"
                    maximumTrackTintColor="#ddd"
                    thumbTintColor="#0066cc"
                  />
                </View>
              </View>

              {/* Inactivity Delay */}
              <View style={{ marginTop: 20 }}>
                <Text style={styles.label}>⏳ Inactivity Delay</Text>
                <Text style={styles.hint}>Time before screensaver activates (in minutes)</Text>
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={styles.input}
                    value={inactivityDelay}
                    onChangeText={(text) => {
                      if (/^\d*$/.test(text)) {
                        setInactivityDelay(text);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={3}
                    placeholder="10"
                  />
                </View>
              </View>

              {/* Motion Detection - BASIC TEST */}
              <View style={{ marginTop: 20 }}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>📷 Motion Detection (TEST)</Text>
                    <Text style={styles.hint}>Wake screensaver when motion detected</Text>
                  </View>
                  <Switch
                    value={motionEnabled}
                    onValueChange={toggleMotionDetection}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={motionEnabled ? '#0066cc' : '#f4f3f4'}
                  />
                </View>
                {motionEnabled && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      ⚠️ BETA Feature: Motion detection is experimental
                    </Text>
                  </View>
                )}
              </View>

            </>
          )}
        </View>

        {/* NOUVELLE SECTION : Certificats SSL acceptés */}
        <View style={styles.section}>
          <Text style={styles.label}>🔒 Accepted SSL Certificates</Text>
          <Text style={styles.hint}>
            Self-signed certificates you've accepted. They expire after 1 year.
          </Text>

          {certificates.length === 0 ? (
            <View style={styles.emptyCertsBox}>
              <Text style={styles.emptyCertsText}>No certificates accepted yet</Text>
            </View>
          ) : (
            <View style={{ marginTop: 15 }}>
              {certificates.map((cert) => (
                <View key={cert.fingerprint} style={styles.certItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.certUrl} numberOfLines={1}>
                      {cert.url}
                    </Text>
                    <Text style={styles.certFingerprint} numberOfLines={1}>
                      {cert.fingerprint.substring(0, 24)}...
                    </Text>
                    <Text style={[styles.certExpiry, cert.isExpired && styles.certExpired]}>
                      {cert.isExpired ? '⚠️ Expired: ' : 'Expires: '}
                      {cert.expiryDate}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.certDeleteButton}
                    onPress={() => handleRemoveCertificate(cert.fingerprint, cert.url)}
                  >
                    <Text style={styles.certDeleteText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>💾 Save</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.navigate('Kiosk')}>
          <Text style={styles.cancelButtonText}>↩️ Back to Kiosk</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={handleResetSettings}>
          <Text style={styles.resetButtonText}>🔄 Reset All Settings</Text>
        </TouchableOpacity>

        {kioskEnabled && (
          <TouchableOpacity style={styles.exitButton} onPress={handleExitKioskMode}>
            <Text style={styles.exitButtonText}>🚪 Exit Kiosk Mode</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ How to Use</Text>
          <Text style={styles.infoText}>
            • Configure the URL of the web page to display{'\n'}
            • Set a secure PIN code{'\n'}
            • Enable "Pin App to Screen" for full kiosk mode{'\n'}
            • Tap 5 times in the bottom-right corner to access settings{'\n'}
            • Enter PIN code to unlock
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    marginTop: 20,
    color: '#333',
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    lineHeight: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brightnessValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066cc',
    textAlign: 'center',
    marginBottom: 10,
  },
  warningBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
  infoSubBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  infoSubText: {
    fontSize: 13,
    color: '#01579b',
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
    shadowColor: '#0066cc',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#f57c00',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  exitButton: {
    backgroundColor: '#d32f2f',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#b71c1c',
  },
  exitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066cc',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  emptyCertsBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyCertsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0066cc',
  },
  certUrl: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  certFingerprint: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  certExpiry: {
    fontSize: 12,
    color: '#0066cc',
  },
  certExpired: {
    color: '#d32f2f',
    fontWeight: '600',
  },
  certDeleteButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  certDeleteText: {
    fontSize: 24,
  },
  presetButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  presetButtonActive: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  presetButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  presetButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SettingsScreen;
