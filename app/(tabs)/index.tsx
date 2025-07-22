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
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  // Inicialização segura do BleManager
  const initializeBleManager = useCallback(async () => {
    if (isInitializedRef.current || bleManagerRef.current) {
      return;
    }

    try {
      console.log('Inicializando BleManager...');
      bleManagerRef.current = new BleManager();
      isInitializedRef.current = true;
      
      // Verificar estado do Bluetooth
      const state = await bleManagerRef.current.state();
      setBluetoothState(state);
      
      // Monitorar mudanças no estado do Bluetooth
      subscriptionRef.current = bleManagerRef.current.onStateChange((state) => {
        console.log('Estado do Bluetooth mudou para:', state);
        setBluetoothState(state);
        
        if (state !== 'PoweredOn' && isScanning) {
          stopScanning();
        }
      }, true);
      
      console.log('BleManager inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar BleManager:', error);
      isInitializedRef.current = false;
      bleManagerRef.current = null;
    }
  }, [isScanning]);

  // Cleanup do BleManager
  const cleanupBleManager = useCallback(() => {
    console.log('Fazendo cleanup do BleManager...');
    
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    
    if (bleManagerRef.current && isInitializedRef.current) {
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
    setIsScanning(false);
  }, [isScanning]);

  // Hook para gerenciar foco da tela
  useFocusEffect(
    useCallback(() => {
      initializeBleManager();
      
      return () => {
        // Não fazer cleanup completo quando a tela perde foco
        // apenas parar o scan se estiver ativo
        if (isScanning && bleManagerRef.current) {
          try {
            bleManagerRef.current.stopDeviceScan();
            setIsScanning(false);
          } catch (error) {
            console.error('Erro ao parar scan no unfocus:', error);
          }
        }
      };
    }, [initializeBleManager, isScanning])
  );

  // Monitorar estado do app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('AppState mudou para:', nextAppState);
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (isScanning) {
          stopScanning();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [isScanning]);

  // Cleanup final
  useEffect(() => {
    return () => {
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (error) {
        console.error('Erro no feedback háptico:', error);
      }
    }
  };

  const handleDeviceDetected = async (device: Device) => {
    if (!device.name && !device.localName) return;
    
    // Verificar se é um beacon conhecido pelo MAC address
    const knownBeaconMACs = [
      '00:11:22:33:44:55', // Exemplo de MAC do beacon
      'AA:BB:CC:DD:EE:FF', // Outro exemplo
    ];
    
    const deviceInfo = `${device.name || device.localName} (${device.id})`;
    console.log('Dispositivo detectado:', deviceInfo);
    
    if (knownBeaconMACs.includes(device.id.toUpperCase())) {
      // Evitar notificações repetidas do mesmo dispositivo
      if (lastNotifiedDevice !== device.id) {
        setLastNotifiedDevice(device.id);
        
        // Determinar tipo de obstáculo baseado no nome do beacon
        let obstacleMessage = 'Obstáculo detectado à frente.';
        
        const deviceName = (device.name || device.localName || '').toLowerCase();
        if (deviceName.includes('escada')) {
          obstacleMessage = 'Atenção: escada detectada à frente.';
        } else if (deviceName.includes('poste')) {
          obstacleMessage = 'Atenção: poste detectado à frente.';
        } else if (deviceName.includes('banco')) {
          obstacleMessage = 'Banco disponível à frente.';
        } else if (deviceName.includes('entrada')) {
          obstacleMessage = 'Entrada detectada à frente.';
        }
        
        await triggerHapticFeedback();
        await speakMessage(obstacleMessage);
        
        // Limpar a notificação após 10 segundos para permitir nova detecção
        setTimeout(() => {
          if (lastNotifiedDevice === device.id) {
            setLastNotifiedDevice('');
          }
        }, 10000);
      }
    }
    
    setNearbyDevices(prev => {
      const exists = prev.find(d => d.id === device.id);
      if (!exists) {
        return [...prev.slice(-9), device]; // Manter apenas os 10 mais recentes
      }
      return prev;
    });
  };

  const startScanning = async () => {
    if (!bleManagerRef.current || !isInitializedRef.current) {
      console.log('BleManager não inicializado, tentando inicializar...');
      await initializeBleManager();
      
      if (!bleManagerRef.current) {
        Alert.alert('Erro', 'Não foi possível inicializar o Bluetooth.');
        return;
      }
    }
    
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          'Permissões Necessárias',
          'Este aplicativo precisa de permissão de localização para funcionar corretamente.',
        );
        return;
      }
      
      const state = await bleManagerRef.current.state();
      if (state !== 'PoweredOn') {
        Alert.alert(
          'Bluetooth Desabilitado',
          'Por favor, habilite o Bluetooth para usar este aplicativo.',
        );
        return;
      }
      
      setIsScanning(true);
      setNearbyDevices([]);
      
      await triggerHapticFeedback();
      await speakMessage('Iniciando escaneamento de beacons. Caminhe com segurança.');
      
      console.log('Iniciando scan...');
      
      bleManagerRef.current.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Erro no escaneamento:', error);
          setIsScanning(false);
          return;
        }
        
        if (device) {
          handleDeviceDetected(device);
        }
      });
      
    } catch (error) {
      console.error('Erro ao iniciar escaneamento:', error);
      setIsScanning(false);
      Alert.alert('Erro', 'Não foi possível iniciar o escaneamento.');
    }
  };

  const stopScanning = async () => {
    if (!bleManagerRef.current || !isInitializedRef.current) {
      setIsScanning(false);
      return;
    }
    
    try {
      console.log('Parando scan...');
      bleManagerRef.current.stopDeviceScan();
      setIsScanning(false);
      setLastNotifiedDevice('');
      
      await triggerHapticFeedback();
      await speakMessage('Escaneamento interrompido.');
      
    } catch (error) {
      console.error('Erro ao parar escaneamento:', error);
      setIsScanning(false);
    }
  };

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
              ⚠️ Bluetooth desabilitado ou indisponível
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