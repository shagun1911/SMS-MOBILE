# SMS Mobile App

Teacher and Student portal for the School Management System. Uses the same backend (SMS-Backend) as the web app.

## Features

- **Landing**: Choose Teacher or Student login.
- **Teacher**: Dashboard, Classes (with student list), Homework (list + assign), Exams/Marks, Timetable, Bus routes (if permitted), Profile (change password), Logout.
- **Student**: Dashboard, Homework, Marks/Results, Fees, Timetable, Profile (view + update username/password), Logout.

## Setup

1. **Install dependencies**

   ```bash
   cd mobile
   npm install
   ```

2. **Configure API URL**

   Create a `.env` file (or set `EXPO_PUBLIC_API_URL` in the environment):

   ```bash
   EXPO_PUBLIC_API_URL=http://YOUR_BACKEND_URL/api/v1
   ```

   Examples:

   - Local: `http://localhost:5000/api/v1`
   - Or base only: `http://192.168.1.100:5000` (app will append `/api/v1`)

3. **Assets (optional)**

   If you see missing asset errors, add under `mobile/assets/`:

   - `icon.png` (1024×1024)
   - `splash-icon.png`
   - `adaptive-icon.png` (Android)
   - `favicon.png` (web)

   Or run once: `npx expo install` and use Expo defaults.

4. **Run**

   ```bash
   npx expo start
   ```

   Then press `i` for iOS simulator or `a` for Android emulator, or scan the QR code with Expo Go on a device. Ensure the device and backend are on the same network (or use a tunnel) and that `EXPO_PUBLIC_API_URL` points to the reachable backend.

## Tech stack

- **Expo** (SDK 52) with **expo-router** (file-based routing)
- **React Native** + **TypeScript**
- **Zustand** (auth state, persisted with AsyncStorage)
- **Axios** (API client; teacher refresh-token handling)
- **expo-secure-store** (optional token storage)

## Backend

Uses the same REST API as the web app:

- Teacher: `POST /auth/login` (body: `email`, `password`, `portal: "teacher"`), then `Authorization: Bearer <token>` for `/classes`, `/homework`, `/exams`, `/timetable`, `/transport`, `/auth/me`, `/auth/change-password`, etc.
- Student: `POST /auth/student/login` (body: `identifier`, `password`), then Bearer token for `/fees/student/me`, `/homework/student`, `/exams/student/results`, `/timetable?...`, `/auth/student/me`, `/auth/student/update-credentials`.

No backend changes required; ensure CORS allows the app origin if needed.
