import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  AppState,
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestPermissions } from '@/services/permissions';
import { getSettings } from '@/services/settings';
import { useFocusEffect } from '@react-navigation/native';

export default function ScannerScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Device[]>([]);
  const [lastNotifiedDevice, setLastNotifiedDevice] = useState<string>('');
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);

  const bleManagerRef = useRef<BleManager | null>(null);
  const isInitializedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Inicialização do BleManager
  const initializeBleManager = useCallback(async () => {
    if (isInitializedRef.current && bleManagerRef.current) {
      return true;
    }

    try {
      console.log('Inicializando BleManager...');

      // Limpar instância anterior se existir
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

      // Verificar estado do Bluetooth
      const state = await bleManagerRef.current.state();
      console.log('Estado inicial do Bluetooth:', state);

      if (isMountedRef.current) {
        setBluetoothState(state);
      }

      // Monitorar mudanças no estado do Bluetooth
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }

      subscriptionRef.current = bleManagerRef.current.onStateChange((newState) => {
        console.log('Estado do Bluetooth mudou para:', newState);
        if (isMountedRef.current) {
          setBluetoothState(newState);

          if (newState !== 'PoweredOn' && isScanning) {
            console.log('Bluetooth desligado, parando scan...');
            stopScanning();
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

  // Cleanup do BleManager
  const cleanupBleManager = useCallback(() => {
    console.log('Fazendo cleanup do BleManager...');

    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }

    if (bleManagerRef.current) {
      try {
        if (isScanning) {
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
  }, [isScanning]);

  // Hook para gerenciar foco da tela
  useFocusEffect(
    useCallback(() => {
      console.log('Tela ganhou foco');
      initializeBleManager();

      return () => {
        console.log('Tela perdeu foco');
        // Manter o scan ativo mesmo quando a tela perde foco
        // Apenas log para debug
      };
    }, [initializeBleManager])
  );

  // Monitorar estado do app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('AppState mudou para:', nextAppState);

      // Remover a parada automática do scan quando o app vai para background
      // O scan pode continuar em background se as permissões permitirem
      if (nextAppState === 'active') {
        // Quando o app volta ao foreground, verificar se precisa reinicializar
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

  // Cleanup final
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

    if (!device.name && !device.localName) return;

    // Verificar se é um beacon conhecido pelo MAC address
    const knownBeaconsMap: Record<string, string> = {
      'DA:A7:D3:B1:84:8F': 'Atenção: escada detectada à frente.',
      'FA:53:DB:B5:F1:97': 'Banco disponível à frente.',
      'D4:68:B2:17:F2:58': 'Spotfy, seu aplicativo de musica'
      // Adicione mais MACs e mensagens aqui
    };

    const handleDeviceDetected = async (device: Device) => {
      if (!isMountedRef.current) return;

      const mac = device.id.toUpperCase();
      const obstacleMessage = knownBeaconsMap[mac];

      if (!obstacleMessage) return; // Ignora dispositivos que não estão no mapa

      console.log('Dispositivo conhecido detectado:', mac, 'RSSI:', device.rssi);

      if (lastNotifiedDevice !== mac) {
        setLastNotifiedDevice(mac);

        await triggerHapticFeedback();
        await speakMessage(obstacleMessage);

        // Limpa a notificação após 10 segundos
        setTimeout(() => {
          if (lastNotifiedDevice === mac && isMountedRef.current) {
            setLastNotifiedDevice('');
          }
        }, 10000);
      }

      // Atualiza lista de dispositivos próximos
      setNearbyDevices(prev => {
        const exists = prev.find(d => d.id === device.id);
        if (!exists) {
          return [...prev.slice(-9), device]; // mantém só os 10 mais recentes
        }
        return prev;
      });
    };
  };
  const startScanning = async () => {
    console.log('Tentando iniciar scanning...');

    // Verificar se já está escaneando
    if (isScanning) {
      console.log('Já está escaneando');
      return;
    }

    try {
      // Verificar permissões
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          'Permissões Necessárias',
          'Este aplicativo precisa de permissão de localização para funcionar corretamente.',
        );
        return;
      }

      // Inicializar BleManager se necessário
      const initialized = await initializeBleManager();
      if (!initialized || !bleManagerRef.current) {
        Alert.alert('Erro', 'Não foi possível inicializar o Bluetooth.');
        return;
      }

      // Verificar estado do Bluetooth
      const state = await bleManagerRef.current.state();
      console.log('Estado do Bluetooth antes do scan:', state);

      if (state !== 'PoweredOn') {
        Alert.alert(
          'Bluetooth Desabilitado',
          'Por favor, habilite o Bluetooth para usar este aplicativo.',
        );
        return;
      }

      // Limpar dados anteriores
      setNearbyDevices([]);
      setLastNotifiedDevice('');

      // Feedback para o usuário
      await triggerHapticFeedback();
      await speakMessage('Iniciando escaneamento de beacons. Caminhe com segurança.');

      // Definir estado como escaneando ANTES de iniciar o scan
      setIsScanning(true);

      console.log('Iniciando scan BLE...');

      // Iniciar o scan com configurações otimizadas
      bleManagerRef.current.startDeviceScan(
        null, // UUIDs de serviços (null para todos)
        {
          allowDuplicates: true, // Permitir duplicatas para detectar movimento
          scanMode: 1, // Modo de scan balanceado
          callbackType: 1, // Callback para todos os matches
        },
        (error, device) => {
          if (error) {
            console.error('Erro no callback do scan:', error);

            // Se houve erro, parar o scanning
            if (isMountedRef.current) {
              setIsScanning(false);
              Alert.alert('Erro no Escaneamento', error.message || 'Erro desconhecido');
            }
            return;
          }

          if (device && isMountedRef.current) {
            handleDeviceDetected(device);
          }
        }
      );

      console.log('Scan iniciado com sucesso');

    } catch (error) {
      console.error('Erro ao iniciar escaneamento:', error);

      if (isMountedRef.current) {
        setIsScanning(false);
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : String(error);
        Alert.alert('Erro', `Não foi possível iniciar o escaneamento: ${errorMessage}`);
      }
    }
  };

  const stopScanning = useCallback(async () => {
    console.log('Parando scanning...');

    if (!isScanning) {
      console.log('Não está escaneando');
      return;
    }

    try {
      if (bleManagerRef.current && isInitializedRef.current) {
        bleManagerRef.current.stopDeviceScan();
        console.log('Scan parado');
      }

      if (isMountedRef.current) {
        setIsScanning(false);
        setLastNotifiedDevice('');

        await triggerHapticFeedback();
        await speakMessage('Escaneamento interrompido.');
      }

    } catch (error) {
      console.error('Erro ao parar escaneamento:', error);
      if (isMountedRef.current) {
        setIsScanning(false);
      }
    }
  }, [isScanning]);

  const toggleScanning = () => {
    if (isScanning) {
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
            ? 'Escaneamento ativo. Caminhe com segurança.'
            : bluetoothState === 'PoweredOn'
              ? 'Clique no botão para iniciar o escaneamento'
              : `Bluetooth: ${bluetoothState}`}
        </Text>
      </View>

      <View style={styles.mainContent}>
        <TouchableOpacity
          style={[
            styles.scanButton,
            isScanning && styles.scanButtonActive,
            bluetoothState !== 'PoweredOn' && styles.scanButtonDisabled
          ]}
          onPress={toggleScanning}
          disabled={bluetoothState !== 'PoweredOn'}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isScanning ? 'Parar escaneamento' : 'Iniciar escaneamento'}
          accessibilityHint={isScanning ? 'Toque para parar o escaneamento de beacons' : 'Toque para iniciar o escaneamento de beacons'}
        >
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Parar' : 'Iniciar'}
          </Text>
        </TouchableOpacity>

        {isScanning && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              🔍 Escaneando dispositivos próximos...
            </Text>
            <Text style={styles.deviceCount}>
              {nearbyDevices.length} dispositivo(s) encontrado(s)
            </Text>
          </View>
        )}

        {bluetoothState !== 'PoweredOn' && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              Bluetooth desabilitado ou indisponível
            </Text>
            <Text style={styles.warningSubtext}>
              Estado atual: {bluetoothState}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Mantenha o aplicativo aberto durante o uso
        </Text>
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