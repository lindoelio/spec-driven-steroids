import { useState, useEffect } from 'react';
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import { Camera } from 'expo-camera';

export function PhotoUploader() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  async function requestCameraPermission() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'PhotoUploader needs camera access to take photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          Alert.alert(
            'Permission Denied',
            'Camera permission was denied. Please enable it in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          setHasPermission(false);
        } else {
          setHasPermission(false);
        }
      } catch (err) {
        console.warn('Permission request failed:', err);
        setHasPermission(false);
      }
    }
  }

  async function handleTakePhoto() {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant camera permission first.');
      return;
    }

    setUploading(true);
    try {
      const photo = await Camera.requestCameraPermissionsAsync();
      if (photo.status === 'granted') {
        // Take photo logic here
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <View>
      <Button
        title={uploading ? 'Uploading...' : 'Take Photo'}
        onPress={handleTakePhoto}
        disabled={uploading}
      />
    </View>
  );
}
