import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  AppState,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { requestPermissions as requestPermissionsFromService } from '@/services/permissions';
import { getSettings } from '@/services/settings';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/api/supabaseClient';

const ACTIVE_BEACON_TIMEOUT = 60000;
const RSSI_THRESHOLD = -75;
const SMOOTHING_FACTOR = 4;

type BeaconMap = Record<string, string>;

export default function ScannerScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Device[]>([]);
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown as State);
  const [knownBeacons, setKnownBeacons] = useState<BeaconMap>({});
  const [isLoadingBeacons, setIsLoadingBeacons] = useState(true);
  const [closestBeaconRssi, setClosestBeaconRssi] = useState<number | null>(null);

  const bleManagerRef = useRef<BleManager | null>(null);
  const isInitializedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isScanningRef = useRef(false);
  const notifiedBeaconsRef = useRef<Set<string>>(new Set());
  const rssiHistoryRef = useRef<Record<string, number[]>>({});
  const vibrationIntervalRef = useRef<NodeJS.Timeout | number | null>(null);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  const fetchBeacons = useCallback(async () => {
    setIsLoadingBeacons(true);
    const { data, error } = await supabase.from('beacons').select('name, message');
    if (error) {
      console.error('Erro ao buscar beacons:', error);
      Alert.alert('Erro de Conexão', 'Não foi possível carregar os dados dos beacons.');
      setKnownBeacons({});
    } else if (data) {
      const beaconMap = data.reduce((acc: BeaconMap, beacon) => {
        acc[beacon.name] = beacon.message;
        return acc;
      }, {});
      setKnownBeacons(beaconMap);
    }
    setIsLoadingBeacons(false);
  }, []);

  useEffect(() => {
    fetchBeacons();
  }, [fetchBeacons]);

  const initializeBleManager = useCallback(async () => {
    if (isInitializedRef.current && bleManagerRef.current) {
      return true;
    }
    try {
      if (bleManagerRef.current) {
        bleManagerRef.current.destroy();
      }
      bleManagerRef.current = new BleManager();
      subscriptionRef.current = bleManagerRef.current.onStateChange((newState: State) => {
        if (isMountedRef.current) {
          setBluetoothState(newState);
          if (newState !== State.PoweredOn) {
            if (bleManagerRef.current && isScanningRef.current) {
              bleManagerRef.current.stopDeviceScan();
            }
            if (isMountedRef.current) {
              setIsScanning(false);
              setNearbyDevices([]);
            }
          }
        }
      }, true);
      isInitializedRef.current = true;
      return true;
    } catch (error) {
      console.error('Erro ao inicializar BleManager:', error);
      isInitializedRef.current = false;
      bleManagerRef.current = null;
      return false;
    }
  }, []);

  const cleanupBleManager = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
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
      initializeBleManager();
      return () => { };
    }, [initializeBleManager])
  );

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && !isInitializedRef.current) {
        initializeBleManager();
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
      Speech.speak(message, {
        language: 'pt-BR',
        pitch: settings.speechPitch,
        rate: settings.speechRate,
      });
    } catch (error) {
      console.error('Erro ao reproduzir fala:', error);
    }
  };

  const triggerHapticFeedback = async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS === 'web') return;
    try {
      const settings = await getSettings();
      if (settings.vibrationEnabled) {
        await Haptics.impactAsync(style);
      }
    } catch (error) {
      console.error('Erro no feedback háptico:', error);
    }
  };
  
  const stopProximityVibration = useCallback(() => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    Vibration.cancel();
  }, []);

  const startProximityVibration = useCallback((rssi: number) => {
    stopProximityVibration();

    const proximity = 100 + rssi;
    const interval = Math.max(150, 800 - proximity * 10);
    const vibrationDuration = 100;

    vibrationIntervalRef.current = setInterval(() => {
      Vibration.vibrate(vibrationDuration);
    }, interval);
  }, [stopProximityVibration]);

  useEffect(() => {
    if (isScanning && closestBeaconRssi !== null) {
      startProximityVibration(closestBeaconRssi);
    } else {
      stopProximityVibration();
    }
    return () => {
      stopProximityVibration();
    };
  }, [isScanning, closestBeaconRssi, startProximityVibration, stopProximityVibration]);

  const handleDeviceDetected = async (device: Device) => {
    if (!isMountedRef.current || !isScanningRef.current) return;

    const deviceName = device.name || device.localName;
    if (!deviceName || device.rssi == null) return;

    const message = knownBeacons[deviceName];
    if (message) {
      const history = rssiHistoryRef.current[deviceName] || [];
      history.push(device.rssi);
      if (history.length > SMOOTHING_FACTOR) history.shift();
      rssiHistoryRef.current[deviceName] = history;

      if (history.length >= SMOOTHING_FACTOR) {
        const currentRssi = history[history.length - 1];
        const previousRssiAvg = history.slice(0, -1).reduce((acc, val) => acc + val, 0) / (history.length - 1);
        const isApproaching = currentRssi > previousRssiAvg;
        const isCloseEnough = currentRssi > RSSI_THRESHOLD;

        if (isCloseEnough && isApproaching && !notifiedBeaconsRef.current.has(deviceName)) {
          notifiedBeaconsRef.current.add(deviceName);
          await triggerHapticFeedback(Haptics.ImpactFeedbackStyle.Heavy);
          await speakMessage(message);
          setTimeout(() => {
            if (isMountedRef.current) {
              notifiedBeaconsRef.current.delete(deviceName);
            }
          }, ACTIVE_BEACON_TIMEOUT);
        }
      }
    }

    setNearbyDevices(prev => {
      const existingDeviceIndex = prev.findIndex(d => d.id === device.id);
      let newDevices;

      if (existingDeviceIndex > -1) {
        newDevices = [...prev];
        newDevices[existingDeviceIndex] = device;
      } else {
        newDevices = [...prev, device].slice(-10);
      }

      const closestDevice = newDevices
        .filter(d => d.name && knownBeacons[d.name] && d.rssi != null)
        .sort((a, b) => b.rssi! - a.rssi!)[0];

      if (closestDevice && closestDevice.rssi) {
        setClosestBeaconRssi(closestDevice.rssi);
      } else {
        setClosestBeaconRssi(null);
      }
      return newDevices;
    });
  };

  const startScanning = async () => {
    if (isScanningRef.current) {
      return;
    }

    try {
      const hasPermissions = await requestPermissionsFromService();
      if (!hasPermissions) {
        // O alerta já é mostrado dentro do serviço de permissões
        return;
      }

      const currentBluetoothState = await bleManagerRef.current?.state();
      if (currentBluetoothState !== State.PoweredOn) {
        Alert.alert('Erro', `Bluetooth precisa estar ligado. Estado atual: ${currentBluetoothState || bluetoothState}`);
        return;
      }

      if (!bleManagerRef.current) {
        const initialized = await initializeBleManager();
        if (!initialized) {
          Alert.alert('Erro', 'Não foi possível inicializar o Bluetooth.');
          return;
        }
      }

      setIsScanning(true);
      setNearbyDevices([]);
      notifiedBeaconsRef.current.clear();
      rssiHistoryRef.current = {};

      await triggerHapticFeedback(Haptics.ImpactFeedbackStyle.Medium);
      await speakMessage('Iniciando escaneamento. Caminhe com segurança.');

      bleManagerRef.current!.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (error) {
          if (error.message.includes('cancelled')) return;
          Alert.alert('Erro no scan', error.message ?? String(error));
          stopScanning();
          return;
        }
        if (device) {
          handleDeviceDetected(device);
        }
      });
    } catch (error) {
      console.error('Erro ao iniciar escaneamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao iniciar o escaneamento.');
      setIsScanning(false);
    }
  };

  const stopScanning = useCallback(async () => {
    if (!bleManagerRef.current) return;
    try {
      bleManagerRef.current.stopDeviceScan();
    } catch (error) {
      console.error('Erro ao parar scan:', error);
    }

    if (isMountedRef.current) {
      setIsScanning(false);
      setClosestBeaconRssi(null);
    }

    await triggerHapticFeedback(Haptics.ImpactFeedbackStyle.Medium);
    await speakMessage('Escaneamento interrompido.');
  }, []);

  const toggleScanning = () => {
    if (isScanningRef.current) {
      stopScanning();
    } else {
      startScanning();
    }
  };

  const getInstructionText = () => {
    if (isScanning) {
      return 'Escaneamento ativo. Caminhe pelo ambiente...';
    }
    if (isLoadingBeacons) {
      return 'Carregando dados dos beacons...';
    }
    if (bluetoothState !== State.PoweredOn) {
      return `Bluetooth: ${bluetoothState}`;
    }
    return 'Clique no botão para iniciar o escaneamento';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Bem-vindo!</Text>
        <Text style={styles.instructionText}>
          {getInstructionText()}
        </Text>
      </View>

      <View style={styles.mainContent}>
        <TouchableOpacity
          style={[
            styles.scanButton,
            isScanning && styles.scanButtonActive,
            (bluetoothState !== State.PoweredOn || isLoadingBeacons) && styles.scanButtonDisabled,
          ]}
          onPress={toggleScanning}
          disabled={bluetoothState !== State.PoweredOn || isLoadingBeacons}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isScanning ? 'Parar escaneamento' : 'Iniciar escaneamento'}
          accessibilityHint={isScanning ? 'Toque para parar o escaneamento de beacons' : 'Toque para iniciar o escaneamento de beacons'}
        >
          {isLoadingBeacons ? (
            <ActivityIndicator size="large" color="#ffffff" />
          ) : (
            <Text style={styles.scanButtonText}>{isScanning ? 'Parar' : 'Iniciar'}</Text>
          )}
        </TouchableOpacity>

        {isScanning && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Procurando...</Text>
            <Text style={styles.deviceCount}>{nearbyDevices.length} dispositivo(s) na lista</Text>
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
  },
});