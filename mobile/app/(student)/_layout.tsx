import { useState } from "react";
import { Platform, Text } from "react-native";
import { Redirect, Tabs, Link, Slot, usePathname } from "expo-router";
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
    </Tabs>
  );
}

const webNavItems = [
  { label: "Dashboard", href: "/(student)/dashboard", icon: "🏠" },
  { label: "Homework", href: "/(student)/homework", icon: "📝" },
  { label: "Marks", href: "/(student)/marks", icon: "📊" },
  { label: "Fees", href: "/(student)/fees", icon: "💰" },
  { label: "Timetable", href: "/(student)/timetable", icon: "📅" },
  { label: "Profile", href: "/(student)/profile", icon: "👤" },
];

function WebSidebarLayout() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  const rootStyle: React.CSSProperties = {
    display: "flex",
    height: "100vh",
    backgroundColor: "#f1f5f9",
  };

  const sidebarStyle: React.CSSProperties = {
    width: open ? 220 : 72,
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    paddingTop: 20,
    paddingBottom: 16,
    display: "flex",
    flexDirection: "column",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: 12,
    marginBottom: 16,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: "#0f172a",
  };

  const toggleButtonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    padding: "2px 6px",
    backgroundColor: "#e2e8f0",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
  };

  const navItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    marginBottom: 6,
    textDecoration: "none",
  };

  const navItemActiveStyle: React.CSSProperties = {
    backgroundColor: "#eef2ff",
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 20,
    width: 28,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 15,
    color: "#475569",
    marginLeft: 10,
    fontWeight: 500,
  };

  const labelActiveStyle: React.CSSProperties = {
    color: "#4f46e5",
    fontWeight: 600,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
  };

  return (
    <div style={rootStyle}>
      <aside style={sidebarStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>{open ? "Student Portal" : "S"}</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={toggleButtonStyle}
          >
            {open ? "‹" : "›"}
          </button>
        </div>
        <nav>
          {webNavItems.map((item) => {
            const active = pathname === item.href;
            const mergedItemStyle = active
              ? { ...navItemStyle, ...navItemActiveStyle }
              : navItemStyle;
            const mergedLabelStyle = active
              ? { ...labelStyle, ...labelActiveStyle }
              : labelStyle;
            return (
              <Link href={item.href} key={item.href} style={mergedItemStyle}>
                <span style={iconStyle}>{item.icon}</span>
                {open && <span style={mergedLabelStyle}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main style={contentStyle}>
        <Slot />
      </main>
    </div>
  );
}

export default function StudentLayout() {
  const isAuthenticated = useStudentAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  if (Platform.OS === "web") {
    return <WebSidebarLayout />;
  }

  return <NativeTabsLayout />;
}
