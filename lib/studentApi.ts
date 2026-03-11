import axios from "axios";
import { API_BASE_URL } from "@/constants/env";
import { useStudentAuthStore } from "@/store/studentAuthStore";

const studentApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

studentApi.interceptors.request.use((config) => {
  const token = useStudentAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

studentApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useStudentAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default studentApi;
