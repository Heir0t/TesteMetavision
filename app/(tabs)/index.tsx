import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  AppState,
  PermissionsAndroid,
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestPermissions as requestPermissionsFromService } from '@/services/permissions';
import { getSettings } from '@/services/settings';
import { useFocusEffect } from '@react-navigation/native';

export default function ScannerScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Device[]>([]);
  const [lastNotifiedDevice, setLastNotifiedDevice] = useState<string>('');
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown as State);

  const bleManagerRef = useRef<BleManager | null>(null);
  const isInitializedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Refs to avoid stale closures inside callbacks
  const isScanningRef = useRef(false);
  const lastNotifiedRef = useRef('');

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    lastNotifiedRef.current = lastNotifiedDevice;
  }, [lastNotifiedDevice]);

  const initializeBleManager = useCallback(async () => {
    if (isInitializedRef.current && bleManagerRef.current) {
      return true;
    }

    try {
      console.log('Inicializando BleManager...');

      if (bleManagerRef.current) {
        try {
          bleManagerRef.current.destroy();
        } catch (error) {
          console.log('Erro ao destruir instância anterior:', error);
        }
      }

      bleManagerRef.current = new BleManager();

      // Aguardar um pouco para garantir que o manager está pronto
      await new Promise(resolve => setTimeout(resolve, 100));

      const state = await bleManagerRef.current.state();
      console.log('Estado inicial do Bluetooth:', state);

      if (isMountedRef.current) {
        setBluetoothState(state as State);
      }

      // remover subscrição anterior (se houver)
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.remove();
        } catch (e) {
          console.log('Erro ao remover subscrição antiga:', e);
        }
        subscriptionRef.current = null;
      }

      // Monitorar mudanças no estado do Bluetooth
      subscriptionRef.current = bleManagerRef.current.onStateChange((newState: State) => {
        console.log('Estado do Bluetooth mudou para:', newState);
        if (isMountedRef.current) {
          setBluetoothState(newState);

          // Se bluetooth deixou de estar ligado, pare imediatamente o scan localmente
          if (newState !== State.PoweredOn) {
            console.log('Bluetooth não está PoweredOn: limpando scan/estado local...');
            try {
              if (bleManagerRef.current && isScanningRef.current) {
                bleManagerRef.current.stopDeviceScan();
              }
            } catch (err) {
              console.log('Erro ao parar scan quando bluetooth mudou:', err);
            }

            if (isMountedRef.current) {
              setIsScanning(false);
              setLastNotifiedDevice('');
              setNearbyDevices([]);
            }
          }
        }
      }, true);

      isInitializedRef.current = true;
      console.log('BleManager inicializado com sucesso');
      return true;

    } catch (error) {
      console.error('Erro ao inicializar BleManager:', error);
      isInitializedRef.current = false;
      bleManagerRef.current = null;
      return false;
    }
  }, []);

  const cleanupBleManager = useCallback(() => {
    console.log('Fazendo cleanup do BleManager...');

    if (subscriptionRef.current) {
      try { subscriptionRef.current.remove(); } catch(e){ console.log('Erro removendo subscrição:', e); }
      subscriptionRef.current = null;
    }

    if (bleManagerRef.current) {
      try {
        if (isScanningRef.current) {
          bleManagerRef.current.stopDeviceScan();
        }
        bleManagerRef.current.destroy();
      } catch (error) {
        console.error('Erro durante cleanup:', error);
      }
    }

    bleManagerRef.current = null;
    isInitializedRef.current = false;

    if (isMountedRef.current) {
      setIsScanning(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('Tela ganhou foco');
      initializeBleManager();

      return () => {
        console.log('Tela perdeu foco (não paramos scan automaticamente)');
      };
    }, [initializeBleManager])
  );

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('AppState mudou para:', nextAppState);

      if (nextAppState === 'active') {
        if (!isInitializedRef.current) {
          initializeBleManager();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [initializeBleManager]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupBleManager();
    };
  }, [cleanupBleManager]);

  const speakMessage = async (message: string) => {
    try {
      const settings = await getSettings();
      const speechOptions = {
        language: 'pt-BR',
        pitch: settings.speechPitch,
        rate: settings.speechRate,
      };
      Speech.speak(message, speechOptions);
    } catch (error) {
      console.error('Erro ao reproduzir fala:', error);
    }
  };

  const triggerHapticFeedback = async () => {
    if (Platform.OS !== 'web') {
      try {
        const settings = await getSettings();
        if (settings.vibrationEnabled) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (error) {
        console.error('Erro no feedback háptico:', error);
      }
    }
  };

  const handleDeviceDetected = async (device: Device) => {
    if (!isMountedRef.current) return;
    const deviceName = device.name || device.localName;
    if (!deviceName) return;

    const knownBeaconsMap: Record<string, string> = {
      'Beacon-1': 'Você está no estande do Metavision',
      'Beacon-Escada': 'Atenção: escada detectada à frente.',
      'Beacon-Banco': 'Banco disponível à frente.',
      'Beacon-Spotify': 'Spotify, seu aplicativo de música',
    };

    const message = knownBeaconsMap[deviceName];
    if (!message) return;

    console.log('Beacon conhecido detectado:', deviceName, 'RSSI:', device.rssi);

    // Se for Beacon-1, checar UUID
    if (deviceName == 'Beacon-1') {
      const expectedUUID = '12345678912345678912345678912345';
      const deviceUUIDs = device.serviceUUIDs || [];
      const hasCorrectUUID = deviceUUIDs.some(uuid => uuid.toLowerCase() === expectedUUID.toLowerCase());
      if (!hasCorrectUUID) {
        console.log('UUID não confere para Beacon-1, ignorando...', deviceUUIDs);
        return;
      }
      console.log('UUID verificado com sucesso para Beacon-1');
    }

    const deviceIdentifier = deviceName;

    // Usar ref para evitar problemas de closure/stale
    if (lastNotifiedRef.current !== deviceIdentifier) {
      lastNotifiedRef.current = deviceIdentifier;
      setLastNotifiedDevice(deviceIdentifier);

      await triggerHapticFeedback();
      await speakMessage(message);

      // Limpar notificação após 10s (usando functional updater para estado)
      const id = deviceIdentifier;
      setTimeout(() => {
        setLastNotifiedDevice(prev => (prev === id ? '' : prev));
        if (lastNotifiedRef.current === id) lastNotifiedRef.current = '';
      }, 10000);
    }

    setNearbyDevices(prev => {
      const exists = prev.find(d => d.id === device.id);
      if (!exists) {
        return [...prev.slice(-9), device];
      }
      return prev;
    });
  };

  const startScanning = async () => {
    console.log('Iniciando escaneamento...');

    if (isScanningRef.current) return;

    try {
      const hasPermissions = await requestPermissionsFromService();
      if (!hasPermissions) {
        Alert.alert('Erro', 'Permissões de Bluetooth são necessárias');
        return;
      }

      if (bluetoothState !== State.PoweredOn) {
        Alert.alert('Erro', 'Bluetooth precisa estar ligado');
        return;
      }

      if (!bleManagerRef.current) {
        const initialized = await initializeBleManager();
        if (!initialized) {
          Alert.alert('Erro', 'Não foi possível inicializar o Bluetooth');
          return;
        }
      }

      setIsScanning(true);
      setNearbyDevices([]);
      setLastNotifiedDevice('');

      await triggerHapticFeedback();
      await speakMessage('Iniciando escaneamento de beacons. Caminhe com segurança.');

      // startDeviceScan NÃO é uma Promise, portanto NÃO devemos usar await aqui.
      // Tratar erros dentro do callback
      try {
        bleManagerRef.current!.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
          if (error) {
            console.error('Erro no scan:', error);
            Alert.alert('Erro no scan', error?.message ?? String(error));
            // parar scan localmente
            try { bleManagerRef.current?.stopDeviceScan(); } catch(e) { console.log('Erro ao parar scan após erro:', e); }
            setIsScanning(false);
            return;
          }

          if (device) {
            handleDeviceDetected(device);
          }
        });
      } catch (err) {
        console.error('Erro iniciando startDeviceScan:', err);
        Alert.alert('Erro', 'Não foi possível iniciar o escaneamento');
        setIsScanning(false);
      }

    } catch (error) {
      console.error('Erro ao iniciar escaneamento:', error);
      setIsScanning(false);
      Alert.alert('Erro', 'Não foi possível iniciar o escaneamento');
    }
  };

  const stopScanning = useCallback(async () => {
    console.log('Parando escaneamento...');

    if (!isScanningRef.current) return;

    try {
      if (bleManagerRef.current) {
        try { bleManagerRef.current.stopDeviceScan(); } catch(e) { console.log('Erro ao parar scan:', e); }
      }
    } catch (error) {
      console.error('Erro ao parar scan:', error);
    }

    setIsScanning(false);
    setLastNotifiedDevice('');
    setNearbyDevices([]);

    await triggerHapticFeedback();
    await speakMessage('Escaneamento interrompido.');
  }, []);

  const toggleScanning = () => {
    if (isScanningRef.current) {
      stopScanning();
    } else {
      startScanning();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Bem-vindo!</Text>
        <Text style={styles.instructionText}>
          {isScanning
            ? 'Escaneamento ativo. Procurando por Beacon-1...'
            : bluetoothState === State.PoweredOn
              ? 'Clique no botão para iniciar o escaneamento'
              : `Bluetooth: ${bluetoothState}`}
        </Text>
      </View>

      <View style={styles.mainContent}>
        <TouchableOpacity
          style={[
            styles.scanButton,
            isScanning && styles.scanButtonActive,
            bluetoothState !== State.PoweredOn && styles.scanButtonDisabled,
          ]}
          onPress={toggleScanning}
          disabled={bluetoothState !== State.PoweredOn}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isScanning ? 'Parar escaneamento' : 'Iniciar escaneamento'}
          accessibilityHint={isScanning ? 'Toque para parar o escaneamento de beacons' : 'Toque para iniciar o escaneamento de beacons'}
        >
          <Text style={styles.scanButtonText}>{isScanning ? 'Parar' : 'Iniciar'}</Text>
        </TouchableOpacity>

        {isScanning && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Procurando...</Text>
            <Text style={styles.deviceCount}>{nearbyDevices.length} dispositivo(s) encontrado(s)</Text>
          </View>
        )}

        {bluetoothState !== State.PoweredOn && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>Bluetooth desabilitado ou indisponível</Text>
            <Text style={styles.warningSubtext}>Estado atual: {String(bluetoothState)}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Mantenha o aplicativo aberto durante o uso</Text>



      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 80,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanButtonActive: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  scanButtonDisabled: {
    backgroundColor: '#666',
    shadowColor: '#666',
  },
  scanButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statusContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  deviceCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  warningContainer: {
    marginTop: 40,
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  warningText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  warningSubtext: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

/*
  Example services/permissions.ts (put this in your project and adapt as needed)

  import { Platform, PermissionsAndroid } from 'react-native';

  export async function requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const perms = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];
        const granted = await PermissionsAndroid.requestMultiple(perms);
        return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
      }

      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    // iOS: make sure Info.plist has the required keys; runtime grant usually not needed
    return true;
  }

  Also make sure AndroidManifest.xml and Info.plist include the permissions described in the chat.
*/