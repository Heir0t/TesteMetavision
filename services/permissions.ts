import { Platform, PermissionsAndroid, Alert, Permission, Linking } from 'react-native';

// Função para aguardar um pouco antes de solicitar permissões
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retorna a lista de permissões necessárias com base na versão do Android.
 */
const getRequiredAndroidPermissions = (): Permission[] => {
  const permissions: Permission[] = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  // Para Android 12+ (API 31+), adicionar permissões de Bluetooth
  if (Number(Platform.Version) >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as Permission,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as Permission
    );
  }

  return permissions;
};

/**
 * Solicita todas as permissões necessárias para o funcionamento do app no Android.
 */
export const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    // Para iOS, as permissões são geralmente solicitadas em tempo de uso pela biblioteca.
    // É necessário configurar o Info.plist com NSBluetoothAlwaysUsageDescription, etc.
    return true;
  }

  try {
    // Aguardar um pouco para garantir que o sistema está pronto
    await delay(100);
    
    const permissionsToRequest = getRequiredAndroidPermissions();
    console.log('Solicitando permissões:', permissionsToRequest);

    const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);
    console.log('Resultado das permissões:', granted);

    const allPermissionsGranted = Object.values(granted).every(
      status => status === PermissionsAndroid.RESULTS.GRANTED
    );

    if (allPermissionsGranted) {
      console.log('Todas as permissões foram concedidas');
      return true;
    }

    // Se alguma permissão foi negada
    const deniedPermissions = Object.keys(granted).filter(
      (key) => granted[key as keyof typeof granted] !== PermissionsAndroid.RESULTS.GRANTED
    );
    console.log('Permissões negadas:', deniedPermissions);

    Alert.alert(
      'Permissões Necessárias',
      'Para garantir a melhor experiência, o aplicativo precisa de acesso à sua localização, dispositivos Bluetooth e vibração. Por favor, ative as permissões nas configurações.',
      [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Abrir Configurações',
          onPress: () => Linking.openSettings(), // <-- ABRE AS CONFIGURAÇÕES DO APP
        },
      ]
    );
    return false;
  } catch (error) {
    console.error('Erro ao solicitar permissões:', error);
    Alert.alert('Erro', 'Ocorreu um erro ao solicitar permissões. Tente novamente.');
    return false;
  }
};

/**
 * Verifica se todas as permissões necessárias já foram concedidas.
 */
export const checkPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissionsToCheck = getRequiredAndroidPermissions();
    console.log('Verificando permissões:', permissionsToCheck);

    for (const permission of permissionsToCheck) {
      const hasPermission = await PermissionsAndroid.check(permission);
      if (!hasPermission) {
        console.log(`Permissão ${permission} não concedida`);
        return false;
      }
    }

    console.log('Todas as permissões já estão concedidas');
    return true;
  } catch (error) {
    console.error('Erro ao verificar permissões:', error);
    return false;
  }
};

// As funções auxiliares podem ser removidas se não forem usadas em outros lugares,
// pois a lógica principal já está centralizada.