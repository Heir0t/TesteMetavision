import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { Volume2, Vibrate, TestTube } from 'lucide-react-native';

interface SettingsType {
  vibrationEnabled: boolean;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
}

const DEFAULT_SETTINGS: SettingsType = {
  vibrationEnabled: true,
  speechRate: 0.5,
  speechPitch: 1.0,
  speechVolume: 1.0,
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('accessibility_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: SettingsType) => {
    try {
      await AsyncStorage.setItem('accessibility_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações.');
    }
  };

  const updateSetting = (key: keyof SettingsType, value: any) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
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
          onPress: () => saveSettings(DEFAULT_SETTINGS)
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>Personalize sua experiência</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔊 Configurações de Voz</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Velocidade da Fala</Text>
          <Text style={styles.settingValue}>
            {Math.round(settings.speechRate * 100)}%
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.1}
            maximumValue={1.0}
            value={settings.speechRate}
            onValueChange={(value) => updateSetting('speechRate', value)}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#666"
            thumbTintColor="#007AFF"
          />
          <Text style={styles.settingDescription}>
            Controla a velocidade com que as mensagens são faladas
          </Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Tom da Voz</Text>
          <Text style={styles.settingValue}>
            {settings.speechPitch.toFixed(1)}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0.5}
            maximumValue={2.0}
            value={settings.speechPitch}
            onValueChange={(value) => updateSetting('speechPitch', value)}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#666"
            thumbTintColor="#007AFF"
          />
          <Text style={styles.settingDescription}>
            Ajusta o tom (grave/agudo) da voz sintética
          </Text>
        </View>

        <TouchableOpacity style={styles.testButton} onPress={testSpeech}>
          <TestTube size={20} color="#ffffff" />
          <Text style={styles.testButtonText}>Testar Voz</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📳 Feedback Tátil</Text>
        
        <View style={styles.switchContainer}>
          <View style={styles.switchInfo}>
            <Vibrate size={24} color="#007AFF" />
            <View style={styles.switchTextContainer}>
              <Text style={styles.settingLabel}>Vibração</Text>
              <Text style={styles.settingDescription}>
                Vibra quando obstáculos são detectados
              </Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ Informações</Text>
        
        <View style={styles.infoContainer}>
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
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
  },
});