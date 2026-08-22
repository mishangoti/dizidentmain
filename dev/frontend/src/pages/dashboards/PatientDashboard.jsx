// src/pages/dashboards/PatientDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config";
import { formatDateDMY } from "../../utils/dateFormat";
import PatientOverviewPage from "../patient/PatientOverviewPage";
import PatientBillingPage from "../patient/PatientBillingPage";
import VisitPicker from "../patient/VisitPicker";
import PatientReportsPage from "../patient/PatientReportsPage";
import PatientDocumentsPage from "../patient/PatientDocumentsPage";
import ChatPage from "../chat/ChatPage.jsx";
import ChatBell from "../../components/chat/ChatBell.jsx";
import NotificationPanel from "../../components/chat/NotificationPanel.jsx";
import WowDashLayout from "../../components/layout/WowDashLayout.jsx";

const getInitials = (name) => {
  if (!name) return "U";
  const clean = name.trim().replace(/^(dr|dr\.)\s+/i, "");
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
};

export default function PatientDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [patientInfo, setPatientInfo] = useState(null);
  const [visits, setVisits] = useState([]);
  const [visitId, setVisitId] = useState("");
  const [prescription, setPrescription] = useState(null);
  const [billingByVisit, setBillingByVisit] = useState({});
  const [billingLoading, setBillingLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [doctorsById, setDoctorsById] = useState({});
  const [diagnosisByVisit, setDiagnosisByVisit] = useState({});
  const [visitDetails, setVisitDetails] = useState({
    examItems: {},
    treatmentPlans: {},
    loading: false,
  });
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState([]);
  const [unreadEvents, setUnreadEvents] = useState([]);

  const currentUserId = user?.id || user?.userId;

  useEffect(() => {
    const jotformScript = {
      id: "patient-chatbot-jotform",
      src: "https://cdn.jotfor.ms/agent/embedjs/019b4a9ebee879d7884b35d5a3bf3eac5f3d/embed.js",
      host: "jotfor.ms",
    };
    const legacyNoupeScript = {
      id: "patient-chatbot-noupe",
      host: "noupe.com",
    };

    const setIframeVisibility = (host, visible) => {
      document.querySelectorAll(`iframe[src*="${host}"]`).forEach((el) => {
        el.style.display = visible ? "" : "none";
      });
    };

    const removeLegacy = () => {
      document
        .querySelectorAll(`script[src*="${legacyNoupeScript.host}"]`)
        .forEach((el) => el.remove());
      setIframeVisibility(legacyNoupeScript.host, false);
    };

    removeLegacy();

    const alreadyLoaded =
      window.__patientChatbotLoaded || document.getElementById(jotformScript.id);

    if (!alreadyLoaded) {
      const tag = document.createElement("script");
      tag.id = jotformScript.id;
      tag.src = jotformScript.src;
      tag.async = true;
      document.body.appendChild(tag);
      window.__patientChatbotLoaded = true;
    }

    setIframeVisibility(jotformScript.host, true);

    return () => {
      setIframeVisibility(jotformScript.host, false);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const loadPatient = async () => {
      try {
        const directRes = await fetch(`${API_BASE_URL}/patients/${currentUserId}`);
        if (directRes.ok) {
          const data = await directRes.json();
          setPatientInfo(data || null);
          return;
        }
        const res = await fetch(`${API_BASE_URL}/patients`);
        const data = await res.json();
        const match = (data || []).find(
          (p) => p.userId === currentUserId || p.id === currentUserId
        );
        setPatientInfo(match || null);
      } catch (err) {
        console.error("Failed to load patient list", err);
        setPatientInfo(null);
      }
    };
    loadPatient();
  }, [currentUserId]);

  useEffect(() => {
    const loadUnreadMessages = async () => {
      if (!currentUserId) return;

      try {
        const [unreadResponse, doctorsResponse, orgsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/chat/unread/by-sender?userId=${currentUserId}`),
          fetch(`${API_BASE_URL}/doctors`),
          fetch(`${API_BASE_URL}/users?role=ORG`)
        ]);

        if (!unreadResponse.ok) return;

        const unreadData = await unreadResponse.json();
        const doctorsData = doctorsResponse.ok ? await doctorsResponse.json() : [];
        const orgsData = orgsResponse.ok ? await orgsResponse.json() : [];

        // Create maps of userId to name
        const userMap = {};
        (doctorsData || []).forEach((d) => {
          const id = String(d.id);
          userMap[id] = d.name || d.mobile || "Doctor";
        });
        (orgsData || []).forEach((a) => {
          const id = String(a.id);
          userMap[id] = a.name || a.mobile || "Org";
        });

        if (Array.isArray(unreadData) && unreadData.length > 0) {
          const formattedMessages = unreadData.map((item) => {
            const senderId = String(item.senderUserId);
            const senderName = userMap[senderId] || item.senderName || "Unknown User";
            
            return {
              id: item.senderUserId || Math.random(),
              senderName: senderName,
              preview: `${item.count} unread message${item.count > 1 ? "s" : ""}`,
              count: item.count,
            };
          });
          setUnreadMessages(formattedMessages);
        } else {
          setUnreadMessages([]);
        }
      } catch (err) {
        console.error("Failed to load unread messages", err);
      }
    };

    const loadUnreadEvents = async () => {
      if (!currentUserId) return;

      try {
        const eventsResponse = await fetch(
          `${API_BASE_URL}/events?userId=${currentUserId}&role=PATIENT`
        );

        if (!eventsResponse.ok) return;

        const eventsData = await eventsResponse.json();
        
        // Get last seen timestamp from localStorage
        const lastSeenKey = `hms_events_last_seen_${currentUserId}`;
        const lastSeen = localStorage.getItem(lastSeenKey) || "";

        const isEventForUser = (event) => {
          const userIdStr = String(currentUserId);
          const roleName = String(patientInfo?.name || user?.name || "").trim().toLowerCase();
          const candidates = [
            event?.userId,
            event?.recipientUserId,
            event?.targetUserId,
            event?.patientUserId,
            event?.doctorUserId,
            event?.orgUserId,
            event?.assignedDoctorId,
            event?.patientId,
            event?.doctorId,
            event?.orgId,
          ];
          if (candidates.some((value) => value != null && String(value) === userIdStr)) {
            return true;
          }
          if (roleName) {
            return String(event?.patientName || "").trim().toLowerCase() === roleName;
          }
          return false;
        };

        // Filter events that are newer than last seen
        const list = Array.isArray(eventsData) ? eventsData : [];
        const unreadEventsList = list.filter((item) => {
          if (!item?.timestamp || item.timestamp <= lastSeen) return false;
          if (!isEventForUser(item)) return false;
          return true;
        });
        setUnreadEvents(unreadEventsList);
      } catch (err) {
        console.error("Failed to load unread events", err);
      }
    };

    // Only load when notification panel is opened
    if (notificationPanelOpen) {
      loadUnreadMessages();
      loadUnreadEvents();
    }
  }, [notificationPanelOpen, currentUserId]);



  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/doctors`);
        if (!res.ok) throw new Error("Doctors fetch failed");
        const data = await res.json();
        const assignedId =
          patientInfo?.assignedDoctorId ?? patientInfo?.assigned_doctor_id ?? null;
        const list =
          assignedId != null
            ? (data || []).filter(
                (doc) =>
                  String(doc?.id) === String(assignedId) ||
                  String(doc?.userId) === String(assignedId)
              )
            : data || [];
        const map = {};
        (list || []).forEach((doc) => {
          if (doc?.id != null) map[String(doc.id)] = doc.name || doc.fullName || "";
          if (doc?.userId != null) map[String(doc.userId)] = doc.name || doc.fullName || "";
        });
        setDoctorsById(map);
      } catch (err) {
        console.error("Failed to load doctors", err);
        setDoctorsById({});
      }
    };
    loadDoctors();
  }, [patientInfo?.assignedDoctorId, patientInfo?.assigned_doctor_id]);

  useEffect(() => {
    if (!currentUserId) return;
    const loadVisits = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/patients/${currentUserId}/visits`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setVisits(list);
        if (list.length > 0) {
          setVisitId(String(list[0].id));
        }
      } catch (err) {
        console.error("Failed to load visits", err);
        setVisits([]);
      }
    };
    loadVisits();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const loadAppointments = async () => {
      setAppointmentsLoading(true);
      try {
        const today = new Date();
        const from = new Date(today);
        const to = new Date(today);
        from.setDate(from.getDate() - 90);
        to.setDate(to.getDate() + 90);
        const fmt = (d) => d.toISOString().slice(0, 10);
        const res = await fetch(
          `${API_BASE_URL}/appointments/range?from=${fmt(from)}&to=${fmt(to)}`
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const filtered = list.filter(
          (a) => String(a.patientUserId) === String(currentUserId)
        );
        setAppointments(filtered);
      } catch (err) {
        console.error("Failed to load appointments", err);
        setAppointments([]);
      } finally {
        setAppointmentsLoading(false);
      }
    };
    loadAppointments();
  }, [currentUserId]);

  useEffect(() => {
    const shouldLoadRx = location.pathname.includes("/patient/reports");
    if (!visitId || !shouldLoadRx) {
      setPrescription(null);
      return;
    }

    const loadRx = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/visits/${visitId}/prescriptions/latest`
        );
        if (!res.ok) {
          setPrescription(null);
          return;
        }
        const data = await res.json();
        setPrescription(data || null);
      } catch (err) {
        console.error("Failed to load prescription", err);
        setPrescription(null);
      }
    };

    setOverviewLoading(true);
    setOverviewError("");
    Promise.allSettled([loadRx()]).finally(() => setOverviewLoading(false));
  }, [visitId, location.pathname]);

  // Load exam items + treatment plans for all visits (for overview)
  useEffect(() => {
    if (!visits.length) {
      setVisitDetails({ examItems: {}, treatmentPlans: {}, loading: false });
      setDiagnosisByVisit({});
      return;
    }

    const loadAllVisitDetails = async () => {
      setVisitDetails((prev) => ({ ...prev, loading: true }));
      try {
        const examEntries = await Promise.all(
          visits.map(async (v) => {
            try {
              const res = await fetch(`${API_BASE_URL}/visits/${v.id}/exam-items`);
              if (!res.ok) throw new Error("Exam fetch failed");
              const data = await res.json();
              return [String(v.id), Array.isArray(data) ? data : []];
            } catch (err) {
              console.error("Failed to load exam for visit", v.id, err);
              return [String(v.id), []];
            }
          })
        );

        const planEntries = await Promise.all(
          visits.map(async (v) => {
            try {
              const res = await fetch(
                `${API_BASE_URL}/visits/${v.id}/treatment-plan`
              );
              if (!res.ok) throw new Error("Plan fetch failed");
              const data = await res.json();
              return [String(v.id), data || null];
            } catch (err) {
              console.error("Failed to load plan for visit", v.id, err);
              return [String(v.id), null];
            }
          })
        );

        const diagnosisEntries = await Promise.all(
          visits.map(async (v) => {
            try {
              const res = await fetch(
                `${API_BASE_URL}/visits/${v.id}/diagnosis-detail`
              );
              if (!res.ok) throw new Error("Diagnosis fetch failed");
              const data = await res.json();
              return [String(v.id), data || null];
            } catch (err) {
              console.error("Failed to load diagnosis for visit", v.id, err);
              return [String(v.id), null];
            }
          })
        );

        setVisitDetails({
          examItems: Object.fromEntries(examEntries),
          treatmentPlans: Object.fromEntries(planEntries),
          loading: false,
        });
        setDiagnosisByVisit(Object.fromEntries(diagnosisEntries));
      } catch (err) {
        console.error("Error loading visit details", err);
        setVisitDetails({ examItems: {}, treatmentPlans: {}, loading: false });
        setDiagnosisByVisit({});
        setOverviewError((prev) => prev || "Unable to load visit details.");
      }
    };

    loadAllVisitDetails();
  }, [visits]);

  // Load billing for all visits so the payment page can combine them
  useEffect(() => {
    const shouldLoadBilling = location.pathname.includes("/patient/payment");
    if (!visits.length || !shouldLoadBilling) {
      setBillingByVisit({});
      setBillingLoading(false);
      return;
    }

    const loadAllBilling = async () => {
      setBillingLoading(true);
      try {
        const entries = await Promise.all(
          visits.map(async (v) => {
            const vid = String(v.id);
            try {
              const res = await fetch(`${API_BASE_URL}/billing/visits/${vid}`);
              if (!res.ok) {
                return [vid, null];
              }
              const data = await res.json();
              return [vid, data || null];
            } catch (err) {
              console.error("Failed to load billing for visit", vid, err);
              return [vid, null];
            }
          })
        );
        setBillingByVisit(Object.fromEntries(entries));
      } catch (err) {
        console.error("Billing load error", err);
        setBillingByVisit({});
      } finally {
        setBillingLoading(false);
      }
    };

    loadAllBilling();
  }, [visits, location.pathname]);

  const navItems = [
    { type: "link", label: "My Profile", to: "/patient/overview", end: true, icon: "ri-user-line" },
    { type: "link", label: "My Payments", to: "/patient/payment", icon: "ri-wallet-3-line" },
    { type: "link", label: "Appointment Schedule", to: "/patient/schedule", icon: "ri-calendar-2-line" },
    { type: "link", label: "My Medicines", to: "/patient/reports", icon: "ri-capsule-line" },
    { type: "link", label: "My Documents", to: "/patient/mydocuments", icon: "ri-file-text-line" },
    { type: "link", label: "Chat", to: "/patient/chat", icon: "ri-chat-1-line" },
  ];

  return (
    <WowDashLayout
      brandLabel="Patient Portal"
      navItems={navItems}
      onLogout={onLogout}
      searchPlaceholder="Search visits, medicines, payments"
      headerActions={
        <>
        
          <ChatBell
            userId={currentUserId}
            role={user?.role || "PATIENT"}
            onClick={() => setNotificationPanelOpen(!notificationPanelOpen)}
          />
          <div className="d-flex align-items-center gap-2 ms-2">
            <div className="w-40-px h-40-px bg-primary-100 text-primary-600 rounded-circle d-flex justify-content-center align-items-center fw-bold text-md shadow-sm border border-white">
              {getInitials(patientInfo?.name || user?.name || "User")}
            </div>
            <div className="d-flex flex-column text-start">
              <span className="text-xs text-secondary-light" style={{ lineHeight: 1 }}>Hello,</span>
              <span className="fw-semibold text-primary-light text-sm" style={{ lineHeight: 1.2 }}>
                {patientInfo?.name || user?.name || "User"}
              </span>
            </div>
          </div>
        </>
      }
    >
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route
          path="overview"
          element={
            <PatientOverviewPage
              patient={patientInfo}
              visits={visits}
              examItemsByVisit={visitDetails.examItems}
              planByVisit={visitDetails.treatmentPlans}
              diagnosisByVisit={diagnosisByVisit}
              doctorsById={doctorsById}
              loading={overviewLoading || visitDetails.loading}
              error={overviewError}
            />
          }
        />
        <Route
          path="payment"
          element={
            <PatientBillingPage
              patient={patientInfo}
              visits={visits}
              billingByVisit={billingByVisit}
              billingLoading={billingLoading}
            />
          }
        />
        <Route
          path="schedule"
          element={
            <PatientSchedule
              visits={visits}
              visitId={visitId}
              onVisitChange={setVisitId}
              appointments={appointments}
              loading={appointmentsLoading}
            />
          }
        />
        <Route
          path="reports"
          element={
            <PatientReportsPage
              prescription={prescription}
              visits={visits}
              visitId={visitId}
              onVisitChange={setVisitId}
              patient={patientInfo}
            />
          }
        />
        <Route
          path="mydocuments"
          element={
            <PatientDocumentsPage
              patient={patientInfo}
              visitId={visitId}
              patientUserId={currentUserId}
            />
          }
        />
        <Route
          path="chat"
          element={
            <ChatPage
              role="PATIENT"
              currentUser={user}
              assignedDoctorId={
                patientInfo?.assignedDoctorId ?? patientInfo?.assigned_doctor_id
              }
            />
          }
        />
        <Route path="*" element={<Navigate to="/patient/overview" replace />} />
      </Routes>
      <NotificationPanel
        unreadMessages={unreadMessages}
        unreadEvents={unreadEvents}
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        userId={currentUserId}
        role="PATIENT"
      />
    </WowDashLayout>
  );
}

