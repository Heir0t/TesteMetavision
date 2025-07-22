// hooks/useFrameworkReady.ts
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useFrameworkReady() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeFramework = async () => {
      try {
        // Aguardar um pouco para garantir que o framework está pronto
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificações específicas da plataforma
        if (Platform.OS === 'android') {
          // Para Android, aguardar mais um pouco para garantir que
          // os serviços nativos estejam disponíveis
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        setIsReady(true);
        console.log('Framework inicializado com sucesso');
      } catch (error) {
        console.error('Erro ao inicializar framework:', error);
        setIsReady(true); // Continuar mesmo com erro
      }
    };

    initializeFramework();
  }, []);

  return isReady;
}