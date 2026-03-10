const rawUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
export const API_BASE_URL = rawUrl.replace(/\/api\/v1\/?$/, "") + "/api/v1";
