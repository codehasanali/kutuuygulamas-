import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import { useBoxStore } from "../../context/BoxStore";
import { useAuthStore } from "../../context/AuthStore";

const QRCodeScannerTab: React.FC = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [boxDetails, setBoxDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { handleQRCodeScan } = useBoxStore();
  const { token, checkAuth } = useAuthStore();

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
      await checkAuth();
    })();
  }, [checkAuth]);

  console.log("====================================");
  console.log(boxDetails);
  console.log("====================================");
  const fetchBoxDetails = async (boxId: string) => {
    try {
      if (!token) {
        throw new Error("Kimlik doğrulama başarısız oldu");
      }

      const response = await fetch(
        `https://0d92-88-232-168-154.ngrok-free.app/box/${boxId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Sunucu hatası: ${response.status}`);
      }

      const data = await response.json();
      setBoxDetails(data);
      setError(null);
    } catch (err) {
      setError("Kutu detayları getirilemedi");
      setBoxDetails(null);
    }
  };

  const handleBarCodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (isScanning) {
      setIsScanning(false);
      handleQRCodeScan(data);

      const parts = data.split("::");
      if (parts.length === 2) {
        const boxId = parts[1].trim();
        const cleanedBoxId = boxId.startsWith("Box")
          ? boxId.slice(3).trim()
          : boxId;

        try {
          await fetchBoxDetails(cleanedBoxId);
        } catch {
          setError("Kutu detayları getirilemedi");
        }
      } else {
        setError("Geçersiz QR Kod formatı");
      }
    }
  };

  if (hasPermission === null) {
    return <Text>Kamera izni isteniyor...</Text>;
  }

  if (hasPermission === false) {
    return <Text>Kameraya erişim izni verilmedi</Text>;
  }

  return (
    <View style={styles.container}>
      {isScanning ? (
        <BarCodeScanner
          onBarCodeScanned={handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : boxDetails ? (
            <View style={styles.boxDetailsContainer}>
              <Text style={styles.boxTitle}>{boxDetails.name}</Text>
              <Text style={styles.boxSubtitle}>{boxDetails.description}</Text>

              {boxDetails.items.map((item: any, index: number) => (
                <View key={index} style={styles.itemContainer}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text style={styles.itemQuantity}>
                    Miktar: {item.quantity}
                  </Text>
                  <Text style={styles.itemQuantity}>
                    Kalite: {item.quality}
                  </Text>
                  <Image source={{ uri: item.image_url }} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.loadingText}>Kutu detayları yükleniyor...</Text>
          )}
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={() => setIsScanning(true)}
          >
            <Text style={styles.scanAgainButtonText}>Tekrar Tara</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  contentContainer: {
    padding: 20,
  },
  boxDetailsContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  boxTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  boxSubtitle: {
    fontSize: 14,
    color: "#777",
    marginVertical: 8,
  },
  stockContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  stockText: {
    fontSize: 16,
    color: "#555",
  },
  itemContainer: {
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  itemDescription: {
    fontSize: 14,
    color: "#777",
    marginVertical: 4,
  },
  itemQuantity: {
    fontSize: 16,
    color: "#555",
    marginVertical: 4,
  },
  adjustButton: {
    marginTop: 10,
    backgroundColor: "#6200ee",
    paddingVertical: 8,
    borderRadius: 5,
    alignItems: "center",
  },
  adjustButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  scanAgainButton: {
    backgroundColor: "#6200ee",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  scanAgainButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginVertical: 20,
  },
});

export default QRCodeScannerTab;
