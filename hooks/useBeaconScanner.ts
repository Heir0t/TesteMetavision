// hooks/useBeaconScanner.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Alert,
  Platform,
  AppState,
  Vibration,
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { requestPermissions as requestPermissionsFromService } from '@/services/permissions';
import { getSettings } from '@/services/settings';
import { supabase } from '@/api/supabaseClient';

const ACTIVE_BEACON_TIMEOUT = 60000; // 60 segundos
const EMA_ALPHA = 0.4; // Fator de suavização para o sinal RSSI

// Constantes para cálculo de distância (calibre conforme seus beacons)
const TX_POWER_AT_1M = -59; // Potência de transmissão medida a 1 metro
const ENVIRONMENTAL_FACTOR = 2.0; // Fator ambiental (2.0 a 4.0)

type BeaconMap = Record<string, string>;

// Função para estimar a distância com base no RSSI
const calculateDistance = (rssi: number): number => {
  if (rssi === 0) {
    return -1.0;
  }
  const ratio = rssi * 1.0 / TX_POWER_AT_1M;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  } else {
    // Fórmula de log-distance path loss model
    const distance = Math.pow(10, (TX_POWER_AT_1M - rssi) / (10 * ENVIRONMENTAL_FACTOR));
    return distance;
  }
};

export const useBeaconScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);
  const [knownBeacons, setKnownBeacons] = useState<BeaconMap>({});
  const [isLoadingBeacons, setIsLoadingBeacons] = useState(true);
  const [closestBeaconRssi, setClosestBeaconRssi] = useState<number | null>(null);

  const bleManagerRef = useRef<BleManager | null>(null);
  const notifiedBeaconsRef = useRef<Set<string>>(new Set());
  const smoothedRssiRef = useRef<Record<string, number>>({});
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Busca os beacons conhecidos do Supabase
  const fetchBeacons = useCallback(async () => {
    setIsLoadingBeacons(true);
    const { data, error } = await supabase.from('beacons').select('name, message');
    if (error) {
      console.error('Erro ao buscar beacons:', error);
      Alert.alert('Erro de Conexão', 'Não foi possível carregar os dados dos beacons.');
    } else if (data) {
      const beaconMap = data.reduce((acc: BeaconMap, beacon) => {
        acc[beacon.name] = beacon.message;
        return acc;
      }, {});
      setKnownBeacons(beaconMap);
    }
    setIsLoadingBeacons(false);
  }, []);

  // Inicializa o BleManager e monitora o estado do Bluetooth
  useEffect(() => {
    fetchBeacons();

    // Garante que só existe uma instância do BleManager
    if (!bleManagerRef.current) {
        bleManagerRef.current = new BleManager();
    }
    const manager = bleManagerRef.current;

    const stateSubscription = manager.onStateChange((state) => {
      setBluetoothState(state);
      if (state !== State.PoweredOn && isScanning) {
        setIsScanning(false);
      }
    }, true);

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          manager.state().then(setBluetoothState);
        }
    });

    return () => {
      stateSubscription.remove();
      appStateSubscription.remove();
      manager.stopDeviceScan();
    };
  }, [fetchBeacons, isScanning]); // Re-executa se o fetchBeacons mudar (o que não deve) ou isScanning (para parar se o estado mudar)

  // Funções de feedback (fala e vibração)
  const speakMessage = useCallback(async (message: string) => {
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
  }, []);

  const triggerHapticFeedback = useCallback(async (style = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS === 'web') return;
    try {
      const settings = await getSettings();
      if (settings.vibrationEnabled) {
        await Haptics.impactAsync(style);
      }
    } catch (error) {
      console.error('Erro no feedback háptico:', error);
    }
  }, []);

  const stopProximityVibration = useCallback(() => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    Vibration.cancel();
  }, []);

  const startProximityVibration = useCallback(async (rssi: number) => {
    stopProximityVibration();
    const settings = await getSettings();
    if (!settings.vibrationEnabled) return;

    const proximity = 100 + rssi;
    const interval = Math.max(150, 800 - proximity * 10);
    const vibrationDuration = 100;

    vibrationIntervalRef.current = setInterval(() => {
      Vibration.vibrate(vibrationDuration);
    }, interval);
  }, [stopProximityVibration]);

  // Controla a vibração de proximidade
  useEffect(() => {
    if (isScanning && closestBeaconRssi !== null) {
      startProximityVibration(closestBeaconRssi);
    } else {
      stopProximityVibration();
    }
    return stopProximityVibration;
  }, [isScanning, closestBeaconRssi, startProximityVibration, stopProximityVibration]);

  // Função que lida com cada dispositivo BLE detectado
  const handleDeviceDetected = useCallback((device: Device) => {
    const deviceName = device.name || device.localName;
    if (!deviceName || device.rssi == null || !knownBeacons[deviceName]) return;

    const message = knownBeacons[deviceName];
    const currentRssi = device.rssi;
    const previousSmoothedRssi = smoothedRssiRef.current[deviceName] || currentRssi;

    const newSmoothedRssi = (EMA_ALPHA * currentRssi) + (1 - EMA_ALPHA) * previousSmoothedRssi;
    smoothedRssiRef.current[deviceName] = newSmoothedRssi;

    const distance = calculateDistance(newSmoothedRssi);

    if (distance <= 2.5 && !notifiedBeaconsRef.current.has(deviceName)) {
      notifiedBeaconsRef.current.add(deviceName);
      triggerHapticFeedback(Haptics.ImpactFeedbackStyle.Heavy);
      speakMessage(message);

      setTimeout(() => {
        notifiedBeaconsRef.current.delete(deviceName);
      }, ACTIVE_BEACON_TIMEOUT);
    }
  }, [knownBeacons, speakMessage, triggerHapticFeedback]);
  
  const stopScanning = useCallback(async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    bleManagerRef.current?.stopDeviceScan();
    setIsScanning(false);
    setClosestBeaconRssi(null);
    await triggerHapticFeedback();
    await speakMessage('Escaneamento interrompido.');
  }, [speakMessage, triggerHapticFeedback]);

  const startScanning = useCallback(async () => {
    const hasPermissions = await requestPermissionsFromService();
    if (!hasPermissions) {
      Alert.alert('Permissões Negadas', 'As permissões de Bluetooth e localização são necessárias.');
      return;
    }
    if (bluetoothState !== State.PoweredOn) {
      Alert.alert('Bluetooth Desligado', 'Por favor, ative o Bluetooth para iniciar o escaneamento.');
      return;
    }
    
    setIsScanning(true);
    notifiedBeaconsRef.current.clear();
    smoothedRssiRef.current = {};

    await triggerHapticFeedback();
    await speakMessage('Iniciando escaneamento. Caminhe com segurança.');
    
    const scannedDevices = new Map<string, Device>();

    bleManagerRef.current?.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
      if (error) {
        if (error.message.includes('cancelled')) return;
        console.error('Erro no scan:', error.message);
        stopScanning();
        return;
      }
      if (device) {
        handleDeviceDetected(device);
        scannedDevices.set(device.id, device);
      }
    });

    // Intervalo para atualizar o beacon mais próximo para a vibração
    scanIntervalRef.current = setInterval(() => {
        const devicesArray = Array.from(scannedDevices.values());
        const closestDevice = devicesArray
          .filter(d => d.name && knownBeacons[d.name] && d.rssi != null)
          .sort((a, b) => b.rssi! - a.rssi!)[0];

        setClosestBeaconRssi(closestDevice?.rssi ?? null);
        scannedDevices.clear();
    }, 1500);

  }, [bluetoothState, handleDeviceDetected, knownBeacons, speakMessage, stopScanning, triggerHapticFeedback]);
  
  const toggleScanning = useCallback(() => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning();
    }
  }, [isScanning, startScanning, stopScanning]);

  // Retorna apenas o que a UI precisa
  return {
    isScanning,
    isLoadingBeacons,
    bluetoothState,
    toggleScanning,
  };
};