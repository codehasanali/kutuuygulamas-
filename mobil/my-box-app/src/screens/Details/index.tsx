import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  useRoute,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { FontAwesome } from "@expo/vector-icons"; 
import { useBoxStore } from "../../context/BoxStore";
import { useAuthStore } from "../../context/AuthStore";

const { width } = Dimensions.get("window");

const DetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { boxID } = route.params;
  const { boxes, refreshBoxes } = useBoxStore();
  const { token } = useAuthStore();
  const [currentBox, setCurrentBox] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBoxDetails = useCallback(() => {
    const box = boxes.find((box) => box.boxId === boxID);
    setCurrentBox(box);
  }, [boxID, boxes]);

  useEffect(() => {
    fetchBoxDetails();
  }, [fetchBoxDetails]);

  useFocusEffect(
    useCallback(() => {
      fetchBoxDetails();
    }, [fetchBoxDetails])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBoxes();
    fetchBoxDetails();
    setRefreshing(false);
  };

  const defaultImageUrl = "https://via.placeholder.com/80";

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <Image
        source={{ uri: item.image_url || defaultImageUrl }}
        style={styles.itemImage}
        onError={(e) =>
          console.log("Image loading error:", e.nativeEvent.error)
        }
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDescription}>{item.description}</Text>
        <Text style={styles.itemDetails}>
          Kalite: {item.quality}, Adet: {item.quantity}
        </Text>
      </View>
    </View>
  );

  const keyExtractor = (item, index) =>
    item.id ? item.id.toString() : index.toString();

  if (!currentBox) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{currentBox.name}</Text>
      <Text style={styles.description}>{currentBox.description}</Text>

      <FlatList
        data={currentBox.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("AddItem", { boxID })}
      >
        <FontAwesome name="plus" size={24} color="#FFF" />
        <Text style={styles.addButtonText}>Yeni Ekle</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    marginTop: 50,
    backgroundColor: "#F8F8F8",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#555",
    marginBottom: 16,
  },
  itemContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  itemDescription: {
    fontSize: 14,
    color: "#777",
    marginVertical: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: "#555",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
});

export default DetailsScreen;
