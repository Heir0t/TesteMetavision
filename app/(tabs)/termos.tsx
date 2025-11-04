import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Termos de Uso</Text>
        <Text style={styles.subtitle}>
          Regras de utilização do MetaVision
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.termsText}>
          Bem-vindo ao MetaVision. Ao utilizar nosso aplicativo, você concorda 
          com as regras descritas neste documento. Estes Termos visam garantir 
          uma experiência segura e eficaz para todos. Caso não concorde, 
          recomendamos não utilizar nossos serviços.
        </Text>

        <Text style={styles.termsTitle}>1. Sobre o Aplicativo</Text>
        <Text style={styles.termsText}>
          O MetaVision é um sistema de acessibilidade urbana que auxilia 
          pessoas com deficiência visual. Utilizando a tecnologia de beacons 
          (via Bluetooth) e os sensores do seu smartphone, o aplicativo 
          fornece alertas sonoros e táteis em tempo real sobre obstáculos, 
          pontos de interesse e travessias seguras.
        </Text>

        <Text style={styles.termsTitle}>2. Uso e Responsabilidades</Text>
        <Text style={styles.termsParagraph}>
          • Manter os serviços de Localização (Geolocalização) e Bluetooth 
            do seu dispositivo ativados para o correto funcionamento do aplicativo.
        </Text>
        <Text style={styles.termsParagraph}>
          • Compreender que o MetaVision é uma ferramenta de 
            <Text style={styles.boldText}> auxílio </Text> 
            e não substitui métodos tradicionais de orientação e mobilidade 
            (como a bengala ou cão-guia).
        </Text>
        <Text style={styles.termsParagraph}>
          • Manter seu aplicativo atualizado para garantir o recebimento das 
            últimas correções e funcionalidades.
        </Text>

        <Text style={styles.termsTitle}>3. Dados e Permissões</Text>
        <Text style={styles.termsText}>
          Para funcionar, o MetaVision necessita de permissão para acessar o 
          <Text style={styles.boldText}> Bluetooth </Text> 
          (para detectar os beacons) e sua 
          <Text style={styles.boldText}> Localização </Text> 
          (para identificar onde você está e fornecer os alertas corretos).
        </Text>

        <Text style={styles.termsTitle}>4. Privacidade (LGPD e ECA)</Text>
        <Text style={styles.termsText}>
          Nós levamos sua privacidade a sério.
        </Text>
        <Text style={styles.termsParagraph}>
          • <Text style={styles.boldText}>LGPD:</Text> Seus dados são tratados 
            conforme a Lei Geral de Proteção de Dados (LGPD – Lei $n^{\circ}$ 13.709/2018). 
            Seus dados de localização são usados apenas em tempo real para o 
            funcionamento dos alertas e não são armazenados para outros fins.
        </Text>
        <Text style={styles.termsParagraph}>
          • <Text style={styles.boldText}>ECA:</Text> Em conformidade com o 
            Estatuto da Criança e do Adolescente (ECA – Lei $n^{\circ}$ 8.069/1990), o 
            uso do aplicativo por menores de 18 anos deve ser realizado com o 
            consentimento e a supervisão de um responsável legal.
        </Text>

        <Text style={styles.termsTitle}>5. Limitações de Responsabilidade</Text>
        <Text style={styles.termsText}>
          O MetaVision atua como uma plataforma de 
          <Text style={styles.boldText}> auxílio </Text> 
          à navegação. Não garantimos a precisão absoluta de 100% dos 
          alertas. A tecnologia de beacons, Bluetooth e GPS pode sofrer 
          interferências. O MetaVision não se responsabiliza por quaisquer 
          acidentes ou danos ocorridos durante o deslocamento.
        </Text>

        <Text style={styles.termsTitle}>6. Propriedade Intelectual</Text>
        <Text style={styles.termsText}>
          Todo o conteúdo da plataforma (marca "MetaVision", design, códigos 
          e funcionalidades) pertence aos seus desenvolvedores e à Escola 
          Técnica Estadual Monteiro Lobato (CIMOL) e não pode ser copiado 
          sem autorização.
        </Text>
        
        <Text style={styles.termsTitle}>9. Contato</Text>
        <Text style={styles.termsText}>
          Dúvidas sobre estes Termos de Uso podem ser enviadas para: 
          contato.metavision@gmail.com
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
  termsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 25,
    marginBottom: 15,
  },
  termsText: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
  },
  termsParagraph: {
    fontSize: 16,
    color: '#cccccc',
    lineHeight: 24,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
});