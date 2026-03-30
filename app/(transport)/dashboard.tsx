import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { useRouter } from "expo-router";
import { matchStaffMemberId } from "@/lib/transportStaff";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useRegisterScreenRefresh } from "@/hooks/useRegisterScreenRefresh";

type CrewMember = { _id: string; name: string; phone?: string };

export default function TransportDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchFleet = useCallback(async () => {
    const res = await api.get("/transport");
    const list = res.data?.data ?? res.data ?? [];
    setFleet(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await fetchFleet();
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Unable to load buses.");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchFleet]);

  const pullReload = useCallback(async () => {
    try {
      setError(null);
      await fetchFleet();
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
  }, [fetchFleet, selectedBusId, crewDrivers, crewConductors]);
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
        await fetchFleet();
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
      await api.post(`/transport/${selectedBusId}/students`, { studentIds: ids });
      setSelectedStudentIds({});
      await refreshDetails();
    } catch {
      // ignore basic error handling for now
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
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              logout();
            }}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Buses</Text>
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
                      const onOtherBus = !!s.busId && s.busId !== selectedBusId;
                      const currentBus =
                        onOtherBus && fleet.find((b: any) => b._id === s.busId);

                      return (
                        <TouchableOpacity
                          key={s._id}
                          style={styles.assignRow}
                          activeOpacity={0.8}
                          onPress={() => {
                            if (onOtherBus) return; // must remove from old bus first
                            setSelectedStudentIds((prev) => ({
                              ...prev,
                              [s._id]: !prev[s._id],
                            }));
                          }}
                        >
                          <View style={styles.checkbox}>
                            {selectedStudentIds[s._id] && !onOtherBus && (
                              <View style={styles.checkboxInner} />
                            )}
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#e0f2fe",
    maxWidth: "70%",
  },
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

