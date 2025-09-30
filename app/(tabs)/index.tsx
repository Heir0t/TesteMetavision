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
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { requestPermissions as requestPermissionsFromService } from '@/services/permissions';
import { getSettings } from '@/services/settings';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/api/supabaseClient';

const NOTIFICATION_COOLDOWN = 10000; // 10 segundos

type BeaconMap = Record<string, string>;

export default function ScannerScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Device[]>([]);
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown as State);
  
  const [knownBeacons, setKnownBeacons] = useState<BeaconMap>({});
  const [isLoadingBeacons, setIsLoadingBeacons] = useState(true);


  const bleManagerRef = useRef<BleManager | null>(null);
  const isInitializedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const lastNotificationTimestamps = useRef<Record<string, number>>({});
  const isScanningRef = useRef(false);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  // Função para buscar os beacons do Supabase
  const fetchBeacons = useCallback(async () => {
    console.log('Buscando beacons do Supabase...');
    setIsLoadingBeacons(true);
    
    const { data, error } = await supabase
      .from('beacons')
      .select('name, message'); // <<< CORRIGIDO

    if (error) {
      console.error('Erro ao buscar beacons:', error);
      Alert.alert('Erro de Conexão', 'Não foi possível carregar os dados dos beacons. Verifique sua internet.');
      setKnownBeacons({});
    } else if (data) {
      const beaconMap = data.reduce((acc: BeaconMap, beacon) => {
        acc[beacon.name] = beacon.message; // <<< CORRIGIDO
        return acc;
      }, {});
      setKnownBeacons(beaconMap);
      console.log('Beacons carregados com sucesso:', beaconMap);
    }
    setIsLoadingBeacons(false);
  }, []);

  // Busca os beacons quando o componente é montado pela primeira vez
  useEffect(() => {
    fetchBeacons();
  }, [fetchBeacons]);

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

      subscriptionRef.current = bleManagerRef.current.onStateChange((newState: State) => {
        console.log('Estado do Bluetooth mudou para:', newState);
        if (isMountedRef.current) {
          setBluetoothState(newState);
          if (newState !== State.PoweredOn) {
            console.log('Bluetooth não está PoweredOn: parando scan...');
            try {
              if (bleManagerRef.current && isScanningRef.current) {
                bleManagerRef.current.stopDeviceScan();
              }
            } catch (err) {
              console.log('Erro ao parar scan quando bluetooth mudou:', err);
            }
            if (isMountedRef.current) {
              setIsScanning(false);
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
      try { subscriptionRef.current.remove(); } catch (e) { console.log('Erro removendo subscrição:', e); }
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

  const triggerHapticFeedback = async () => {
    if (Platform.OS === 'web') return;
    try {
      const settings = await getSettings();
      if (settings.vibrationEnabled) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Erro no feedback háptico:', error);
    }
  };

  const handleDeviceDetected = async (device: Device) => {
    if (!isMountedRef.current) return;

    const deviceName = device.name || device.localName;
    if (!deviceName) return;
    
    const message = knownBeacons[deviceName];
    if (!message) return;

    const now = Date.now();
    const lastNotified = lastNotificationTimestamps.current[deviceName] || 0;

    if (now - lastNotified > NOTIFICATION_COOLDOWN) {
      console.log(`Notificando sobre: ${deviceName}`);
      lastNotificationTimestamps.current[deviceName] = now;

      await triggerHapticFeedback();
      await speakMessage(message);
    }

    setNearbyDevices(prev => {
      const exists = prev.find(d => d.id === device.id);
      return exists ? prev : [...prev.slice(-9), device];
    });
  };

  const startScanning = async () => {
    console.log('Tentando iniciar escaneamento...');
    if (isScanningRef.current) {
      console.log('Scan já está ativo.');
      return;
    }

    try {
      const hasPermissions = await requestPermissionsFromService();
      if (!hasPermissions) {
        Alert.alert('Erro', 'Permissões de Bluetooth são necessárias.');
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
      lastNotificationTimestamps.current = {};

      await triggerHapticFeedback();
      await speakMessage('Iniciando escaneamento de beacons. Caminhe com segurança.');

      bleManagerRef.current!.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
        if (error) {
          console.error('Erro no scan:', error);
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
    console.log('Parando escaneamento...');
    if (!bleManagerRef.current) return;

    try {
      bleManagerRef.current.stopDeviceScan();
      console.log('Scan parado com sucesso.');
    } catch (error) {
      console.error('Erro ao parar scan:', error);
    }

    if (isMountedRef.current) {
      setIsScanning(false);
    }

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
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});