import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "sms_access_token";
const REFRESH_KEY = "sms_refresh_token";

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return await AsyncStorage.getItem(TOKEN_KEY);
  }
}

export async function setStoredToken(value: string | null): Promise<void> {
  if (value) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, value);
    } catch {
      await AsyncStorage.setItem(TOKEN_KEY, value);
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return await AsyncStorage.getItem(REFRESH_KEY);
  }
}

export async function setStoredRefreshToken(value: string | null): Promise<void> {
  if (value) {
    try {
      await SecureStore.setItemAsync(REFRESH_KEY, value);
    } catch {
      await AsyncStorage.setItem(REFRESH_KEY, value);
    }
  } else {
    try {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {
      await AsyncStorage.removeItem(REFRESH_KEY);
    }
  }
}

export const asyncStorage = AsyncStorage;
