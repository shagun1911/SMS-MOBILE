import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotification } from "@/contexts/NotificationContext";

const APP_ICON = require("../assets/icon.png");
const BANNER_HEIGHT = 80;
const AUTO_DISMISS_MS = 5000;

export default function InAppNotificationBanner() {
  const { current, dismiss, unreadCount } = useNotification();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + 60))).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const slideRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (current) {
      // Reset progress
      progressAnim.setValue(1);

      // Slide in
      if (slideRef.current) slideRef.current.stop();
      slideRef.current = Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      });
      slideRef.current.start();

      // Start countdown progress bar
      if (progressRef.current) progressRef.current.stop();
      progressRef.current = Animated.timing(progressAnim, {
        toValue: 0,
        duration: AUTO_DISMISS_MS,
        useNativeDriver: false,
      });
      progressRef.current.start();
    } else {
      // Slide out
      if (slideRef.current) slideRef.current.stop();
      if (progressRef.current) progressRef.current.stop();
      slideRef.current = Animated.timing(translateY, {
        toValue: -(BANNER_HEIGHT + 60),
        duration: 280,
        useNativeDriver: true,
      });
      slideRef.current.start();
    }
  }, [current?.id]);

  const topOffset =
    Platform.OS === "android"
      ? (StatusBar.currentHeight ?? 24) + 8
      : insets.top + 8;

  return (
    <Animated.View
      pointerEvents={current ? "box-none" : "none"}
      style={[
        styles.wrapper,
        { top: topOffset, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={dismiss}
      >
        {/* App Icon */}
        <View style={styles.iconWrap}>
          <Image source={APP_ICON} style={styles.appIcon} resizeMode="cover" />
          {/* Red badge — LinkedIn-style unread count */}
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {Math.min(unreadCount, 99)}
              </Text>
            </View>
          )}
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {current?.title ?? ""}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {current?.body ?? ""}
          </Text>
        </View>

        {/* Close */}
        <TouchableOpacity
          style={styles.closeBtn}
          hitSlop={12}
          onPress={dismiss}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Progress bar */}
      <Animated.View
        style={[
          styles.progressBar,
          {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    backgroundColor: "#1a2236",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: BANNER_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  iconWrap: {
    position: "relative",
  },
  appIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#e03030",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#1a2236",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  body: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
  },
  progressBar: {
    height: 3,
    backgroundColor: "#0a66c2",
    borderRadius: 2,
    marginTop: 4,
    alignSelf: "flex-start",
  },
});
