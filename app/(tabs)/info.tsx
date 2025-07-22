import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Bluetooth, MapPin, Volume2, Smartphone } from 'lucide-react-native';

export default function InfoScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Como Funciona</Text>
        <Text style={styles.subtitle}>
          Sistema de Acessibilidade Urbana
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.featureContainer}>
          <View style={styles.iconContainer}>
            <Bluetooth size={32} color="#007AFF" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.featureTitle}>Beacons Bluetooth</Text>
            <Text style={styles.featureDescription}>
              Pequenos dispositivos instalados próximos a obstáculos urbanos como postes, 
              escadas, bancos e entradas. Eles transmitem sinais que seu smartphone pode detectar.
            </Text>
          </View>
        </View>

        <View style={styles.featureContainer}>
          <View style={styles.iconContainer}>
            <MapPin size={32} color="#007AFF" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.featureTitle}>Detecção Automática</Text>
            <Text style={styles.featureDescription}>
              Quando você se aproxima de um beacon (geralmente entre 1-5 metros), 
              o aplicativo detecta automaticamente e identifica o tipo de obstáculo.
            </Text>
          </View>
        </View>

        <View style={styles.featureContainer}>
          <View style={styles.iconContainer}>
            <Volume2 size={32} color="#007AFF" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.featureTitle}>Alertas por Voz</Text>
            <Text style={styles.featureDescription}>
              Receba notificações de voz claras sobre o que está à sua frente, 
              como "Atenção: escada detectada à frente" ou "Banco disponível à frente".
            </Text>
          </View>
        </View>

        <View style={styles.featureContainer}>
          <View style={styles.iconContainer}>
            <Smartphone size={32} color="#007AFF" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.featureTitle}>Feedback Tátil</Text>
            <Text style={styles.featureDescription}>
              Seu smartphone vibra quando um obstáculo é detectado, 
              proporcionando um alerta adicional mesmo em ambientes barulhentos.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>Como Usar</Text>
        
        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>
            Toque no botão "Iniciar" na tela principal para ativar o escaneamento
          </Text>
        </View>
        
        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>
            Mantenha o aplicativo aberto e caminhe normalmente
          </Text>
        </View>
        
        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>
            Escute os alertas de voz e sinta as vibrações quando obstáculos forem detectados
          </Text>
        </View>
        
        <View style={styles.step}>
          <Text style={styles.stepNumber}>4</Text>
          <Text style={styles.stepText}>
            Configure suas preferências na aba "Configurações" para uma melhor experiência
          </Text>
        </View>
      </View>

      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Dicas Importantes</Text>
        <Text style={styles.tipText}>
          • Mantenha o Bluetooth sempre ativo{'\n'}
          • Use fones de ouvido para melhor clareza dos alertas{'\n'}
          • O aplicativo funciona melhor ao ar livre{'\n'}
          • Bateria: o escaneamento contínuo pode consumir mais energia{'\n'}
          • Privacidade: nenhum dado pessoal é coletado ou transmitido
        </Text>
      </View>
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
  featureContainer: {
    flexDirection: 'row',
    marginBottom: 30,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  textContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
  },
  instructionsSection: {
    marginBottom: 40,
  },
  instructionsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 30,
    marginRight: 15,
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
  },
  tipsSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
  },
  tipsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  tipText: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
  },
});