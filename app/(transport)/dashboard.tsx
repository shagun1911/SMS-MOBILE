import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { useRouter } from "expo-router";
import { matchStaffMemberId } from "@/lib/transportStaff";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

type CrewMember = { _id: string; name: string; phone?: string };

type UserNotifItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  type: string;
  read: boolean;
};

export default function TransportDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { height: windowHeight } = useWindowDimensions();
  const notifListMaxHeight = Math.min(460, Math.max(220, windowHeight * 0.52));

  const [fleet, setFleet] = useState<any[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optimisticReadIdsRef = useRef<Set<string>>(new Set());
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifItems, setNotifItems] = useState<UserNotifItem[]>([]);

  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busDetails, setBusDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Edit bus/crew state
  const [editMode, setEditMode] = useState(false);
  const [busNumber, setBusNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [routeName, setRouteName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [conductorName, setConductorName] = useState("");
  const [conductorPhone, setConductorPhone] = useState("");
  const [crewDrivers, setCrewDrivers] = useState<CrewMember[]>([]);
  const [crewConductors, setCrewConductors] = useState<CrewMember[]>([]);
  const [driverStaffId, setDriverStaffId] = useState("");
  const [conductorStaffId, setConductorStaffId] = useState("");
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [showConductorPicker, setShowConductorPicker] = useState(false);

  // Assign/unassign students
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});
  const [assigning, setAssigning] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  // Add school bus (transport manager)
  const [addBusOpen, setAddBusOpen] = useState(false);
  const [addBusSaving, setAddBusSaving] = useState(false);
  const [newBusNumber, setNewBusNumber] = useState("");
  const [newRegistration, setNewRegistration] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [newCapacity, setNewCapacity] = useState("");
  const [newDriverStaffId, setNewDriverStaffId] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newConductorStaffId, setNewConductorStaffId] = useState("");
  const [newConductorName, setNewConductorName] = useState("");
  const [newConductorPhone, setNewConductorPhone] = useState("");
  const [addBusCrewDrivers, setAddBusCrewDrivers] = useState<CrewMember[]>([]);
  const [addBusCrewConductors, setAddBusCrewConductors] = useState<CrewMember[]>([]);
  const [addBusStudents, setAddBusStudents] = useState<any[]>([]);
  const [addBusStudentSearch, setAddBusStudentSearch] = useState("");
  const [addBusSelectedStudents, setAddBusSelectedStudents] = useState<Record<string, boolean>>({});
  const [showAddDriverPicker, setShowAddDriverPicker] = useState(false);
  const [showAddConductorPicker, setShowAddConductorPicker] = useState(false);

  const normalizeNotifications = useCallback((list: any[]): UserNotifItem[] => {
    const out: UserNotifItem[] = [];
    for (const n of list) {
      const id = String(n._id ?? n.id ?? "");
      if (!id) continue;
      const serverRead = n.isRead === true || n.read === true;
      if (serverRead) optimisticReadIdsRef.current.delete(id);
      const read = serverRead || optimisticReadIdsRef.current.has(id);
      out.push({
        id,
        title: String(n.title ?? "Notification"),
        message: String(n.message ?? ""),
        createdAt: String(n.createdAt ?? new Date().toISOString()),
        type: String(n.type ?? "general"),
        read,
      });
    }
    return out;
  }, []);

  const loadHome = useCallback(async () => {
    const res = await api.get("/transport");
    const list = res.data?.data ?? res.data ?? [];
    setFleet(Array.isArray(list) ? list : []);

    try {
      const salRes = await api.get("/salaries/my/history");
      const sd = salRes.data?.data ?? salRes.data ?? [];
      setSalaryRecords(Array.isArray(sd) ? sd : []);
    } catch {
      setSalaryRecords([]);
    }

    try {
      setNotifLoading(true);
      setNotifError(null);
      const nRes = await api.get("/user-notifications");
      const nd = nRes.data?.data ?? nRes.data ?? [];
      setNotifItems(normalizeNotifications(Array.isArray(nd) ? nd : []).slice(0, 50));
    } catch (e: any) {
      setNotifError(e?.response?.data?.message ?? "Unable to load notifications.");
    } finally {
      setNotifLoading(false);
    }
  }, [normalizeNotifications]);

  useEffect(() => {
    optimisticReadIdsRef.current.clear();
  }, [user?._id]);

  const unreadNotifCount = useMemo(
    () => notifItems.filter((n) => !n.read).length,
    [notifItems]
  );
  const unreadNotifItems = useMemo(
    () => notifItems.filter((n) => !n.read),
    [notifItems]
  );

  const latestSalary = salaryRecords[0] ?? null;
  const fmtInr = (n: number) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadHome();
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Unable to load buses.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadHome]);

  const pullReload = useCallback(async () => {
    try {
      setError(null);
      await loadHome();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Unable to load buses.");
    }
    if (selectedBusId) {
      try {
        const res = await api.get(`/transport/${selectedBusId}/details`);
        const payload = res.data?.data ?? res.data;
        setBusDetails(payload);
        const b = payload?.bus;
        if (b) {
          setDriverStaffId(
            b.driverUserId
              ? String(b.driverUserId)
              : matchStaffMemberId(crewDrivers, b.driverName, b.driverPhone)
          );
          setConductorStaffId(
            b.conductorUserId
              ? String(b.conductorUserId)
              : matchStaffMemberId(crewConductors, b.conductorName, b.conductorPhone)
          );
          setBusNumber(b.busNumber ?? "");
          setRegistrationNumber(b.registrationNumber ?? "");
          setRouteName(b.routeName ?? "");
          setCapacity(b.capacity != null ? String(b.capacity) : "");
          setDriverName(b.driverName ?? "");
          setDriverPhone(b.driverPhone ?? "");
          setConductorName(b.conductorName ?? "");
          setConductorPhone(b.conductorPhone ?? "");
        }
      } catch {
        // keep prior details
      }
    }
  }, [loadHome, selectedBusId, crewDrivers, crewConductors]);
  useRegisterScreenRefresh(pullReload);

  const mapCrew = (list: any[]): CrewMember[] =>
    (Array.isArray(list) ? list : []).map((u) => ({
      _id: String(u._id),
      name: u.name ?? "",
      phone: u.phone,
    }));

  const openDetails = async (id: string) => {
    setSelectedBusId(id);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);
    setEditMode(false);
    try {
      const [detailRes, crewRes] = await Promise.all([
        api.get(`/transport/${id}/details`),
        api.get(`/transport/crew-options`),
      ]);
      const payload = detailRes.data?.data ?? detailRes.data;
      const crew = crewRes.data?.data ?? crewRes.data;
      const drivers = mapCrew(crew?.drivers ?? []);
      const conductors = mapCrew(crew?.conductors ?? []);
      setCrewDrivers(drivers);
      setCrewConductors(conductors);
      setBusDetails(payload);
      const b = payload?.bus;
      if (b) {
        setBusNumber(b.busNumber ?? "");
        setRegistrationNumber(b.registrationNumber ?? "");
        setRouteName(b.routeName ?? "");
        setCapacity(b.capacity != null ? String(b.capacity) : "");
        setDriverName(b.driverName ?? "");
        setDriverPhone(b.driverPhone ?? "");
        setConductorName(b.conductorName ?? "");
        setConductorPhone(b.conductorPhone ?? "");
        setDriverStaffId(
          b.driverUserId
            ? String(b.driverUserId)
            : matchStaffMemberId(drivers, b.driverName, b.driverPhone)
        );
        setConductorStaffId(
          b.conductorUserId
            ? String(b.conductorUserId)
            : matchStaffMemberId(conductors, b.conductorName, b.conductorPhone)
        );
      }
    } catch (e: any) {
      setDetailsError(e?.response?.data?.message ?? "Unable to load bus details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const bus = busDetails?.bus;
  const students: any[] = Array.isArray(busDetails?.students) ? busDetails.students : [];

  // Load all students once modal is open (for assigning)
  useEffect(() => {
    if (!detailsOpen) return;
    (async () => {
      try {
        setStudentsLoading(true);
        const res = await api.get("/students", { params: { limit: 200 } });
        const list = res.data?.data ?? res.data ?? [];
        setAllStudents(Array.isArray(list) ? list : []);
      } catch {
        // ignore error; assign list will simply be empty
      } finally {
        setStudentsLoading(false);
      }
    })();
  }, [detailsOpen]);

  const filteredAssignStudents = useMemo(() => {
    const list: any[] = Array.isArray(allStudents) ? allStudents : [];
    const q = assignSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s: any) => {
      const full = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim().toLowerCase();
      return (
        full.includes(q) ||
        String(s.admissionNumber ?? "").toLowerCase().includes(q) ||
        String(s.phone ?? "").toLowerCase().includes(q) ||
        String(s.username ?? "").toLowerCase().includes(q)
      );
    });
  }, [allStudents, assignSearch]);

  const refreshDetails = async () => {
    if (!selectedBusId) return;
    try {
      const res = await api.get(`/transport/${selectedBusId}/details`);
      const payload = res.data?.data ?? res.data;
      setBusDetails(payload);
      const b = payload?.bus;
      if (b) {
        setDriverStaffId(
          b.driverUserId
            ? String(b.driverUserId)
            : matchStaffMemberId(crewDrivers, b.driverName, b.driverPhone)
        );
        setConductorStaffId(
          b.conductorUserId
            ? String(b.conductorUserId)
            : matchStaffMemberId(crewConductors, b.conductorName, b.conductorPhone)
        );
        setBusNumber(b.busNumber ?? "");
        setRegistrationNumber(b.registrationNumber ?? "");
        setRouteName(b.routeName ?? "");
        setCapacity(b.capacity != null ? String(b.capacity) : "");
        setDriverName(b.driverName ?? "");
        setDriverPhone(b.driverPhone ?? "");
        setConductorName(b.conductorName ?? "");
        setConductorPhone(b.conductorPhone ?? "");
      }
    } catch {
      // ignore
    }
  };

  const handleSaveBus = async () => {
    if (!selectedBusId || !bus) return;
    try {
      setDetailsLoading(true);
      await api.put(`/transport/${selectedBusId}`, {
        busNumber: busNumber?.trim() || bus.busNumber,
        registrationNumber: registrationNumber?.trim() || bus.registrationNumber,
        routeName: routeName?.trim() || bus.routeName,
        capacity: capacity ? Number(capacity) : bus.capacity,
        driverName: driverName?.trim() || "",
        driverPhone: driverPhone?.trim() || "",
        conductorName: conductorName?.trim() || "",
        conductorPhone: conductorPhone?.trim() || "",
        driverUserId: driverStaffId || "",
        conductorUserId: conductorStaffId || "",
      });
      await refreshDetails();
      try {
        await loadHome();
      } catch {
        // grid may be stale until next open
      }
      setEditMode(false);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        "Could not save bus details.";
      Alert.alert("Cannot save", String(msg));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAssignSelected = async () => {
    if (!selectedBusId) return;
    const ids = Object.entries(selectedStudentIds)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) return;
    try {
      setAssigning(true);
      // Backend sets busId in one shot (moves off any previous bus).
      await api.post(`/transport/${selectedBusId}/students`, { studentIds: ids });
      setSelectedStudentIds({});
      await refreshDetails();
      try {
        const res = await api.get("/students", { params: { limit: 200 } });
        const list = res.data?.data ?? res.data ?? [];
        setAllStudents(Array.isArray(list) ? list : []);
      } catch {
        /* list may be stale until next open */
      }
      try {
        await loadHome();
      } catch {
        /* fleet cards optional */
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.message ?? "Could not assign students.";
      Alert.alert("Assign failed", String(msg));
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (studentId: string) => {
    if (!selectedBusId) return;
    try {
      setUnassigningId(studentId);
      await api.delete(`/transport/${selectedBusId}/students`, {
        data: { studentIds: [studentId] },
      });
      await refreshDetails();
    } catch {
      // ignore
    } finally {
      setUnassigningId(null);
    }
  };

  const filteredAddBusStudents = useMemo(() => {
    const list: any[] = Array.isArray(addBusStudents) ? addBusStudents : [];
    const q = addBusStudentSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s: any) => {
      const full = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim().toLowerCase();
      return (
        full.includes(q) ||
        String(s.admissionNumber ?? "").toLowerCase().includes(q) ||
        String(s.phone ?? "").toLowerCase().includes(q) ||
        String(s.username ?? "").toLowerCase().includes(q)
      );
    });
  }, [addBusStudents, addBusStudentSearch]);

  const openAddBusModal = useCallback(async () => {
    setNewBusNumber("");
    setNewRegistration("");
    setNewRoute("");
    setNewCapacity("");
    setNewDriverStaffId("");
    setNewDriverName("");
    setNewDriverPhone("");
    setNewConductorStaffId("");
    setNewConductorName("");
    setNewConductorPhone("");
    setAddBusStudentSearch("");
    setAddBusSelectedStudents({});
    setShowAddDriverPicker(false);
    setShowAddConductorPicker(false);
    setAddBusOpen(true);
    try {
      const [crewRes, stuRes] = await Promise.all([
        api.get("/transport/crew-options"),
        api.get("/students", { params: { limit: 400 } }),
      ]);
      const crew = crewRes.data?.data ?? crewRes.data;
      setAddBusCrewDrivers(mapCrew(crew?.drivers ?? []));
      setAddBusCrewConductors(mapCrew(crew?.conductors ?? []));
      const sl = stuRes.data?.data ?? stuRes.data ?? [];
      setAddBusStudents(Array.isArray(sl) ? sl : []);
    } catch {
      setAddBusCrewDrivers([]);
      setAddBusCrewConductors([]);
      setAddBusStudents([]);
    }
  }, []);

  const submitAddBus = useCallback(async () => {
    const bn = newBusNumber.trim();
    const reg = newRegistration.trim();
    const route = newRoute.trim();
    const cap = Number(String(newCapacity).replace(/[^\d]/g, "")) || 0;
    if (!bn || !reg || !route || cap < 1) {
      Alert.alert(
        "Missing information",
        "Enter bus number, registration, route name, and capacity (at least 1)."
      );
      return;
    }
    setAddBusSaving(true);
    try {
      const payload: Record<string, unknown> = {
        busNumber: bn,
        registrationNumber: reg,
        routeName: route,
        capacity: cap,
        isActive: true,
        driverName: newDriverName.trim(),
        driverPhone: newDriverPhone.trim(),
        conductorName: newConductorName.trim(),
        conductorPhone: newConductorPhone.trim(),
      };
      if (newDriverStaffId) payload.driverUserId = newDriverStaffId;
      if (newConductorStaffId) payload.conductorUserId = newConductorStaffId;
      const res = await api.post("/transport", payload);
      const created = res.data?.data ?? res.data;
      const busId = created?._id != null ? String(created._id) : "";
      const stuIds = Object.entries(addBusSelectedStudents)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (busId && stuIds.length > 0) {
        await api.post(`/transport/${busId}/students`, { studentIds: stuIds });
      }
      setAddBusOpen(false);
      await loadHome();
      Alert.alert(
        "Bus added",
        stuIds.length ? `${stuIds.length} student(s) assigned to this bus.` : "Vehicle created successfully."
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Try again.";
      Alert.alert("Could not add bus", String(msg));
    } finally {
      setAddBusSaving(false);
    }
  }, [
    newBusNumber,
    newRegistration,
    newRoute,
    newCapacity,
    newDriverName,
    newDriverPhone,
    newConductorName,
    newConductorPhone,
    newDriverStaffId,
    newConductorStaffId,
    addBusSelectedStudents,
    loadHome,
  ]);

  return (
    <RefreshableScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SafeAreaView style={styles.header} edges={["top"]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.profilePill}
            activeOpacity={0.8}
            onPress={() => router.push("/(transport)/profile")}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() ?? "T"}
              </Text>
            </View>
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.title} numberOfLines={1}>
                {user?.name ?? "Transport Manager"}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {user?.email ?? ""}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setNotifOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.iconButtonEmoji}>🔔</Text>
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {Math.min(9, unreadNotifCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                logout();
                router.replace("/");
              }}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
      >
        <Pressable style={styles.notifBackdrop} onPress={() => setNotifOpen(false)}>
          <Pressable style={styles.notifModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.notifModalTitle}>Notifications</Text>
            <Text style={styles.notifModalSub}>Unread messages only.</Text>

            {unreadNotifCount > 0 && (
              <TouchableOpacity
                style={styles.notifMarkAll}
                onPress={() => {
                  setNotifItems((items) => {
                    for (const n of items) {
                      if (!n.read) optimisticReadIdsRef.current.add(n.id);
                    }
                    return items.map((n) => ({ ...n, read: true }));
                  });
                  api.patch("/user-notifications/read-all").catch(() => {});
                }}
              >
                <Text style={styles.notifMarkAllText}>Mark all as read</Text>
              </TouchableOpacity>
            )}

            {notifLoading ? (
              <View style={styles.notifCenter}>
                <ActivityIndicator size="small" color="#0f766e" />
                <Text style={styles.notifCenterText}>Loading…</Text>
              </View>
            ) : notifError ? (
              <View style={styles.notifCenter}>
                <Text style={styles.notifErrText}>{notifError}</Text>
              </View>
            ) : !notifItems.length ? (
              <View style={styles.notifCenter}>
                <Text style={styles.notifEmpty}>No notifications yet.</Text>
              </View>
            ) : unreadNotifItems.length === 0 ? (
              <View style={styles.notifCenter}>
                <Text style={styles.notifEmpty}>You&apos;re all caught up.</Text>
                <Text style={styles.notifEmptySub}>No unread notifications.</Text>
              </View>
            ) : (
              <ScrollView
                style={[styles.notifScroll, { maxHeight: notifListMaxHeight }]}
                contentContainerStyle={styles.notifScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                persistentScrollbar={Platform.OS === "android"}
                indicatorStyle={Platform.OS === "ios" ? "black" : undefined}
              >
                {unreadNotifItems.map((n) => {
                  const dt = new Date(n.createdAt);
                  const dateStr = dt.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const timeStr = dt.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.notifRowItem, styles.notifRowUnread]}
                      activeOpacity={0.8}
                      onPress={() => {
                        optimisticReadIdsRef.current.add(n.id);
                        setNotifItems((items) =>
                          items.map((it) => (it.id === n.id ? { ...it, read: true } : it))
                        );
                        api.patch(`/user-notifications/${n.id}/read`).catch(() => {});
                      }}
                    >
                      <Text style={[styles.notifItemTitle, styles.notifItemTitleUnread]}>
                        {n.title}
                      </Text>
                      {!!n.message && <Text style={styles.notifItemBody}>{n.message}</Text>}
                      <Text style={styles.notifItemMeta}>
                        {dateStr} · {timeStr}
                      </Text>
                      <Text style={styles.notifTapHint}>Tap to mark as read</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <TouchableOpacity
        style={styles.salaryCard}
        activeOpacity={0.8}
        onPress={() => router.push("/(transport)/salary")}
      >
        <Text style={styles.salaryEmoji}>💵</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.salaryCardTitle}>Salary</Text>
          {latestSalary ? (
            <>
              <Text style={styles.salaryCardMonth}>
                {latestSalary.month} {latestSalary.year}
              </Text>
              <Text style={styles.salaryCardLine}>
                Paid {fmtInr(latestSalary.paidAmount ?? 0)} of {fmtInr(latestSalary.netSalary ?? 0)}
                {latestSalary.status === "paid"
                  ? " · Paid"
                  : latestSalary.status === "partial"
                    ? " · Partial"
                    : " · Pending"}
              </Text>
            </>
          ) : (
            <Text style={styles.salaryCardHint}>View disbursements & payment history</Text>
          )}
        </View>
        <Text style={styles.salaryChevron}>›</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Buses</Text>
          <TouchableOpacity style={styles.addBusBtn} onPress={openAddBusModal} activeOpacity={0.85}>
            <Text style={styles.addBusBtnText}>+ Add bus</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : fleet.length === 0 ? (
          <Text style={styles.empty}>No buses added yet.</Text>
        ) : (
          <View style={styles.grid}>
            {fleet.map((b: any) => (
              <TouchableOpacity
                key={b._id}
                style={styles.busCard}
                activeOpacity={0.8}
                onPress={() => openDetails(b._id)}
              >
                <Text style={styles.busLabel}>Bus</Text>
                <Text style={styles.busNumber}>{b.busNumber ?? b.vehicleNumber}</Text>
                <Text style={styles.busMeta}>Reg: {b.registrationNumber ?? "—"}</Text>
                <Text style={styles.busRouteLabel}>Route</Text>
                <Text style={styles.busRoute}>{b.routeName ?? "—"}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Modal
        visible={addBusOpen}
        animationType="slide"
        onRequestClose={() => !addBusSaving && setAddBusOpen(false)}
      >
        <SafeAreaView style={styles.addBusSafe} edges={["top"]}>
          <View style={styles.addBusHeader}>
            <Text style={styles.addBusTitle}>Add school bus</Text>
            <TouchableOpacity
              onPress={() => !addBusSaving && setAddBusOpen(false)}
              hitSlop={12}
              disabled={addBusSaving}
            >
              <Text style={styles.addBusClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.addBusScroll}
            contentContainerStyle={styles.addBusScrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Text style={styles.addBusLabel}>Bus number *</Text>
            <TextInput
              style={styles.addBusInput}
              value={newBusNumber}
              onChangeText={setNewBusNumber}
              placeholder="e.g. MH-01-AB-1234"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              editable={!addBusSaving}
            />
            <Text style={styles.addBusLabel}>Registration number *</Text>
            <TextInput
              style={styles.addBusInput}
              value={newRegistration}
              onChangeText={setNewRegistration}
              placeholder="Registration"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              editable={!addBusSaving}
            />
            <Text style={styles.addBusLabel}>Route name *</Text>
            <TextInput
              style={styles.addBusInput}
              value={newRoute}
              onChangeText={setNewRoute}
              placeholder="Route / destination"
              placeholderTextColor="#94a3b8"
              editable={!addBusSaving}
            />
            <Text style={styles.addBusLabel}>Capacity (seats) *</Text>
            <TextInput
              style={styles.addBusInput}
              value={newCapacity}
              onChangeText={setNewCapacity}
              placeholder="e.g. 40"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              editable={!addBusSaving}
            />

            <Text style={styles.addBusSection}>Driver</Text>
            <TouchableOpacity
              style={styles.addBusPickerRow}
              onPress={() => setShowAddDriverPicker(true)}
              disabled={addBusSaving}
            >
              <Text style={styles.addBusPickerText}>
                {newDriverName ? `${newDriverName}${newDriverPhone ? ` · ${newDriverPhone}` : ""}` : "Select driver (optional)"}
              </Text>
              <Text style={styles.addBusChevron}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.addBusSection}>Conductor</Text>
            <TouchableOpacity
              style={styles.addBusPickerRow}
              onPress={() => setShowAddConductorPicker(true)}
              disabled={addBusSaving}
            >
              <Text style={styles.addBusPickerText}>
                {newConductorName
                  ? `${newConductorName}${newConductorPhone ? ` · ${newConductorPhone}` : ""}`
                  : "Select conductor (optional)"}
              </Text>
              <Text style={styles.addBusChevron}>▼</Text>
            </TouchableOpacity>

            <Text style={styles.addBusSection}>Assign students</Text>
            <Text style={styles.addBusHint}>
              Optional. Students already on another bus can be selected; they are moved to this bus when created. Use search to filter.
            </Text>
            <TextInput
              style={styles.addBusInput}
              value={addBusStudentSearch}
              onChangeText={setAddBusStudentSearch}
              placeholder="Search name, admission no., phone…"
              placeholderTextColor="#94a3b8"
              editable={!addBusSaving}
            />
            <ScrollView
              style={styles.addBusStudentList}
              contentContainerStyle={styles.addBusStudentListContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              bounces={false}
            >
              {filteredAddBusStudents.slice(0, 200).map((s: any) => {
                const sid = String(s._id);
                const onOther = !!s.busId;
                return (
                  <TouchableOpacity
                    key={sid}
                    style={[styles.addBusStudentRow, onOther && styles.addBusStudentRowMuted]}
                    activeOpacity={0.75}
                    onPress={() => {
                      if (addBusSaving) return;
                      setAddBusSelectedStudents((prev) => ({ ...prev, [sid]: !prev[sid] }));
                    }}
                  >
                    <View style={styles.checkbox}>
                      {addBusSelectedStudents[sid] ? <View style={styles.checkboxInner} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addBusStudentName}>
                        {`${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "—"}
                      </Text>
                      <Text style={styles.addBusStudentMeta}>
                        Class {s.class ?? "—"}
                        {s.section ? ` · ${s.section}` : ""} · Adm {s.admissionNumber ?? "—"}
                        {onOther ? " · already on a bus" : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.addBusSubmit, addBusSaving && styles.addBusSubmitDisabled]}
              onPress={submitAddBus}
              disabled={addBusSaving}
            >
              {addBusSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addBusSubmitText}>Create bus</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={detailsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setDetailsOpen(false);
          setEditMode(false);
          setAssignSearch("");
          setSelectedStudentIds({});
          setShowDriverPicker(false);
          setShowConductorPicker(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setDetailsOpen(false);
            setEditMode(false);
            setAssignSearch("");
            setSelectedStudentIds({});
            setShowDriverPicker(false);
            setShowConductorPicker(false);
          }}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            {detailsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#4f46e5" />
              </View>
            ) : detailsError ? (
              <Text style={styles.error}>{detailsError}</Text>
            ) : !bus ? (
              <Text style={styles.error}>No details available.</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: "100%" }}
                contentContainerStyle={{ paddingBottom: 12 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Bus details</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {editMode ? (
                      <>
                        <TouchableOpacity
                          style={[styles.chipButton, styles.chipOutline]}
                          onPress={() => {
                            setEditMode(false);
                            setShowDriverPicker(false);
                            setShowConductorPicker(false);
                            setBusNumber(bus.busNumber ?? "");
                            setRegistrationNumber(bus.registrationNumber ?? "");
                            setRouteName(bus.routeName ?? "");
                            setCapacity(bus.capacity != null ? String(bus.capacity) : "");
                            setDriverName(bus.driverName ?? "");
                            setDriverPhone(bus.driverPhone ?? "");
                            setConductorName(bus.conductorName ?? "");
                            setConductorPhone(bus.conductorPhone ?? "");
                            setDriverStaffId(
                              bus.driverUserId
                                ? String(bus.driverUserId)
                                : matchStaffMemberId(
                                    crewDrivers,
                                    bus.driverName,
                                    bus.driverPhone
                                  )
                            );
                            setConductorStaffId(
                              bus.conductorUserId
                                ? String(bus.conductorUserId)
                                : matchStaffMemberId(
                                    crewConductors,
                                    bus.conductorName,
                                    bus.conductorPhone
                                  )
                            );
                          }}
                        >
                          <Text style={styles.chipOutlineText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.chipButton, styles.chipPrimary]}
                          onPress={handleSaveBus}
                          disabled={detailsLoading}
                        >
                          <Text style={styles.chipPrimaryText}>Save</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={[styles.chipButton, styles.chipOutline]}
                        onPress={() => {
                          setEditMode(true);
                          setBusNumber(bus.busNumber ?? "");
                          setRegistrationNumber(bus.registrationNumber ?? "");
                          setRouteName(bus.routeName ?? "");
                          setCapacity(bus.capacity != null ? String(bus.capacity) : "");
                          setDriverName(bus.driverName ?? "");
                          setDriverPhone(bus.driverPhone ?? "");
                          setConductorName(bus.conductorName ?? "");
                          setConductorPhone(bus.conductorPhone ?? "");
                          setDriverStaffId(
                            bus.driverUserId
                              ? String(bus.driverUserId)
                              : matchStaffMemberId(
                                  crewDrivers,
                                  bus.driverName,
                                  bus.driverPhone
                                )
                          );
                          setConductorStaffId(
                            bus.conductorUserId
                              ? String(bus.conductorUserId)
                              : matchStaffMemberId(
                                  crewConductors,
                                  bus.conductorName,
                                  bus.conductorPhone
                                )
                          );
                        }}
                      >
                        <Text style={styles.chipOutlineText}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {editMode ? (
                  <>
                    <Text style={styles.label}>Bus number</Text>
                    <TextInput
                      style={styles.input}
                      value={busNumber}
                      onChangeText={setBusNumber}
                      placeholder="Bus number"
                    />
                    <Text style={styles.label}>Registration number</Text>
                    <TextInput
                      style={styles.input}
                      value={registrationNumber}
                      onChangeText={setRegistrationNumber}
                      placeholder="Registration number"
                    />
                    <Text style={styles.label}>Route name</Text>
                    <TextInput
                      style={styles.input}
                      value={routeName}
                      onChangeText={setRouteName}
                      placeholder="Route name"
                    />
                    <Text style={styles.label}>Capacity</Text>
                    <TextInput
                      style={styles.input}
                      value={capacity}
                      onChangeText={setCapacity}
                      keyboardType="number-pad"
                      placeholder="Capacity"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.modalLine}>Bus {bus.busNumber}</Text>
                    <Text style={styles.modalLine}>Reg: {bus.registrationNumber ?? "—"}</Text>
                    <Text style={styles.modalLine}>Route: {bus.routeName ?? "—"}</Text>
                  </>
                )}

                <View style={styles.row}>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Driver</Text>
                    {editMode ? (
                      <>
                        <TouchableOpacity
                          style={styles.crewSelect}
                          onPress={() => setShowDriverPicker(true)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.crewSelectText}>
                            {driverStaffId
                              ? (() => {
                                  const m = crewDrivers.find(
                                    (c) => c._id === driverStaffId
                                  );
                                  return m
                                    ? `${m.name}${m.phone ? ` · ${m.phone}` : ""}`
                                    : "Select driver";
                                })()
                              : driverName
                                ? `${driverName} · pick from staff to confirm`
                                : "Select driver"}
                          </Text>
                        </TouchableOpacity>
                        {!crewDrivers.length ? (
                          <Text style={styles.crewHint}>
                            No bus drivers in staff. School admin adds them under
                            Staff.
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text style={styles.infoValue}>{bus.driverName ?? "—"}</Text>
                        <Text style={styles.infoSub}>{bus.driverPhone ?? ""}</Text>
                      </>
                    )}
                  </View>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>Conductor</Text>
                    {editMode ? (
                      <>
                        <TouchableOpacity
                          style={styles.crewSelect}
                          onPress={() => setShowConductorPicker(true)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.crewSelectText}>
                            {conductorStaffId
                              ? (() => {
                                  const m = crewConductors.find(
                                    (c) => c._id === conductorStaffId
                                  );
                                  return m
                                    ? `${m.name}${m.phone ? ` · ${m.phone}` : ""}`
                                    : "Select conductor";
                                })()
                              : conductorName
                                ? `${conductorName} · pick from staff to confirm`
                                : "Select conductor"}
                          </Text>
                        </TouchableOpacity>
                        {!crewConductors.length ? (
                          <Text style={styles.crewHint}>
                            No conductors in staff. School admin adds them under Staff.
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text style={styles.infoValue}>{bus.conductorName ?? "—"}</Text>
                        <Text style={styles.infoSub}>{bus.conductorPhone ?? ""}</Text>
                      </>
                    )}
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                  Students on this bus ({students.length})
                </Text>
                {students.length === 0 ? (
                  <Text style={styles.empty}>No students assigned.</Text>
                ) : (
                  students.map((s: any) => (
                    <View key={s._id} style={styles.studentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>
                          {`${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "—"}
                        </Text>
                        <Text style={styles.studentMeta}>
                          {s.class ? `Class ${s.class}` : "—"}
                          {s.section ? ` · ${s.section}` : ""}
                        </Text>
                        <Text style={styles.studentMeta}>
                          Adm: {s.admissionNumber ?? "—"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.unassignBtn}
                        onPress={() => handleUnassign(s._id)}
                        disabled={unassigningId === s._id}
                      >
                        <Text style={styles.unassignText}>
                          {unassigningId === s._id ? "Removing..." : "Remove"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                  Assign students to this bus
                </Text>
                <Text style={styles.crewHint}>
                  Students on another bus can be selected; they are moved here when you tap Assign selected.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Search by name / admission / phone / username"
                  value={assignSearch}
                  onChangeText={setAssignSearch}
                />
                <TouchableOpacity
                  style={[
                    styles.assignBtn,
                    assigning && { opacity: 0.7 },
                  ]}
                  onPress={handleAssignSelected}
                  disabled={assigning}
                >
                  <Text style={styles.assignText}>
                    {assigning ? "Assigning..." : "Assign selected"}
                  </Text>
                </TouchableOpacity>

                {studentsLoading ? (
                  <View style={styles.center}>
                    <ActivityIndicator size="small" color="#4f46e5" />
                  </View>
                ) : (
                  filteredAssignStudents
                    // Hide students already on THIS bus
                    .filter((s: any) => !students.some((x) => x._id === s._id))
                    .map((s: any) => {
                      const sid = String(s._id);
                      const prevBusId = s.busId != null ? String(s.busId) : "";
                      const onOtherBus =
                        !!prevBusId && prevBusId !== String(selectedBusId ?? "");
                      const currentBus =
                        onOtherBus && fleet.find((b: any) => String(b._id) === prevBusId);

                      return (
                        <TouchableOpacity
                          key={sid}
                          style={styles.assignRow}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedStudentIds((prev) => ({
                              ...prev,
                              [sid]: !prev[sid],
                            }));
                          }}
                        >
                          <View style={styles.checkbox}>
                            {selectedStudentIds[sid] ? (
                              <View style={styles.checkboxInner} />
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.studentName}>
                              {`${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || "—"}
                            </Text>
                            <Text style={styles.studentMeta}>
                              {s.class ? `Class ${s.class}` : "—"}
                              {s.section ? ` · ${s.section}` : ""}
                            </Text>
                            <Text style={styles.studentMeta}>
                              Adm: {s.admissionNumber ?? "—"}
                            </Text>
                            {onOtherBus && (
                              <Text style={styles.onOtherBus}>
                                Currently on bus{" "}
                                {currentBus?.busNumber ??
                                  currentBus?.routeName ??
                                  "another route"}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showDriverPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDriverPicker(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setShowDriverPicker(false)}
        >
          <Pressable
            style={styles.pickerSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.pickerTitle}>Choose driver</Text>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => {
                  setDriverStaffId("");
                  setDriverName("");
                  setDriverPhone("");
                  setShowDriverPicker(false);
                }}
              >
                <Text style={styles.pickerRowMuted}>None (clear)</Text>
              </TouchableOpacity>
              {crewDrivers.map((m) => (
                <TouchableOpacity
                  key={m._id}
                  style={styles.pickerRow}
                  onPress={() => {
                    setDriverStaffId(m._id);
                    setDriverName(m.name);
                    setDriverPhone(m.phone ?? "");
                    setShowDriverPicker(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>
                    {m.name}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showConductorPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConductorPicker(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setShowConductorPicker(false)}
        >
          <Pressable
            style={styles.pickerSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.pickerTitle}>Choose conductor</Text>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => {
                  setConductorStaffId("");
                  setConductorName("");
                  setConductorPhone("");
                  setShowConductorPicker(false);
                }}
              >
                <Text style={styles.pickerRowMuted}>None (clear)</Text>
              </TouchableOpacity>
              {crewConductors.map((m) => (
                <TouchableOpacity
                  key={m._id}
                  style={styles.pickerRow}
                  onPress={() => {
                    setConductorStaffId(m._id);
                    setConductorName(m.name);
                    setConductorPhone(m.phone ?? "");
                    setShowConductorPicker(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>
                    {m.name}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAddDriverPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddDriverPicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowAddDriverPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Choose driver</Text>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => {
                  setNewDriverStaffId("");
                  setNewDriverName("");
                  setNewDriverPhone("");
                  setShowAddDriverPicker(false);
                }}
              >
                <Text style={styles.pickerRowMuted}>None (clear)</Text>
              </TouchableOpacity>
              {addBusCrewDrivers.map((m) => (
                <TouchableOpacity
                  key={m._id}
                  style={styles.pickerRow}
                  onPress={() => {
                    setNewDriverStaffId(m._id);
                    setNewDriverName(m.name);
                    setNewDriverPhone(m.phone ?? "");
                    setShowAddDriverPicker(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>
                    {m.name}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAddConductorPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddConductorPicker(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setShowAddConductorPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Choose conductor</Text>
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => {
                  setNewConductorStaffId("");
                  setNewConductorName("");
                  setNewConductorPhone("");
                  setShowAddConductorPicker(false);
                }}
              >
                <Text style={styles.pickerRowMuted}>None (clear)</Text>
              </TouchableOpacity>
              {addBusCrewConductors.map((m) => (
                <TouchableOpacity
                  key={m._id}
                  style={styles.pickerRow}
                  onPress={() => {
                    setNewConductorStaffId(m._id);
                    setNewConductorName(m.name);
                    setNewConductorPhone(m.phone ?? "");
                    setShowAddConductorPicker(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>
                    {m.name}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 40 },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  profilePill: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    marginRight: 8,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconButton: { padding: 6, position: "relative" },
  iconButtonEmoji: { fontSize: 20 },
  notifBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  notifBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  notifBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  notifModalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    maxHeight: "80%",
  },
  notifModalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  notifModalSub: { fontSize: 12, color: "#64748b", marginTop: 4, marginBottom: 4 },
  notifMarkAll: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ccfbf1",
    marginBottom: 8,
  },
  notifMarkAllText: { fontSize: 11, color: "#0f766e", fontWeight: "600" },
  notifCenter: { paddingVertical: 20, alignItems: "center" },
  notifCenterText: { marginTop: 8, fontSize: 13, color: "#64748b" },
  notifErrText: { fontSize: 12, color: "#b91c1c", textAlign: "center" },
  notifEmpty: { fontSize: 13, color: "#475569", fontWeight: "600", textAlign: "center" },
  notifEmptySub: { fontSize: 12, color: "#94a3b8", marginTop: 6, textAlign: "center" },
  notifScroll: { marginTop: 4 },
  notifScrollContent: { paddingBottom: 8 },
  notifRowItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  notifRowUnread: { backgroundColor: "#f0fdfa", borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 },
  notifItemTitle: { fontSize: 13, color: "#0f172a" },
  notifItemTitleUnread: { fontWeight: "600" },
  notifItemBody: { fontSize: 12, color: "#334155", marginTop: 4 },
  notifItemMeta: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  notifTapHint: { marginTop: 4, fontSize: 10, color: "#0f766e", fontWeight: "600" },
  salaryCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#99f6e4",
    gap: 12,
  },
  salaryEmoji: { fontSize: 28 },
  salaryCardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  salaryCardMonth: { fontSize: 13, color: "#64748b", marginTop: 2 },
  salaryCardLine: { fontSize: 13, fontWeight: "600", color: "#0f766e", marginTop: 4 },
  salaryCardHint: { fontSize: 13, color: "#64748b", marginTop: 4 },
  salaryChevron: { fontSize: 22, color: "#94a3b8", fontWeight: "300" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  logoutText: { color: "#b91c1c", fontWeight: "600", fontSize: 13 },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a", marginBottom: 8 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addBusBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#4f46e5",
  },
  addBusBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  addBusSafe: { flex: 1, backgroundColor: "#fff" },
  addBusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  addBusTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  addBusClose: { fontSize: 22, color: "#64748b", padding: 4 },
  addBusScroll: { flex: 1 },
  addBusScrollContent: { padding: 16, paddingBottom: 32 },
  addBusLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 6 },
  addBusInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    marginBottom: 14,
    backgroundColor: "#f8fafc",
  },
  addBusSection: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 4,
    marginBottom: 8,
  },
  addBusPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: "#f8fafc",
  },
  addBusPickerText: { fontSize: 14, color: "#0f172a", flex: 1 },
  addBusChevron: { fontSize: 10, color: "#94a3b8", marginLeft: 8 },
  addBusHint: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  /** Fixed height so nested ScrollView gets a bounded viewport (scrolls inside the list). */
  addBusStudentList: {
    height: 240,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  addBusStudentListContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  addBusStudentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  addBusStudentRowMuted: { opacity: 0.45 },
  addBusStudentName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  addBusStudentMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  addBusSubmit: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    alignItems: "center",
  },
  addBusSubmitDisabled: { opacity: 0.55 },
  addBusSubmitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  center: { paddingVertical: 24, alignItems: "center", justifyContent: "center" },
  error: { color: "#b91c1c", fontSize: 14 },
  empty: { color: "#6b7280", fontSize: 14, paddingVertical: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  busCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  busLabel: { fontSize: 12, color: "#64748b" },
  busNumber: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  busMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  busRouteLabel: { fontSize: 11, color: "#9ca3af", marginTop: 8 },
  busRoute: { fontSize: 14, color: "#111827", fontWeight: "500" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalCard: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalLine: { fontSize: 14, color: "#4b5563", marginTop: 2 },
  row: { flexDirection: "row", gap: 12, marginTop: 14 },
  infoBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    backgroundColor: "#f9fafb",
  },
  infoLabel: { fontSize: 12, color: "#6b7280" },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#111827", marginTop: 2 },
  infoSub: { fontSize: 12, color: "#4b5563", marginTop: 2 },
  crewSelect: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 6,
    backgroundColor: "#f9fafb",
  },
  crewSelectText: { fontSize: 13, color: "#111827" },
  crewHint: { fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 15 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: "55%",
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  pickerRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerRowText: { fontSize: 16, color: "#0f172a" },
  pickerRowMuted: { fontSize: 16, color: "#64748b" },
  studentRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  studentName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  studentMeta: { fontSize: 12, color: "#6b7280" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: "#f9fafb",
  },
  label: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
  },
  chipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipOutline: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  chipOutlineText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  chipPrimary: {
    backgroundColor: "#4f46e5",
  },
  chipPrimaryText: {
    fontSize: 13,
    color: "#ffffff",
    fontWeight: "600",
  },
  unassignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  unassignText: {
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "600",
  },
  assignBtn: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#4f46e5",
    alignItems: "center",
  },
  assignText: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
  assignRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#9ca3af",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: "#4f46e5",
  },
  alreadyHere: {
    fontSize: 11,
    color: "#16a34a",
    marginTop: 2,
  },
  onOtherBus: {
    fontSize: 11,
    color: "#ea580c",
    marginTop: 2,
  },
});

