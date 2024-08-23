import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Image, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useBoxStore } from '../../context/BoxStore';
import { useAuthStore } from '../../context/AuthStore';
import axios from 'axios';

const AddItemScreen = () => {
  const route = useRoute();
  const { boxID } = route.params; 
  const { error } = useBoxStore();
  const { token } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quality, setQuality] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [image, setImage] = useState<any>(null);
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert('Permissions required', 'Please allow access to your camera and media library.');
      }
    })();
  }, []);

  const pickImage = async (source: 'camera' | 'library') => {
    let result;

    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
    }

    if (!result.canceled) {
      setImage(result.assets[0]); 
    }
  };

  const handleAddItem = async () => {
    if (image) {
      const formData = new FormData();
      formData.append('box_id', boxID);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('quality', quality.toString());
      formData.append('quantity', quantity.toString());
  
      formData.append('image', {
        uri: image.uri,
        type: image.type,
        name: image.fileName || 'photo.jpg',
      });
  
      try {
        const response = await axios.post('https://0d92-88-232-168-154.ngrok-free.app/add-item', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
  
        console.log('Response:', response.data);
        navigation.goBack();
      } catch (error: any) {
        console.error('Image upload error:', error.response?.data || error.message || error);
      }
    } else {
      Alert.alert('No Image', 'Please select an image.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Text style={styles.title}>Kutuya Ürün Ekle</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Adı"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Açıklama"
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder="Kalite"
          keyboardType="numeric"
          value={quality.toString()}
          onChangeText={(text) => setQuality(parseInt(text))}
        />
        <TextInput
          style={styles.input}
          placeholder="Adet"
          keyboardType="numeric"
          value={quantity.toString()}
          onChangeText={(text) => setQuantity(parseInt(text))}
        />

        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={() => pickImage('camera')} style={styles.imagePicker}>
            <Text style={styles.imagePickerText}>Fotoğraf Çek</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pickImage('library')} style={styles.imagePicker}>
            <Text style={styles.imagePickerText}>Galeriden Resim Ekle</Text>
          </TouchableOpacity>
        </View>

        {image && <Image source={{ uri: image.uri }} style={styles.image} />}
      </ScrollView>
      
      <View style={styles.footer}>
        <Button title="Ekle" onPress={handleAddItem} color="#007BFF" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  imagePicker: {
    backgroundColor: '#E0E0E0',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  imagePickerText: {
    fontSize: 16,
    color: '#333',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
    resizeMode: 'cover',
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
  },
});

export default AddItemScreen;
