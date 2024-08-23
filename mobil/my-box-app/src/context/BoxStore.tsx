import create from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

interface Item {
  id: string;
  name: string;
  description: string;
  quality: string;
  quantity: string;
  image_url: string;
}

interface BoxState {
  boxes: any[];
  currentBox: any | null;
  error: string | null;
  qrCodeData: string | null;
  createBox: (name: string, description: string) => Promise<void>;
  getBoxes: () => Promise<void>;
  refreshBoxes: () => Promise<void>;
  deleteBox: (boxID: string) => Promise<void>;
  updateItem: (
    boxID: string,
    itemID: string,
    updatedItem: Item
  ) => Promise<void>;
  setError: (error: string | null) => void;
  handleQRCodeScan: (data: string) => void;
}

export const useBoxStore = create<BoxState>((set) => ({
  boxes: [],
  currentBox: null,
  error: null,
  qrCodeData: null,

  createBox: async (name, description) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("No token found");

      await axios.post(
        "https://0d92-88-232-168-154.ngrok-free.app/create-box",
        { name, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      set({ error: null });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to create box";
      set({ error: errorMsg });
    }
  },

  getBoxes: async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("No token found");

      const response = await axios.get("https://0d92-88-232-168-154.ngrok-free.app/get-boxes", {
        headers: { Authorization: `Bearer ${token}` },
      });

      set({ boxes: response.data, error: null });
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to fetch boxes";
      set({ error: errorMsg });
    }
  },

  refreshBoxes: async () => {
    await set((state) => state.getBoxes());
  },

  deleteBox: async (boxID) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("No token found");

      await axios.delete(`https://0d92-88-232-168-154.ngrok-free.app/box/${boxID}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      set((state) => ({
        boxes: state.boxes.filter((box) => box.boxId !== boxID),
        error: null,
      }));
    } catch (error: any) {
      const errorMsg = error.response?.data?.error;
      console.log(errorMsg);
      set({ error: errorMsg });
    }
  },
  updateItem: async (boxID, itemID, updatedItem) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("No token found");

      await axios.put(
        `https://0d92-88-232-168-154.ngrok-free.app/boxes/${boxID}/items/${itemID}`,
        updatedItem,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      set((state) => ({
        boxes: state.boxes.map((box) =>
          box.boxId === boxID
            ? {
                ...box,
                items: box.items.map((item) =>
                  item.id === itemID ? { ...updatedItem } : item
                ),
              }
            : box
        ),
        error: null,
      }));
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "Failed to update item";
      set({ error: errorMsg });
    }
  },

  setError: (error) => set({ error }),

  handleQRCodeScan: (data) => {
    set({ qrCodeData: data });
  },
}));
