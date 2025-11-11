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

const SETTINGS_KEY = '@MyApp_Settings';

export const getSettings = async (): Promise<SettingsType> => {
  try {
    const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
    
    if (jsonValue !== null) {
      const savedSettings: SettingsType = JSON.parse(jsonValue);
      // Mescla com o padrão para garantir que novas chaves sejam adicionadas
      return { ...DEFAULT_SETTINGS, ...savedSettings };
    }
    
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Erro ao carregar configurações do AsyncStorage:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: SettingsType): Promise<boolean> => {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
    return true;
  } catch (error) {
    console.error('Erro ao salvar configurações no AsyncStorage:', error);
    return false;
  }
};