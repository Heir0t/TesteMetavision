import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Speech from 'expo-speech';
import { Vibrate, TestTube } from 'lucide-react-native';
import { getSettings, saveSettings, SettingsType } from '../../services/settings';
// import { supabase } from '../../api/supabaseClient'; // <-- CORREÇÃO: Import desnecessário removido

const DEFAULT_SETTINGS: SettingsType = {
  vibrationEnabled: true,
  speechRate: 0.5,
  speechPitch: 1.0,
  speechVolume: 1.0,
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // useEffect corrigido para carregar apenas do AsyncStorage
  useEffect(() => {
    const loadInitialSettings = async () => {
      setIsLoading(true);

      // <-- CORREÇÃO: Todo o bloco de login anônimo do Supabase foi removido
      
      const loadedSettings = await getSettings(); // Carrega do AsyncStorage
      setSettings(loadedSettings);
      setIsLoading(false);
    };

    loadInitialSettings();
  }, []); // Roda apenas uma vez

  // updateSetting corrigida para atualizar o estado
  const updateSetting = async (key: keyof SettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };

    // <-- CORREÇÃO: Esta é a linha que faltava!
    // Atualiza a UI (estado do React) imediatamente.
    setSettings(newSettings); 

    // Salva no AsyncStorage em segundo plano
    const success = await saveSettings(newSettings);
    
    if (!success) {
      // Se falhar, avisa o usuário e reverte o estado
      Alert.alert('Erro', 'Não foi possível salvar a configuração. Tente novamente.');
      const oldSettings = await getSettings(); // Busca o último valor válido
      setSettings(oldSettings); // Reverte a UI
    }
  };

  const testSpeech = () => {
    const testMessage = 'Esta é uma mensagem de teste para verificar suas configurações de voz.';
    Speech.speak(testMessage, {
      language: 'pt-BR',
      pitch: settings.speechPitch,
      rate: settings.speechRate,
      volume: settings.speechVolume,
    });
  };

  const resetSettings = () => {
    Alert.alert(
      'Restaurar Padrões',
      'Tem certeza que deseja restaurar todas as configurações para os valores padrão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            setSettings(DEFAULT_SETTINGS); // Atualiza a UI
            await saveSettings(DEFAULT_SETTINGS); // Salva no storage
            setIsLoading(false);
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* ... O resto do seu JSX (layout) permanece o mesmo ... */}
        {/* ... (Todo o JSX foi omitido para encurtar, mas ele está correto) ... */}
        <View style={styles.header}>
            <Text style={styles.title}>Configurações</Text>
            <Text style={styles.subtitle}>Personalize sua experiência</Text>
        </View>

        {/* Seção de Voz */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configurações de Voz</Text>
            
            <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Velocidade da Fala</Text>
                <Text style={styles.settingValue}>{Math.round(settings.speechRate * 100)}%</Text>
                <Slider
                    style={styles.slider}
                    minimumValue={0.1}
                    maximumValue={1.0}
                    value={settings.speechRate}
                    onSlidingComplete={(value) => updateSetting('speechRate', value)}
                    minimumTrackTintColor="#007AFF"
                    maximumTrackTintColor="#666"
                    thumbTintColor="#007AFF"
                />
    B            <Text style={styles.settingDescription}>Controla a velocidade com que as mensagens são faladas</Text>
            </View>

            <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Tom da Voz</Text>
                <Text style={styles.settingValue}>{settings.speechPitch.toFixed(1)}</Text>
            _   <Slider
                    style={styles.slider}
                    minimumValue={0.5}
                    maximumValue={2.0}
                    value={settings.speechPitch}
                    onSlidingComplete={(value) => updateSetting('speechPitch', value)}
                    minimumTrackTintColor="#007AFF"
                    maximumTrackTintColor="#666"
                    thumbTintColor="#007AFF"
                />
                <Text style={styles.settingDescription}>Ajusta o tom (grave/agudo) da voz sintética</Text>
            </View>

            <TouchableOpacity style={styles.testButton} onPress={testSpeech}>
                <TestTube size={20} color="#ffffff" />
                <Text style={styles.testButtonText}>Testar Voz</Text>
            </TouchableOpacity>
        </View>

        {/* Seção de Feedback Tátil */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Feedback Tátil</Text>
            <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                    <Vibrate size={24} color="#007AFF" />
                    <View style={styles.switchTextContainer}>
                        <Text style={styles.settingLabel}>Vibração</Text>
                        <Text style={styles.settingDescription}>Vibra quando obstáculos são detectados</Text>
                    </View>
                </View>
                <Switch
                    value={settings.vibrationEnabled}
                    onValueChange={(value) => updateSetting('vibrationEnabled', value)}
                    trackColor={{ false: '#666', true: '#007AFF' }}
                    thumbColor={settings.vibrationEnabled ? '#ffffff' : '#cccccc'}
                />
            </View>
        </View>

        {/* Seção de Informações */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações</Text>
section             <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                    <Text style={styles.boldText}>Versão:</Text> 1.0.0{'\n'}
                    <Text style={styles.boldText}>Idioma:</Text> Português (Brasil){'\n'}
                    <Text style={styles.boldText}>Desenvolvido para:</Text> Acessibilidade Urbana
                </Text>
            </View>
        </View>

        <TouchableOpacity style={styles.resetButton} onPress={resetSettings}>
            <Text style={styles.resetButtonText}>Restaurar Configurações Padrão</Text>
        </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
// ... (Seus estilos estão corretos e não foram alterados) ...
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  settingItem: {
    marginBottom: 30,
  },
  settingLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  settingValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 10,
  },
  settingDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginTop: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  resetButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  resetButtonText: {
    color: '#ff0000ff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
    marginTop: 10,
  },
});