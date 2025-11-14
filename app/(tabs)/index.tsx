// app/(tabs)/index.tsx

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { State } from 'react-native-ble-plx'; // Importamos o 'State' para o getInstructionText
import { useBeaconScanner } from '@/hooks/useBeaconScanner'; // Importa o novo hook

export default function ScannerScreen() {
  // Todo o "trabalho pesado" está dentro do hook.
  // Nós apenas pegamos os valores de estado e a função de controle.
  const {
    isScanning,
    isLoadingBeacons,
    bluetoothState,
    toggleScanning,
  } = useBeaconScanner();

  const getInstructionText = () => {
    if (isScanning) return 'Escaneamento ativo. Caminhe pelo ambiente...';
    if (isLoadingBeacons) return 'Carregando dados dos beacons...';
    if (bluetoothState !== State.PoweredOn) return `Bluetooth está ${bluetoothState}.`;
    return 'Clique no botão para iniciar o escaneamento';
  };

  // O JSX (UI) permanece exatamente o mesmo
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Bem-vindo!</Text>
        <Text style={styles.instructionText}>{getInstructionText()}</Text>
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
        >
          {isLoadingBeacons ? (
            <ActivityIndicator size="large" color="#ffffff" />
          ) : (
            <Text style={styles.scanButtonText}>{isScanning ? 'Parar' : 'Iniciar'}</Text>
          )}
        </TouchableOpacity>

        {bluetoothState !== State.PoweredOn && !isLoadingBeacons && (
            <View style={styles.warningContainer}>
                <Text style={styles.warningText}>Bluetooth desabilitado ou indisponível.</Text>
            </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Mantenha o aplicativo em primeiro plano</Text>
      </View>
    </View>
  );
}

// Os estilos permanecem exatamente os mesmos
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingTop: 60,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanButtonActive: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  scanButtonDisabled: {
    backgroundColor: '#555',
    shadowColor: '#000',
  },
  scanButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  warningContainer: {
    marginTop: 40,
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 10,
  },
  warningText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
});