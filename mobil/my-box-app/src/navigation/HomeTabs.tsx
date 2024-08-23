import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import QRCodeScannerTab from "../screens/qrScreen";
import HomeScreen from "../screens/HomeScreen";

const Tab = createBottomTabNavigator();

const HomeTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Scanner" component={QRCodeScannerTab} />
    </Tab.Navigator>
  );
};

export default HomeTabs;
