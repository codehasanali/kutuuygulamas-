import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Button,
  Alert,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { useAuthStore } from "../context/AuthStore";
import { useBoxStore } from "../context/BoxStore";
import { useNavigation } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { FontAwesome } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";

const HomeScreen = () => {
  const logout = useAuthStore((state) => state.logout);
  const { boxes, getBoxes, createBox, deleteBox, error } = useBoxStore();
  const navigation = useNavigation<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [boxName, setBoxName] = useState("");
  const [boxDescription, setBoxDescription] = useState("");

  useEffect(() => {
    getBoxes();
  }, [getBoxes]);

  const handleShareQRCode = async (qrCodeURL: string) => {
    try {
      const fileUri = FileSystem.cacheDirectory + "qrcode.png";
      const response = await FileSystem.downloadAsync(qrCodeURL, fileUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(response.uri);
      } else {
        Alert.alert("Sharing is not available on this device.");
      }
    } catch (error) {
      console.error("Error sharing QR code:", error);
      Alert.alert("Failed to share the QR code. Please try again later.");
    }
  };

  const handleAddBox = async () => {
    if (boxName.trim() === "" || boxDescription.trim() === "") {
      Alert.alert("Error", "Please fill out both fields.");
      return;
    }

    try {
      await createBox(boxName, boxDescription);
      await getBoxes();
      setModalVisible(false);
      setBoxName("");
      setBoxDescription("");
    } catch (error) {
      console.error("Error creating box:", error);
      Alert.alert("Failed to create box. Please try again.");
    }
  };

  const handleDeleteBox = async (boxId: string) => {
    console.log("Attempting to delete box with ID:", boxId);
    try {
      await deleteBox(boxId);
      console.log(`Box with ID ${boxId} deleted from database.`);
      await getBoxes();
      console.log("Boxes list refreshed.");
    } catch (error) {
      console.error(`Failed to delete box with ID ${boxId}:`, error);
      Alert.alert("Failed to delete box. Please try again.");
    }
  };

  const renderRightActions = (boxId: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() =>
          Alert.alert(
            "Delete Box",
            "Are you sure you want to delete this box?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => handleDeleteBox(boxId),
              },
            ]
          )
        }
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const renderBoxItem = ({ item }: { item: any }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.boxId)}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.boxContainer}
        onPress={() => navigation.navigate("Details", { boxID: item.boxId })}
        onLongPress={() => {
          if (item.qr_code_url) {
            handleShareQRCode(item.qr_code_url);
          } else {
            Alert.alert("No QR code available for this box.");
          }
        }}
      >
        <Text style={styles.boxName}>{item.name || "Unnamed Box"}</Text>
        <Text style={styles.boxDescription}>{item.description}</Text>
        <Text style={styles.boxStock}>
          Content: {item.items ? item.items.length : 0}
        </Text>
      </TouchableOpacity>
    </Swipeable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kutular</Text>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.addButton}
        >
          <FontAwesome name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      <FlatList
        data={boxes}
        keyExtractor={(item) =>
          item.boxId ? item.boxId.toString() : Math.random().toString()
        }
        renderItem={renderBoxItem}
        contentContainerStyle={styles.listContainer}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Yeni Kutu</Text>
            <TextInput
              style={styles.input}
              placeholder="Kutu Adı"
              value={boxName}
              onChangeText={setBoxName}
            />
            <TextInput
              style={styles.input}
              placeholder="Kutu Açıklaması"
              value={boxDescription}
              onChangeText={setBoxDescription}
            />
            <Button title="Kutu Ekle" onPress={handleAddBox} />
            <Button
              title="İptal"
              color="red"
              onPress={() => setModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      <View style={styles.logoutButtonContainer}>
        <Button
          title="Çıkış yap"
          onPress={logout}
          color={Platform.OS === "ios" ? "#007AFF" : "#FF6347"}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F8F8F8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#007AFF",
    borderRadius: 50,
    padding: 10,
  },
  errorText: {
    color: "red",
    marginBottom: 16,
    textAlign: "center",
  },
  listContainer: {
    paddingBottom: 16,
  },
  boxContainer: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  boxName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  boxDescription: {
    fontSize: 14,
    color: "#777777",
    marginVertical: 4,
  },
  boxStock: {
    fontSize: 14,
    color: "#555555",
    marginVertical: 4,
  },
  deleteButton: {
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  logoutButtonContainer: {
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: "#DDD",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
});

export default HomeScreen;
