import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SettingsType {
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

export const getSettings = async (): Promise<SettingsType> => {
  try {
    const savedSettings = await AsyncStorage.getItem('accessibility_settings');
    if (savedSettings) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: SettingsType): Promise<boolean> => {
  try {
    await AsyncStorage.setItem('accessibility_settings', JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return false;
  }
};