function PatientSchedule({
  visits,
  visitId,
  onVisitChange,
  appointments,
  loading,
}) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const parseDate = (str) => {
    if (!str) return null;
    const clean = String(str).trim().slice(0, 10);
    const parts = clean.split("-");
    if (parts.length < 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return new Date(y, m, d);
  };

  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const getApptDateKey = (appt) => {
    const raw = appt?.date || appt?.appointmentDate;
    const dt = parseDate(raw);
    return dt ? dateKey(dt) : "";
  };

  const todayKey = dateKey(new Date());

  const recentAppointments = useMemo(() => {
    const list = (appointments || []).filter((a) => {
      const key = getApptDateKey(a);
      return key && key < todayKey;
    });
    return list.sort((a, b) => {
      const da = getApptDateKey(a);
      const db = getApptDateKey(b);
      if (da !== db) return db.localeCompare(da);
      return String(a.slot || "").localeCompare(String(b.slot || ""));
    });
  }, [appointments, todayKey]);

  const upcomingAppointments = useMemo(() => {
    const list = (appointments || []).filter((a) => {
      const key = getApptDateKey(a);
      return key && key >= todayKey;
    });
    return list.sort((a, b) => {
      const da = getApptDateKey(a);
      const db = getApptDateKey(b);
      if (da !== db) return da.localeCompare(db);
      return String(a.slot || "").localeCompare(String(b.slot || ""));
    });
  }, [appointments, todayKey]);

  const goToPrevApptMonth = () => {
    const ref = calendarMonth || new Date();
    const all = (appointments || [])
      .map((a) => parseDate(a.date || a.appointmentDate))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();
    const currentKey = monthKey(ref);
    const prev = [...all].reverse().find((d) => monthKey(d) < currentKey);
    const target = prev || all[0];
    if (target) setCalendarMonth(new Date(target.getFullYear(), target.getMonth(), 1));
  };

  const goToNextApptMonth = () => {
    const ref = calendarMonth || new Date();
    const all = (appointments || [])
      .map((a) => parseDate(a.date || a.appointmentDate))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();
    const currentKey = monthKey(ref);
    const next = all.find((d) => monthKey(d) > currentKey);
    const target = next || all[all.length - 1];
    if (target) setCalendarMonth(new Date(target.getFullYear(), target.getMonth(), 1));
  };

  const groupedByDate = useMemo(() => {
    const map = {};
    (appointments || []).forEach((a) => {
      const date = a.date || a.appointmentDate || "Unknown";
      if (!map[date]) map[date] = [];
      map[date].push(a);
    });
    return map;
  }, [appointments]);

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const apptDays = new Set(
    (appointments || [])
      .map((a) => parseDate(a.date || a.appointmentDate))
      .filter(Boolean)
      .map((dt) =>
        dt.getMonth() === month && dt.getFullYear() === year ? dt.getDate() : null
      )
      .filter(Boolean)
  );

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  return (
    <section className="view show">
      <div className="card">
        <div className="card-header border-bottom">
          <h6 className="mb-0 fw-bold text-lg">Appointment Schedule</h6>
        </div>
        <div className="card-body">
          <VisitPicker visits={visits} visitId={visitId} onChange={onVisitChange} />
          <div className="row gy-4 mt-3">
            <div className="col-xxl-7">
              <div className="schedule-section">
                <div className="schedule-section-title">Upcoming appointments</div>
                {loading && (
                  <div className="schedule-empty">Loading appointments.</div>
                )}
                {!loading && upcomingAppointments.length === 0 && (
                  <div className="schedule-empty">No upcoming appointments.</div>
                )}
                <div className="d-flex flex-column gap-3">
                {upcomingAppointments.map((a) => {
                  const dateStr = a.date || a.appointmentDate || "-";
                  const slot = a.slot || a.startTime || "Time TBD";
                  const status = (a.status || "BOOKED").toUpperCase();
                  const statusColor =
                    status.includes("CANCEL")
                      ? "#ef4444"
                      : status.includes("DONE")
                      ? "#16a34a"
                      : "#2563eb";
                  const dt = parseDate(dateStr);
                  const prettyDate = dt ? formatDateDMY(dt) : dateStr;
                  const dayNum = dt ? dt.getDate() : "";
                  const monthStr = dt
                    ? dt.toLocaleString("default", { month: "short" }).toUpperCase()
                    : "";
                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-3 border bg-light"
                      style={{ boxShadow: "0 6px 20px rgba(15,23,42,0.08)" }}
                    >
                      <div className="d-flex justify-content-between align-items-center gap-3">
                        <div className="d-flex gap-3 align-items-center">
                          <div
                            className="text-white d-flex flex-column justify-content-center align-items-center rounded-3"
                            style={{
                              width: 44,
                              height: 44,
                              background: "#1d4ed8",
                              boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
                            }}
                          >
                            <div style={{ fontSize: "0.7rem", opacity: 0.9 }}>
                              {monthStr || "---"}
                            </div>
                            <div style={{ fontSize: "1.1rem", lineHeight: 1 }}>
                              {dayNum || "-"}
                            </div>
                          </div>
                          <div>
                            <div className="fw-semibold">{prettyDate}</div>
                            <div className="text-secondary-light fw-semibold mt-1">
                              {slot} - {a.description || "Scheduled"}
                            </div>
                          </div>
                        </div>
                        <span
                          className="badge rounded-pill"
                          style={{
                            background: `${statusColor}22`,
                            color: statusColor,
                          }}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="text-secondary-light mt-2">
                        Doctor: <strong>{a.doctorName || a.doctor || "-"}</strong> - Visit:{" "}
                        {a.visitId || "-"}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>

              <div className="schedule-section">
                <div className="schedule-section-title">Recent appointments</div>
                {!loading && recentAppointments.length === 0 && (
                  <div className="schedule-empty">No recent appointments.</div>
                )}
                <div className="d-flex flex-column gap-3">
                {recentAppointments.map((a) => {
                  const dateStr = a.date || a.appointmentDate || "-";
                  const slot = a.slot || a.startTime || "Time TBD";
                  const status = (a.status || "BOOKED").toUpperCase();
                  const statusColor =
                    status.includes("CANCEL")
                      ? "#ef4444"
                      : status.includes("DONE")
                      ? "#16a34a"
                      : "#2563eb";
                  const dt = parseDate(dateStr);
                  const prettyDate = dt ? formatDateDMY(dt) : dateStr;
                  const dayNum = dt ? dt.getDate() : "";
                  const monthStr = dt
                    ? dt.toLocaleString("default", { month: "short" }).toUpperCase()
                    : "";
                  return (
                    <div
                      key={`recent-${a.id}`}
                      className="p-3 rounded-3 border bg-light"
                      style={{ boxShadow: "0 6px 20px rgba(15,23,42,0.08)" }}
                    >
                      <div className="d-flex justify-content-between align-items-center gap-3">
                        <div className="d-flex gap-3 align-items-center">
                          <div
                            className="text-white d-flex flex-column justify-content-center align-items-center rounded-3"
                            style={{
                              width: 44,
                              height: 44,
                              background: "#64748b",
                              boxShadow: "0 4px 14px rgba(100,116,139,0.35)",
                            }}
                          >
                            <div style={{ fontSize: "0.7rem", opacity: 0.9 }}>
                              {monthStr || "---"}
                            </div>
                            <div style={{ fontSize: "1.1rem", lineHeight: 1 }}>
                              {dayNum || "-"}
                            </div>
                          </div>
                          <div>
                            <div className="fw-semibold">{prettyDate}</div>
                            <div className="text-secondary-light fw-semibold mt-1">
                              {slot} - {a.description || "Scheduled"}
                            </div>
                          </div>
                        </div>
                        <span
                          className="badge rounded-pill"
                          style={{
                            background: `${statusColor}22`,
                            color: statusColor,
                          }}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="text-secondary-light mt-2">
                        Doctor: <strong>{a.doctorName || a.doctor || "-"}</strong> - Visit:{" "}
                        {a.visitId || "-"}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>

            <div className="col-xxl-5">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() =>
                    setCalendarMonth(
                      (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
                    )
                  }
                >
                  Prev
                </button>
                <div className="fw-semibold">
                  {calendarMonth.toLocaleString("default", { month: "long" })} {year}
                </div>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() =>
                    setCalendarMonth(
                      (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
                    )
                  }
                >
                  Next
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={goToPrevApptMonth}
                  title="Jump to previous appointment month"
                >
                  Prev Appt
                </button>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={goToNextApptMonth}
                  title="Jump to next appointment month"
                >
                  Next Appt
                </button>
              </div>
              <div
                className="p-2 rounded-3 border bg-white patient-appt-calendar"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 6,
                  fontSize: "0.85rem",
                }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="text-secondary-light text-center fw-semibold"
                  >
                    {d}
                  </div>
                ))}
                {calendarCells.map((d, idx) => (
                  <div
                    key={idx}
                    className="d-flex align-items-center justify-content-center rounded-2 patient-appt-calendar__cell"
                    style={{
                      height: 40,
                      background: d && apptDays.has(d) ? "rgba(59,130,246,0.12)" : "#fff",
                      border: d && apptDays.has(d) ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                      color: "#0f172a",
                    }}
                  >
                    {d || ""}
                  </div>
                ))}
              </div>
              {apptDays.size > 0 && (
                <div className="text-secondary-light mt-2">
                  Days highlighted have appointments.
                </div>
              )}
              {groupedByDate && Object.keys(groupedByDate).length > 0 && (
                <div className="text-secondary-light mt-3">
                  {Object.keys(groupedByDate).length} upcoming appointment dates.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
