import { Platform, Text } from "react-native";
import { Redirect, Tabs, Slot } from "expo-router";
import { useStudentAuthStore } from "@/store/studentAuthStore";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{name}</Text>;
}

function NativeTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#4f46e5" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
        tabBarActiveTintColor: "#4f46e5",
        tabBarInactiveTintColor: "#64748b",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => <TabIcon name="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="homework"
        options={{
          title: "Homework",
          tabBarIcon: ({ focused }) => <TabIcon name="📝" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="marks"
        options={{
          title: "Marks",
          tabBarIcon: ({ focused }) => <TabIcon name="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="fees"
        options={{
          title: "Fees",
          tabBarIcon: ({ focused }) => <TabIcon name="💰" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: "Timetable",
          tabBarIcon: ({ focused }) => <TabIcon name="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: ({ focused }) => <TabIcon name="📋" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

export default function StudentLayout() {
  const isAuthenticated = useStudentAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  if (Platform.OS === "web") {
    return <Slot />;
  }

  return <NativeTabsLayout />;
}
