import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from './src/context/AuthStore';
import HomeScreen from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegsiterScreen';
import LoginScreen from './src/screens/LoginScreen';
import AddItemScreen from './src/screens/AddItem';
import DetailsScreen from './src/screens/Details';
import QRCodeScannerTab from './src/screens/qrScreen';
import HomeTabs from './src/navigation/HomeTabs';


const Stack = createStackNavigator();

export default function App() {
  const { token, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
      screenOptions={{
        headerShown:false
      }}
      >
        {token ? (
          <Stack.Screen name="Home" component={HomeTabs} />
        
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
  <Stack.Screen name="AddItem" component={AddItemScreen} />
  <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
