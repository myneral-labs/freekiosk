import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PinInput from '../components/PinInput';
import { StorageService } from '../utils/storage';
import { migrateOldPin, hasSecurePin } from '../utils/secureStorage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type PinScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Pin'>;

interface PinScreenProps {
  navigation: PinScreenNavigationProp;
}

const PinScreen: React.FC<PinScreenProps> = ({ navigation }) => {
  const [storedPin, setStoredPin] = useState<string>('1234');
  const [migrationDone, setMigrationDone] = useState<boolean>(false);

  useEffect(() => {
    migrateFromOldSystem();
  }, []);

  const migrateFromOldSystem = async (): Promise<void> => {
    try {
      // Check if already using secure storage
      const hasSecure = await hasSecurePin();

      if (!hasSecure) {
        // Migrate from old plaintext storage
        const oldPin = await StorageService.getPin();
        console.log('[PinScreen] Migrating from old PIN system...');
        await migrateOldPin(oldPin);

        // Clear old PIN from AsyncStorage for security
        if (oldPin && oldPin !== '1234') {
          await StorageService.savePin(''); // Clear old plaintext PIN
        }
      }

      setMigrationDone(true);
    } catch (error) {
      console.error('[PinScreen] Migration error:', error);
      setMigrationDone(true); // Continue anyway
    }
  };

  const handleSuccess = (): void => {
    navigation.navigate('Settings');
  };

  // Wait for migration before showing PIN input
  if (!migrationDone) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <PinInput onSuccess={handleSuccess} storedPin={storedPin} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default PinScreen;
