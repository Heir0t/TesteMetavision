import { supabase } from '../api/supabaseClient';

// A interface permanece a mesma
export interface SettingsType {
  vibrationEnabled: boolean;
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
}

// As configurações padrão também
const DEFAULT_SETTINGS: SettingsType = {
  vibrationEnabled: true,
  speechRate: 0.5,
  speechPitch: 1.0,
  speechVolume: 1.0,
};

/**
 * Busca as configurações do usuário logado no Supabase.
 * Se não houver configurações salvas, retorna as configurações padrão.
 */
export const getSettings = async (): Promise<SettingsType> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        console.log('Nenhum usuário logado, retornando configurações padrão.');
        return DEFAULT_SETTINGS;
    }
    const { user } = session;

    const { data, error } = await supabase
      .from('settings')
      .select('vibration_enabled, speech_rate, speech_pitch, speech_volume')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: "querry returned no rows" - o que é esperado se o usuário ainda não salvou nada
      console.error('Erro ao carregar configurações do Supabase:', error);
      return DEFAULT_SETTINGS;
    }

    if (data) {
        // Mapeia os nomes das colunas para os nomes das propriedades
        return {
            vibrationEnabled: data.vibration_enabled,
            speechRate: data.speech_rate,
            speechPitch: data.speech_pitch,
            speechVolume: data.speech_volume
        };
    }

    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Erro inesperado ao carregar configurações:', error);
    return DEFAULT_SETTINGS;
  }
};

/**
 * Salva as configurações do usuário no Supabase.
 * Usa 'upsert' para criar ou atualizar o registro de configurações.
 * @param settings As novas configurações a serem salvas.
 * @returns Retorna true se a operação foi bem-sucedida, false caso contrário.
 */
export const saveSettings = async (settings: SettingsType): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Não é possível salvar as configurações: nenhum usuário logado.');
      return false;
    }
    
    const updates = {
      user_id: user.id,
      vibration_enabled: settings.vibrationEnabled,
      speech_rate: settings.speechRate,
      speech_pitch: settings.speechPitch,
      speech_volume: settings.speechVolume,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('settings').upsert(updates);

    if (error) {
      console.error('Erro ao salvar configurações no Supabase:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro inesperado ao salvar configurações:', error);
    return false;
  }
};
