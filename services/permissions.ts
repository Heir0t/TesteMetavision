import { Platform, PermissionsAndroid, Alert, Permission } from 'react-native';

// Função para aguardar um pouco antes de solicitar permissões
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const requestPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      // Aguardar um pouco para garantir que o sistema está pronto
      await delay(100);
      
      // Lista de permissões necessárias baseada na versão do Android
      const permissions: Permission[] = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];

      // Para Android 12+ (API 31+), adicionar permissões de Bluetooth
      if (Platform.Version >= 31) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as Permission,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as Permission
        );
      }

      console.log('Solicitando permissões:', permissions);

      const granted = await PermissionsAndroid.requestMultiple(permissions);

      console.log('Resultado das permissões:', granted);

      const allPermissionsGranted = Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allPermissionsGranted) {
        const deniedPermissions = Object.keys(granted).filter(
          (key) => granted[key as keyof typeof granted] !== PermissionsAndroid.RESULTS.GRANTED
        );
        
        console.log('Permissões negadas:', deniedPermissions);

        Alert.alert(
          'Permissões Necessárias',
          'Este aplicativo precisa de todas as permissões para funcionar corretamente. ' +
          'Por favor, conceda as permissões nas configurações do dispositivo.\n\n' +
          'Permissões negadas: ' + deniedPermissions.join(', '),
          [
            {
              text: 'OK',
              style: 'default',
            },
            {
              text: 'Abrir Configurações',
              onPress: () => {
                // Aqui você pode adicionar código para abrir as configurações
                console.log('Usuário solicitou abrir configurações');
              },
            },
          ]
        );
        return false;
      }

      console.log('Todas as permissões foram concedidas');
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
      Alert.alert(
        'Erro',
        'Ocorreu um erro ao solicitar permissões. Tente novamente.'
      );
      return false;
    }
  } else {
    // Para iOS, as permissões são solicitadas automaticamente
    console.log('Plataforma iOS - permissões automáticas');
    return true;
  }
};

export const checkPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      // Lista básica de permissões para verificar
      const basicPermissions: Permission[] = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];

      // Verificar permissões de Bluetooth para Android 12+
      const bluetoothPermissions: Permission[] = [];
      if (Platform.Version >= 31) {
        bluetoothPermissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as Permission,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as Permission
        );
      }

      const allPermissions = [...basicPermissions, ...bluetoothPermissions];

      console.log('Verificando permissões:', allPermissions);

      for (const permission of allPermissions) {
        const hasPermission = await PermissionsAndroid.check(permission);
        console.log(`Permissão ${permission}: ${hasPermission}`);
        
        if (!hasPermission) {
          console.log(`Permissão ${permission} não concedida`);
          return false;
        }
      }

      console.log('Todas as permissões verificadas com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      return false;
    }
  } else {
    console.log('Plataforma iOS - verificação de permissões pulada');
    return true;
  }
};

// Função auxiliar para verificar se as permissões de Bluetooth são necessárias
export const isBluetoothPermissionRequired = (): boolean => {
  return Platform.OS === 'android' && Platform.Version >= 31;
};

// Função para verificar apenas permissões de localização
export const checkLocationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const locationPermissions: Permission[] = [
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];

      for (const permission of locationPermissions) {
        const hasPermission = await PermissionsAndroid.check(permission);
        if (!hasPermission) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Erro ao verificar permissões de localização:', error);
      return false;
    }
  }
  
  return true;
};