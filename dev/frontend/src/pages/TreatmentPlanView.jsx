// src/pages/TreatmentPlanView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Odontogram from "../components/odontogram/Odontogram.jsx";
import BillingInvoice from "../components/billing/BillingInvoice.jsx";
import DentalConsent from "../components/print/DentalConsent.jsx";
import PostOperativeGuide from "../components/print/PostOperativeGuide.jsx";
import ExamTreatmentSummary from "../components/print/ExamTreatmentSummary.jsx";
import "../components/print/print-common.css";
import { API_BASE } from "../config";
import { formatDateDMY } from "../utils/dateFormat";

// Human friendly tooth/segment phrase (matches Examination & Diagnosis tone)
const formatTeethPhrase = (teeth = []) => {
  const list = (teeth || []).filter(Boolean).map(String);
  if (!list.length) return "";

  const sorted = [...list].sort();
  const asSet = new Set(sorted);
  const matches = (expected) =>
    expected.length === sorted.length &&
    expected.every((t) => asSet.has(String(t)));
  const segments = [
    { teeth: ["11", "12", "13", "14", "15", "16", "17", "18"], label: "upper left segment" },
    { teeth: ["21", "22", "23", "24", "25", "26", "27", "28"], label: "upper right segment" },
    { teeth: ["31", "32", "33", "34", "35", "36", "37", "38"], label: "lower left segment" },
    { teeth: ["41", "42", "43", "44", "45", "46", "47", "48"], label: "lower right segment" },
    {
      teeth: [
        "11", "12", "13", "14", "15", "16", "17", "18",
        "21", "22", "23", "24", "25", "26", "27", "28",
        "31", "32", "33", "34", "35", "36", "37", "38",
        "41", "42", "43", "44", "45", "46", "47", "48",
      ],
      label: "full mouth",
    },
    { teeth: ["51", "52", "53", "54", "55"], label: "upper left segment (primary)" },
    { teeth: ["61", "62", "63", "64", "65"], label: "upper right segment (primary)" },
    { teeth: ["71", "72", "73", "74", "75"], label: "lower left segment (primary)" },
    { teeth: ["81", "82", "83", "84", "85"], label: "lower right segment (primary)" },
    {
      teeth: [
        "51", "52", "53", "54", "55",
        "61", "62", "63", "64", "65",
        "71", "72", "73", "74", "75",
        "81", "82", "83", "84", "85",
      ],
      label: "full mouth (primary)",
    },
  ];

  // Exact segment
  const seg = segments.find((s) => matches(s.teeth));
  if (seg) return seg.label;

  const coverage = [];
  let remaining = new Set(sorted);
  segments.forEach((s) => {
    if (s.teeth.every((t) => remaining.has(String(t)))) {
      coverage.push(s.label);
      s.teeth.forEach((t) => remaining.delete(String(t)));
    }
  });

  const rem = Array.from(remaining);
  const parts = [];
  if (coverage.length) parts.push(...coverage);
  if (rem.length === 1) parts.push(`tooth ${rem[0]}`);
  else if (rem.length === 2) parts.push(`teeth ${rem[0]} and ${rem[1]}`);
  else if (rem.length > 2) {
    const last = rem.pop();
    parts.push(`teeth ${rem.join(", ")} and ${last}`);
  }

  if (parts.length === 1) return parts[0];
  if (parts.length > 1) {
    const last = parts.pop();
    return `${parts.join(", ")} and ${last}`;
  }

  if (list.length === 1) return `tooth ${list[0]}`;
  if (list.length === 2) return `teeth ${list[0]} and ${list[1]}`;
  const last = list[list.length - 1];
  return `teeth ${list.slice(0, -1).join(", ")} and ${last}`;
};

const areTeethEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i]) !== String(b[i])) return false;
  }
  return true;
};

function getSelectedPatientIdFromCookie() {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie || "";
  const parts = cookie.split(";").map((c) => c.trim());
  const found = parts.find((c) => c.startsWith("selectedPatientId="));
  if (!found) return null;
  return decodeURIComponent(found.split("=")[1]);
}

export default function TreatmentPlanView() {
  const [patientUserId, setPatientUserId] = useState(null);
  const [patientInfo, setPatientInfo] = useState(null);
  const [visits, setVisits] = useState([]);
  const [visitId, setVisitId] = useState("");

  const [odoMode, setOdoMode] = useState("adult");
  const [cariesTeeth, setCariesTeeth] = useState([]);
  const [selectedTeeth, setSelectedTeeth] = useState([]); // current odontogram context (caries or active procedure)
  const [cariesText, setCariesText] = useState("");
  const [selectedProcedures, setSelectedProcedures] = useState({});
  const [procedureTeeth, setProcedureTeeth] = useState({});
  const [procedureNotes, setProcedureNotes] = useState({});
  const [procedureBillLines, setProcedureBillLines] = useState({});
  const [procedurePrices, setProcedurePrices] = useState({});
  const [procedureSaved, setProcedureSaved] = useState({});
  const [procedureEditing, setProcedureEditing] = useState({});
  const [othersText, setOthersText] = useState("");
  const [description, setDescription] = useState("");
  const [billLines, setBillLines] = useState([]); // flattened for summary/legacy
  const [billForm, setBillForm] = useState({ description: "", qty: "", price: "" });

  const [canShowDocs, setCanShowDocs] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportType, setReportType] = useState(null);
  const [activeProcedureKey, setActiveProcedureKey] = useState(null); // catKey::item or null for caries
  const [otherProcedureKey, setOtherProcedureKey] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [treatmentCategories, setTreatmentCategories] = useState([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [visitExamItems, setVisitExamItems] = useState([]);
  const [visitTreatmentPlan, setVisitTreatmentPlan] = useState(null);
  const [showExamPreview, setShowExamPreview] = useState(false);
  const lastActiveProcRef = useRef(null);
  const lastTeethRef = useRef([]);
  const autoSelectedCategoryRef = useRef(false);
  const reportPreviewRef = useRef(null);
  const examPreviewRef = useRef(null);

  const selectedTeethLabel = useMemo(
    () =>
      formatTeethPhrase(
        activeProcedureKey ? procedureTeeth[activeProcedureKey] || [] : []
      ),
    [activeProcedureKey, procedureTeeth]
  );

  const activeTeeth = useMemo(
    () =>
      activeProcedureKey ? procedureTeeth[activeProcedureKey] || [] : [],
    [activeProcedureKey, procedureTeeth]
  );

  const activeProcedureInfo = useMemo(() => {
    if (!activeProcedureKey) return null;
    const [catKey, name] = activeProcedureKey.split("::");
    const teeth = procedureTeeth[activeProcedureKey] || [];
    return {
      catKey,
      name,
      teeth,
      teethLabel: formatTeethPhrase(teeth),
    };
  }, [activeProcedureKey, procedureTeeth]);

  const currentBillLines = useMemo(
    () => (activeProcedureKey ? procedureBillLines[activeProcedureKey] || [] : []),
    [activeProcedureKey, procedureBillLines]
  );

  // Load treatment masters from backend
  useEffect(() => {
    const loadMasters = async () => {
      setIsLoadingMasters(true);
      try {
        const res = await fetch(`${API_BASE}/api/masters/treatments`);
        if (!res.ok) throw new Error("Failed to load treatment masters");
        const data = await res.json();
        setTreatmentCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error loading treatment masters", e);
        setTreatmentCategories([]);
      } finally {
        setIsLoadingMasters(false);
      }
    };
    loadMasters();
  }, []);

  // Auto-select first category when loaded
  useEffect(() => {
    if (!treatmentCategories.length) return;
    if (!activeCategory && !autoSelectedCategoryRef.current) {
      setActiveCategory(treatmentCategories[0].key);
      autoSelectedCategoryRef.current = true;
    }
  }, [treatmentCategories, activeCategory]);

  const categoryByKey = useMemo(() => {
    const map = {};
    (treatmentCategories || []).forEach((cat) => {
      if (cat?.key) map[cat.key] = cat;
    });
    return map;
  }, [treatmentCategories]);

  const procedureLookup = useMemo(() => {
    const map = new Map();
    (treatmentCategories || []).forEach((cat) => {
      (cat.procedures || []).forEach((proc) => {
        if (!proc) return;
        if (proc.itemKey) {
          const key = String(proc.itemKey).trim();
          map.set(key, proc);
          map.set(key.toLowerCase(), proc);
          if (cat?.key) {
            map.set(`${cat.key}::${key}`, proc);
            map.set(`${cat.key}::${key}`.toLowerCase(), proc);
          }
        }
        if (proc.id != null) {
          map.set(String(proc.id), proc);
        }
        if (proc.name) {
          const name = String(proc.name).trim();
          map.set(name, proc);
          map.set(name.toLowerCase(), proc);
          if (cat?.key) {
            map.set(`${cat.key}::${name}`, proc);
            map.set(`${cat.key}::${name}`.toLowerCase(), proc);
          }
        }
        if (proc.title) {
          const title = String(proc.title).trim();
          map.set(title, proc);
          map.set(title.toLowerCase(), proc);
        }
      });
    });
    return map;
  }, [treatmentCategories]);

  const resolveProcedureByKey = (key) => {
    if (!key) return null;
    const rawKey = String(key).trim();
    if (!rawKey) return null;
    const itemKey = rawKey.includes("::")
      ? rawKey.split("::").pop().trim()
      : rawKey;
    const match =
      procedureLookup.get(rawKey) ||
      procedureLookup.get(itemKey) ||
      procedureLookup.get(rawKey.toLowerCase()) ||
      procedureLookup.get(itemKey.toLowerCase());
    if (match) return match;
    if (rawKey.includes("::")) {
      const [catKey, name] = rawKey.split("::");
      const cat = categoryByKey[catKey];
      if (cat?.procedures?.length) {
        return (
          cat.procedures.find(
            (p) =>
              String(p.itemKey || "").trim() === name.trim() ||
              String(p.name || "").trim().toLowerCase() ===
                name.trim().toLowerCase() ||
              String(p.title || "").trim().toLowerCase() ===
                name.trim().toLowerCase()
          ) || null
        );
      }
    }
    return null;
  };

  // Sync patient id from cookie
  useEffect(() => {
    const syncFromCookie = () => {
      const pid = getSelectedPatientIdFromCookie();
      setPatientUserId((prev) => {
        if (prev === (pid || null)) return prev;
        return pid || null;
      });
    };
    syncFromCookie();
    const id = setInterval(syncFromCookie, 1500);
    return () => clearInterval(id);
  }, []);

  // Load patient info for header/print
  useEffect(() => {
    if (!patientUserId) {
      setPatientInfo(null);
      return;
    }
    fetch(`${API_BASE}/api/patients`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        const match = (list || []).find(
          (p) =>
            String(p.userId || p.id) === String(patientUserId) ||
            String(p.id) === String(patientUserId)
        );
        setPatientInfo(match || null);
      })
      .catch(() => setPatientInfo(null));
  }, [patientUserId]);

  // helper: auto-create visit
  const ensureVisitForPatient = async (pUserId) => {
    try {
      const res = await fetch(`${API_BASE}/api/patients/${pUserId}/visits/auto-create`, {
        method: "POST",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("Error auto-creating visit", e);
      return null;
    }
  };

  const ensureActiveVisit = async () => {
    if (visitId) return Number(visitId);
    if (!patientUserId) return null;
    const created = await ensureVisitForPatient(patientUserId);
    if (created && created.id) {
      setVisitId(String(created.id));
      setVisits((prev) => {
        const exists = prev.find((v) => v.id === created.id);
        return exists ? prev : [created, ...prev];
      });
      return created.id;
    }
    return null;
  };

  // Load visits
  useEffect(() => {
    if (!patientUserId) {
      setVisits([]);
      setVisitId("");
      return;
    }

    const loadVisits = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/patients/${patientUserId}/visits`);
        if (!res.ok) return;
        let data = await res.json();
        let list = Array.isArray(data) ? data : [];
        if (!list.length) {
          const created = await ensureVisitForPatient(patientUserId);
          if (created) list = [created];
        }
        setVisits(list);
        if (!visitId && list.length) {
          setVisitId(String(list[0].id));
        }
      } catch (e) {
        console.error("Error loading visits", e);
      }
    };
    loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUserId]);

  // Load exam items + treatment plan for selected visit (for print preview)
  useEffect(() => {
    if (!visitId) {
      setVisitExamItems([]);
      setVisitTreatmentPlan(null);
      setShowExamPreview(false);
      return;
    }

    const loadExam = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/visits/${visitId}/exam-items`);
        if (res.ok) {
          const data = await res.json();
          setVisitExamItems(Array.isArray(data) ? data : []);
        } else {
          setVisitExamItems([]);
        }
      } catch {
        setVisitExamItems([]);
      }
    };

    const loadPlan = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/visits/${visitId}/treatment-plan`);
        if (res.ok) {
          const data = await res.json();
          setVisitTreatmentPlan(data);
        } else {
          setVisitTreatmentPlan(null);
        }
      } catch {
        setVisitTreatmentPlan(null);
      }
    };

    loadExam();
    loadPlan();
  }, [visitId]);

  // Load treatment plan per visit
  useEffect(() => {
    if (!visitId) {
      setSelectedTeeth([]);
      setCariesTeeth([]);
      setOdoMode("adult");
      setCariesText("");
      setSelectedProcedures({});
      setProcedureTeeth({});
      setProcedureNotes({});
      setProcedureBillLines({});
      setProcedurePrices({});
      setProcedureSaved({});
      setProcedureEditing({});
      setOthersText("");
      setDescription("");
      setBillLines([]);
      setBillForm({ description: "", qty: "", price: "" });
      setCanShowDocs(false);
      setActiveProcedureKey(null);
      setActiveCategory(null);
      return;
    }

    const loadPlan = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/visits/${visitId}/treatment-plan`);
        if (!res.ok) return;
        const dto = await res.json();
        const p = dto.payload || {};
        const loadedCariesTeeth = Array.isArray(p.selectedTeeth) ? p.selectedTeeth : [];
        const loadedProcedureTeeth = p.procedureTeeth || {};
        const loadedProcedureNotes = p.procedureNotes || {};
        const loadedProcedurePrices = p.procedurePrices || {};
        setOdoMode(p.odontogramMode || "adult");
        setProcedureTeeth(loadedProcedureTeeth);
        setProcedureNotes(loadedProcedureNotes);
        setProcedureBillLines(p.procedureBillLines || {});
        setProcedurePrices(loadedProcedurePrices);
        const loadedProcedures = p.selectedProcedures || {};
        setSelectedProcedures(loadedProcedures);
        setOthersText(p.othersText || "");
        setDescription(p.description || "");
        setBillLines(Array.isArray(p.billLines) ? p.billLines : []);
        setCanShowDocs(true);
        const savedKeys = Object.entries(loadedProcedures)
          .flatMap(([catKey, items]) =>
            (items || []).map((name) => `${catKey}::${name}`)
          );
        if (savedKeys.length) {
          const savedMap = {};
          savedKeys.forEach((k) => {
            savedMap[k] = true;
          });
          setProcedureSaved(savedMap);
          setProcedureEditing((prev) => {
            const next = { ...prev };
            savedKeys.forEach((k) => {
              if (next[k] === undefined) next[k] = false;
            });
            return next;
          });
        } else {
          setProcedureSaved({});
          setProcedureEditing({});
        }
        const firstEntry = Object.entries(loadedProcedures)[0];
        if (firstEntry) {
          const [catKey, items] = firstEntry;
          setActiveProcedureKey(`${catKey}::${items[0]}`);
          setActiveCategory(catKey);
          const procKey = `${catKey}::${items[0]}`;
          const note = loadedProcedureNotes[procKey] || p.cariesText || "";
          const updatedNotes = { ...loadedProcedureNotes, [procKey]: note };
          setProcedureNotes(updatedNotes);
          const t = loadedProcedureTeeth[procKey] || [];
          if (Array.isArray(t) && t.length) {
            setSelectedTeeth(t);
            setCariesTeeth(t);
          } else if (loadedCariesTeeth.length) {
            setSelectedTeeth(loadedCariesTeeth);
            setCariesTeeth(loadedCariesTeeth);
          } else {
            setSelectedTeeth([]);
            setCariesTeeth([]);
          }
          setCariesText(note);
        } else {
          setSelectedTeeth([]);
          setCariesTeeth([]);
          setActiveProcedureKey(null);
          setActiveCategory(null);
        }
      } catch (e) {
        console.error("Error loading treatment plan", e);
      }
    };
    loadPlan();
  }, [visitId]);

  const teethLine = useMemo(() => {
    if (!cariesTeeth.length) return "";
    const label = formatTeethPhrase(cariesTeeth);
    return label ? `Teeth: ${label}` : "";
  }, [cariesTeeth]);

  const treatmentBlock = useMemo(() => {
    const lines = [];
    Object.entries(selectedProcedures).forEach(([catKey, items]) => {
      if (!items || !items.length) return;
      items.forEach((item) => {
        const procKey = `${catKey}::${item}`;
        const note = (procedureNotes[procKey] || "").trim();
        const teethForProc = procedureTeeth[procKey] || [];
        const teethLabel = formatTeethPhrase(teethForProc);
        const parts = [`- ${item}`];
        if (note) parts.push(note);
        if (teethLabel) parts.push(teethLabel);
        lines.push(parts.join(" - "));
      });
    });
    if (othersText.trim()) {
      lines.push(`- Others - ${othersText.trim()}`);
    }
    if (!lines.length) return "";
    return "Treatment Plan:\n" + lines.join("\n");
  }, [selectedProcedures, othersText, procedureTeeth, procedureNotes]);

  const composedDescription = useMemo(() => {
    const parts = [];
    if (description.trim()) parts.push(description.trim());
    if (treatmentBlock) parts.push(treatmentBlock);
    return parts.join("\n\n");
  }, [description, treatmentBlock]);

  useEffect(() => {
    const next = (composedDescription || "").trim();
    window.__treatmentPreview = next;
    window.dispatchEvent(new CustomEvent("treatment-preview", { detail: next }));
  }, [composedDescription]);

  useEffect(() => {
    return () => {
      window.__treatmentPreview = "";
      window.dispatchEvent(new CustomEvent("treatment-preview", { detail: "" }));
    };
  }, []);

  // Keep UI in sync when switching active procedure
  useEffect(() => {
    if (!activeProcedureKey) {
      setCariesText("");
      setSelectedTeeth([]);
      setCariesTeeth([]);
      setBillForm({ description: "", qty: "", price: "" });
      lastActiveProcRef.current = null;
      lastTeethRef.current = [];
      return;
    }
    const note = procedureNotes[activeProcedureKey] || "";
    setCariesText(note);
    const t = procedureTeeth[activeProcedureKey];
    const teethList = Array.isArray(t) ? t : [];
    const keyChanged = lastActiveProcRef.current !== activeProcedureKey;
    const teethChanged = !areTeethEqual(teethList, lastTeethRef.current);
    if (keyChanged || teethChanged) {
      setSelectedTeeth(teethList);
      setCariesTeeth(teethList);
      lastActiveProcRef.current = activeProcedureKey;
      lastTeethRef.current = teethList;
    }
    const existingPrice = procedurePrices[activeProcedureKey];
    setBillForm((prev) => ({
      ...prev,
      description: activeProcedureKey.split("::")[1] || "",
      qty:
        keyChanged || teethChanged
          ? (t && t.length ? t.length : "")
          : prev.qty,
      price: existingPrice != null ? existingPrice : prev.price,
    }));
  }, [activeProcedureKey, procedureNotes, procedureTeeth, procedurePrices]);

  const isProcedureEditing =
    activeProcedureKey == null
      ? true
      : procedureEditing[activeProcedureKey] === undefined
      ? !procedureSaved[activeProcedureKey]
      : procedureEditing[activeProcedureKey];

  const handleOdontoChange = (teeth) => {
    if (activeProcedureKey && !isProcedureEditing) return;
    setSelectedTeeth(teeth);
    setCariesTeeth(teeth);
    if (activeProcedureKey) {
      setProcedureTeeth((prev) => ({
        ...prev,
        [activeProcedureKey]: teeth,
      }));
    }
  };

  const savePlan = async (overrides = {}) => {
    if (!patientUserId) {
      alert("No patient selected.");
      return;
    }
    const numericVisitId = await ensureActiveVisit();
    if (!numericVisitId) {
      alert("No visit selected.");
      return;
    }

    const flatBills = Object.values(procedureBillLines || {}).flatMap((arr) =>
      Array.isArray(arr) ? arr : []
    );

    const payload = {
      odontogramMode: odoMode,
      selectedTeeth:
        overrides.selectedTeeth !== undefined ? overrides.selectedTeeth : cariesTeeth,
      cariesText,
      selectedProcedures,
      procedureTeeth: overrides.procedureTeeth || procedureTeeth,
      procedureNotes: overrides.procedureNotes || procedureNotes,
      procedureBillLines,
      procedurePrices,
      billLines: flatBills,
      othersText,
      description,
      summary: composedDescription,
    };

    try {
      const res = await fetch(
        `${API_BASE}/api/visits/${numericVisitId}/treatment-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      setCanShowDocs(true);
      if (saved.visitId && !visitId) setVisitId(String(saved.visitId));
      alert("Treatment plan saved.");
    } catch (err) {
      console.error(err);
      alert("Error saving treatment plan.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await savePlan();
  };

  const toggleProcedure = (catKey, item) => {
    const procKey = `${catKey}::${item}`;
    const alreadyActive = activeProcedureKey === procKey;

    setActiveProcedureKey(procKey);
    setActiveCategory(catKey);
    setSelectedProcedures((prev) => {
      const existing = prev[catKey] || [];
      const has = existing.includes(item);
      if (has && alreadyActive) {
        const nextItems = existing.filter((x) => x !== item);
        const next = { ...prev };
        if (nextItems.length) next[catKey] = nextItems;
        else delete next[catKey];
        setActiveProcedureKey(null);
        setSelectedTeeth([]);
        setCariesTeeth([]);
        setCariesText("");
        setProcedureSaved((savedPrev) => {
          const copy = { ...savedPrev };
          delete copy[procKey];
          return copy;
        });
        setProcedureEditing((editPrev) => {
          const copy = { ...editPrev };
          delete copy[procKey];
          return copy;
        });
        return next;
      }
      if (has) return prev;
      return { ...prev, [catKey]: [item] };
    });

    setProcedureEditing((prev) => ({
      ...prev,
      [procKey]: true,
    }));
    const note = isSaved ? procedureNotes[procKey] : "";
    setCariesText(note || "");
    const nextTeeth = isSaved
      ? Array.isArray(procedureTeeth[procKey])
        ? procedureTeeth[procKey]
        : []
      : [];
    if (!isSaved) {
      setProcedureNotes((prev) => {
        if (!prev[procKey]) return prev;
        const next = { ...prev };
        delete next[procKey];
        return next;
      });
      setProcedureTeeth((prev) => {
        if (!prev[procKey]) return prev;
        const next = { ...prev };
        delete next[procKey];
        return next;
      });
    }
    setSelectedTeeth(nextTeeth);
    setCariesTeeth(nextTeeth);
    lastActiveProcRef.current = procKey;
    lastTeethRef.current = nextTeeth;
  };

  const handleSaveProcedure = async () => {
    if (!activeProcedureKey) {
      alert("Select a procedure first.");
      return;
    }
    const currentTeeth =
      (selectedTeeth && selectedTeeth.length
        ? selectedTeeth
        : cariesTeeth && cariesTeeth.length
        ? cariesTeeth
        : procedureTeeth[activeProcedureKey]) || [];
    const nextProcedureNotes = {
      ...procedureNotes,
      [activeProcedureKey]: cariesText || "",
    };
    const nextProcedureTeeth = {
      ...procedureTeeth,
      [activeProcedureKey]: currentTeeth,
    };
    if (currentTeeth.length) {
      setSelectedTeeth(currentTeeth);
      setCariesTeeth(currentTeeth);
    }
    setProcedureNotes(nextProcedureNotes);
    setProcedureTeeth(nextProcedureTeeth);
    await savePlan({
      selectedTeeth: [],
      procedureNotes: nextProcedureNotes,
      procedureTeeth: nextProcedureTeeth,
    });
    setProcedureSaved((prev) => ({
      ...prev,
      [activeProcedureKey]: true,
    }));
    setProcedureEditing((prev) => ({
      ...prev,
      [activeProcedureKey]: false,
    }));
  };

  const handleEditProcedure = () => {
    if (!activeProcedureKey) return;
    setProcedureEditing((prev) => ({
      ...prev,
      [activeProcedureKey]: true,
    }));
  };

  const handleAddToBill = () => {
    if (!activeProcedureKey) {
      alert("Select a procedure first.");
      return;
    }
    const qtyNum =
      Number(billForm.qty) ||
      (activeTeeth.length ? activeTeeth.length : 1);
    const priceNum = Number(billForm.price) || 0;
    const newBillLine = {
      description:
        billForm.description ||
        activeProcedureKey.split("::")[1] ||
        "Procedure",
      qty: qtyNum,
      price: priceNum,
      amount: qtyNum * priceNum,
    };
    setProcedurePrices((prev) => ({
      ...prev,
      [activeProcedureKey]: priceNum,
    }));
    setProcedureBillLines((prev) => {
      const existing = prev[activeProcedureKey] || [];
      return {
        ...prev,
        [activeProcedureKey]: [...existing, newBillLine],
      };
    });
    // keep legacy flat state in sync for summary
    setBillLines((prev) => [...prev, newBillLine]);
    setBillForm({ description: "", qty: "", price: "" });
  };

  const handleCategoryChange = (catKey) => {
    setActiveCategory((prev) => {
      const next = prev === catKey ? null : catKey;
      if (!next) {
        setActiveProcedureKey(null);
        setSelectedTeeth([]);
        setCariesTeeth([]);
        setCariesText("");
        return null;
      }

      const savedItems = selectedProcedures[next] || [];
      const firstSaved = savedItems[0];
      const firstMaster = categoryByKey[next]?.procedures?.[0]?.name;
      const procName = firstSaved || firstMaster || null;

      if (!procName) {
        setActiveProcedureKey(null);
        setSelectedTeeth([]);
        setCariesTeeth([]);
        setCariesText("");
        return next;
      }

      const procKey = `${next}::${procName}`;
      setActiveProcedureKey(procKey);
      setProcedureEditing((prevEdit) => ({
        ...prevEdit,
        [procKey]: true,
      }));

      const note = procedureNotes[procKey] || "";
      setCariesText(note);
      const t = procedureTeeth[procKey];
      const teethList = Array.isArray(t) ? t : [];
      setSelectedTeeth(teethList);
      setCariesTeeth(teethList);
      lastActiveProcRef.current = procKey;
      lastTeethRef.current = teethList;

      return next;
    });
  };

  useEffect(() => {
    if (activeCategory !== "others") {
      setOtherProcedureKey(null);
      return;
    }
    const proc = categoryByKey.others?.procedures?.[0];
    if (proc?.name) {
      setOtherProcedureKey(`others::${proc.name}`);
    } else if (proc?.itemKey) {
      setOtherProcedureKey(`others::${proc.itemKey}`);
    } else {
      setOtherProcedureKey(null);
    }
  }, [activeCategory, categoryByKey]);

  const hasAnyTreatment = useMemo(() => {
    if (activeCategory === "others") return true;
    return Object.values(selectedProcedures).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
  }, [selectedProcedures, activeCategory]);

  const buildProcedureRows = (type, selectedKeys = null, allowFallback = false) => {
    const rows = [];
    const keys = selectedKeys?.length
      ? selectedKeys
      : Object.values(selectedProcedures).flat().filter(Boolean);
    if (!keys || keys.length === 0) {
      const othersCat = categoryByKey.others;
      const otherProc = (othersCat?.procedures || []).find((p) =>
        type === "consent" ? p?.consentText : p?.guidelineText
      );
      if (otherProc) {
        rows.push({
          label: otherProc.title || otherProc.name || "Others",
          value:
            type === "consent"
              ? otherProc.consentText
              : otherProc.guidelineText,
        });
        return rows;
      }
      if (othersText && String(othersText).trim()) {
        const label = "Others";
        const fallbackText =
          type === "consent"
            ? `I have read and understood the information and consent to proceed with: ${label}.`
            : `Follow the post-operative instructions for ${label}. Contact the clinic if you experience severe pain, swelling, fever, bleeding, or any concern.`;
        rows.push({
          label,
          value: String(othersText).trim() || fallbackText,
        });
        return rows;
      }
    }
    const uniqueKeys = Array.from(
      new Set(keys.map((k) => String(k || "").trim()).filter(Boolean))
    );
    uniqueKeys.forEach((rawKey) => {
      const fallbackLabel = rawKey.includes("::")
        ? rawKey.split("::").pop().trim()
        : rawKey;
      const match = resolveProcedureByKey(rawKey);
      const label = match?.title || match?.name || fallbackLabel;
      const text = match
        ? type === "consent"
          ? match.consentText
          : match.guidelineText
        : null;
      if (!text && !allowFallback) return;
      const fallbackText =
        type === "consent"
          ? `I have read and understood the information and consent to proceed with: ${label}.`
          : `Follow the post-operative instructions for ${label}. Contact the clinic if you experience severe pain, swelling, fever, bleeding, or any concern.`;
      rows.push({
        label,
        value: text && String(text).trim() ? text : fallbackText,
      });
    });
    return rows;
  };

  const handleConsentPreview = () => {
    if (!hasAnyTreatment) {
      alert("No treatment selected. Please choose at least one treatment.");
      return;
    }
    setShowExamPreview(false);
    const isOthers =
      activeCategory === "others" ||
      (activeProcedureKey && activeProcedureKey.startsWith("others::"));
    const procedureRows = buildProcedureRows(
      "consent",
      isOthers
        ? otherProcedureKey
          ? [otherProcedureKey, otherProcedureKey.split("::")[1]]
          : []
        : activeProcedureKey
        ? [activeProcedureKey, activeProcedureKey.split("::")[1]]
        : null,
      true
    );
    if (!procedureRows.length) {
      alert("Consent text not found for selected treatments.");
      return;
    }
    const today = formatDateDMY(new Date());
    const teethInfo = formatTeethPhrase(cariesTeeth) || "-";
    const patientName = patientInfo?.name || "";
    const ageSex =
      patientInfo?.age != null
        ? `${patientInfo.age} | ${patientInfo.gender || ""}`
        : patientInfo?.gender || "";
    const consentText = procedureRows.map((r) => r.value).join("\n\n");
    const firstProc =
      procedureRows[0]?.label ||
      activeProcedureInfo?.name ||
      Object.values(selectedProcedures).flat().find(Boolean) ||
      "Selected treatments";
    const data = {
      hospital: {
        name: "CLINIC",
        tagline: "Billing Summary",
        address: "",
        contactLine: "",
        regNo: "",
        logo: "/images/logo.png",
      },
      formMeta: {
        title: "Dental Treatment Consent",
        subtitle: "Informed consent for dental procedure",
      },
      patientDetails: {
        patientName: patientName || "Patient",
        uhid: patientUserId || "",
        ageSex: ageSex || "",
        contactNo: patientInfo?.mobile || "",
        address: patientInfo?.city || "",
      },
      procedureDetails: {
        procedureName: firstProc,
        teethInvolved: teethInfo,
        diagnosis: description || cariesText || "As discussed",
        plannedDate: today,
      },
      informedSummary:
        consentText ||
        "I have read and understood the above information and consent to the described treatment.",
      placeDate: { place: "", date: today },
      procedureRows,
    };
    setReportData(data);
    setReportType("consent");
  };

  const handleGuidePreview = () => {
    if (!hasAnyTreatment) {
      alert("No treatment selected. Please choose at least one treatment.");
      return;
    }
    setShowExamPreview(false);
    const isOthers =
      activeCategory === "others" ||
      (activeProcedureKey && activeProcedureKey.startsWith("others::"));
    const procedureRows = buildProcedureRows(
      "guide",
      isOthers
        ? otherProcedureKey
          ? [otherProcedureKey, otherProcedureKey.split("::")[1]]
          : []
        : activeProcedureKey
        ? [activeProcedureKey, activeProcedureKey.split("::")[1]]
        : null,
      true
    );
    if (!procedureRows.length) {
      alert("Post-operative guide text not found for selected treatments.");
      return;
    }
    const today = formatDateDMY(new Date());
    const teethInfo = formatTeethPhrase(cariesTeeth) || "-";
    const patientName = patientInfo?.name || "";
    const ageSex =
      patientInfo?.age != null
        ? `${patientInfo.age} | ${patientInfo.gender || ""}`
        : patientInfo?.gender || "";
    const firstProc =
      procedureRows[0]?.label ||
      activeProcedureInfo?.name ||
      Object.values(selectedProcedures).flat().find(Boolean) ||
      "Selected treatments";
    const guideLines = procedureRows.map((r) => r.value);
    const data = {
      hospital: {
        name: "CLINIC",
        tagline: "Patient Care Guide",
        address: "",
        contactLine: "",
        regNo: "",
        logo: "/images/logo.png",
      },
      formMeta: {
        title: "Post-Operative Guide",
        subtitle: "Instructions after dental treatment",
      },
      patientDetails: {
        patientName: patientName || "Patient",
        uhid: patientUserId || "",
        ageSex: ageSex || "",
        contactNo: patientInfo?.mobile || "",
          treatment: `${firstProc} - ${teethInfo}`,
      },
      guideLines:
        guideLines.length > 0
          ? guideLines
          : [
              "Follow the clinician's instructions carefully.",
              "Contact the clinic immediately if you experience severe pain, swelling, fever, or any concern.",
            ],
    };
    setReportData(data);
    setReportType("guide");
  };

  const handleClosePreview = () => {
    setReportData(null);
    setReportType(null);
  };

  // Auto-scroll to consent/guide preview when it appears
  useEffect(() => {
    if (reportData && reportPreviewRef.current) {
      setTimeout(() => {
        reportPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [reportData]);

  // Auto-scroll to exam preview when it appears
  useEffect(() => {
    if (showExamPreview && examPreviewRef.current) {
      setTimeout(() => {
        examPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [showExamPreview]);

  if (!patientUserId) {
    return (
      <section id="view-treatment" className="view show">
        <div className="page-header">
          <div>
            <h2>Treatment Plan</h2>
            <div className="page-subtitle">Plan procedures, visits, and pricing.</div>
          </div>
        </div>
        <div className="page-body">
          <div className="panel">
            <p>
              No patient selected.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="view-treatment" className="view show">
      <div className="page-header">
        <div>
          <h2>Treatment Plan</h2>
          <div className="page-subtitle">Build visit plans, procedures, and estimates.</div>
        </div>
      </div>

      <div className="page-body">
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="colspan">
          <label>Visit</label>
          <select
            value={visitId}
            onChange={(e) => {
              setVisitId(e.target.value);
              setSelectedTeeth([]);
              setCariesTeeth([]);
              setOdoMode("adult");
              setCariesText("");
              setSelectedProcedures({});
              setProcedureTeeth({});
              setProcedurePrices({});
              setOthersText("");
              setDescription("");
              setBillLines([]);
              setBillForm({ description: "", qty: "", price: "" });
              setCanShowDocs(false);
              setActiveProcedureKey(null);
              setActiveCategory(null);
            }}
          >
            {!visitId && <option value="">-- Select Visit --</option>}
            {visits.map((v) => (
              <option key={v.id} value={v.id}>
                {formatDateDMY(v.visitDate || v.visit_date)}{" "}
                {v.visitType ? `(${v.visitType})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Odontogram + Treatment selection (aligned with Diagnosis layout) */}
        <div className="colspan">
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* Treatment selection (left) */}
            <div
              style={{
                flex: "1 1 320px",
                minWidth: "320px",
                background: "var(--greyLight-1)",
                borderRadius: "1rem",
                padding: "12px",
                boxShadow: "var(--shadow)",
              }}
            >
              <div className="exam-card-head" style={{ marginBottom: 8, fontSize: "0.95rem" }}>
                <strong>Clinical Examination - Treatment Type</strong>
              </div>

              {isLoadingMasters && (
                <div style={{ padding: "8px", color: "#4b587c" }}>
                  Loading treatment master data...
                </div>
              )}
              {!isLoadingMasters && treatmentCategories.length === 0 && (
                <div style={{ padding: "8px", color: "#b94a48" }}>
                  No treatment master data found.
                </div>
              )}

              {/* Category buttons similar to Diagnosis exam grid */}
              <div
                className="exam-grid"
                style={{ marginBottom: 10, maxHeight: 618 }}
              >
                {treatmentCategories.map((cat) => (
                  <React.Fragment key={cat.key}>
                    <button
                      type="button"
                      className={
                        "btn exam-btn" +
                        (activeCategory === cat.key ? " active" : "")
                      }
                      onClick={() => handleCategoryChange(cat.key)}
                    >
                      {cat.title}
                    </button>

                    {activeCategory === cat.key && (
                      <div
                        className="exam-card"
                        style={{
                          marginTop: 8,
                          gridColumn: "1 / -1",
                        }}
                      >
                        {activeCategory !== "others" ? (
                          <>
                            <div style={{ marginBottom: 8, fontWeight: 600 }}>
                              Select procedure
                            </div>
                            <div
                              className="procedure-grid"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                                gap: 8,
                              }}
                            >
                              {(categoryByKey[activeCategory]?.procedures || []).map(
                                (proc) => {
                                  const item = proc.name;
                                  const procKey = `${activeCategory}::${item}`;
                                  const isSaved =
                                    (selectedProcedures[activeCategory] || []).includes(item);
                                  const isActive = activeProcedureKey === procKey;
                                  const classes =
                                    "btn exam-btn" +
                                    (isSaved ? " active" : "") +
                                    (isActive ? " focus" : "");
                                  const style = isActive
                                    ? {
                                        borderColor: "var(--primary)",
                                        boxShadow: "0 0 0 2px rgba(59,130,246,0.25)",
                                      }
                                    : undefined;
                                  return (
                                    <button
                                      key={item}
                                      type="button"
                                      className={classes}
                                      style={style}
                                      onClick={() => toggleProcedure(activeCategory, item)}
                                      title={
                                        isSaved
                                          ? "Saved to plan. Click to edit; click again to remove."
                                          : "Click to select"
                                      }
                                    >
                                      {item}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ marginTop: "8px" }}>
                            <label style={{ fontSize: "12px" }}>
                              Others - Treatment Notes
                            </label>
                            <textarea
                              rows={3}
                              className="exam-text"
                              value={othersText}
                              onChange={(e) => setOthersText(e.target.value)}
                              placeholder="Write other / special procedures here"
                            />
                          </div>
                        )}

                        {/* Procedure Notes + Billing moved here */}
                        <div style={{ marginTop: "12px" }}>
                          <label>Procedure Notes</label>
                          <textarea
                            rows={3}
                            className="exam-text"
                            value={cariesText}
                            onChange={(e) => {
                              if (!isProcedureEditing) return;
                              setCariesText(e.target.value);
                              if (activeProcedureKey) {
                                setProcedureNotes((prev) => ({
                                  ...prev,
                                  [activeProcedureKey]: e.target.value,
                                }));
                              }
                            }}
                            disabled={!isProcedureEditing}
                            placeholder="Write findings / notes here"
                          />
                          {selectedTeethLabel && (
                            <div
                              style={{
                                marginTop: "8px",
                                fontSize: 13,
                                color: "#2f3b52",
                                background: "#f3f6ff",
                                padding: "6px 10px",
                                borderRadius: 8,
                                display: "inline-block",
                              }}
                            >
                              Involving Teeth: {selectedTeethLabel}
                            </div>
                          )}
                          <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            {!isProcedureEditing && activeProcedureKey && (
                              <button
                                type="button"
                                className="btn sm"
                                onClick={handleEditProcedure}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn sm primary"
                              onClick={handleSaveProcedure}
                              disabled={!activeProcedureKey || !isProcedureEditing}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Odontogram (right) */}
            <div
              style={{
                flex: "1 1 320px",
                minWidth: "320px",
              }}
            >
              <label>Odontogram</label>
                <Odontogram
                  key={`${activeProcedureKey || "none"}-${odoMode}`}
                  mode={odoMode}
                  onModeChange={setOdoMode}
                  value={activeTeeth}
                  onChange={handleOdontoChange}
                />

              {activeProcedureInfo && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "8px 12px",
                    border: "1px solid #d8e0ff",
                    borderRadius: 10,
                    background: "#f6f8ff",
                    fontSize: 13,
                    color: "#2f3b52",
                  }}
                >
                  <strong>Editing:</strong> {activeProcedureInfo.name}
                  {activeProcedureInfo.teethLabel
                    ? ` - Teeth: ${activeProcedureInfo.teethLabel}`
                    : " - Select teeth on the odontogram"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="colspan">
          <div className="exam-card">
            <div className="billing-header">
              <h3>Billing</h3>
              <button
                type="button"
                className="btn sm primary"
                onClick={() =>
                  setBillForm((prev) => ({
                    ...prev,
                    description: activeProcedureKey
                      ? activeProcedureKey.split("::")[1]
                      : "Procedure",
                    qty: selectedTeeth.length || 1,
                    price:
                      activeProcedureKey &&
                      procedurePrices[activeProcedureKey] != null
                        ? procedurePrices[activeProcedureKey]
                        : prev.price,
                  }))
                }
              >
                Add to Bill
              </button>
            </div>

            {currentBillLines.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <h4
                  style={{
                    margin: "0 0 8px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#4b587c",
                  }}
                >
                  Bill Preview
                </h4>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "var(--greyLight-2)",
                    boxShadow: "var(--shadow)",
                    borderRadius: "1rem",
                    overflow: "hidden",
                  }}
                >
                  <thead
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--white)",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                  >
                    <tr>
                      <th style={{ padding: "10px 16px" }}>Description</th>
                      <th style={{ padding: "10px 16px" }}>Qty</th>
                      <th style={{ padding: "10px 16px" }}>Price</th>
                      <th style={{ padding: "10px 16px" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBillLines.map((line, index) => (
                      <tr
                        key={index}
                        style={{
                          backgroundColor:
                            index % 2 === 0
                              ? "var(--greyLight-1)"
                              : "var(--greyLight-2)",
                          borderBottom: "1px solid var(--greyLight-3)",
                        }}
                      >
                        <td style={{ padding: "8px 16px" }}>
                          {line.description}
                        </td>
                        <td
                          style={{ padding: "8px 16px", textAlign: "center" }}
                        >
                          {line.qty}
                        </td>
                        <td
                          style={{ padding: "8px 16px", textAlign: "right" }}
                        >
                          {line.price}
                        </td>
                        <td
                          style={{ padding: "8px 16px", textAlign: "right" }}
                        >
                          {line.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <h4
                style={{
                  margin: "0 0 8px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "#4b587c",
                }}
              >
              </h4>
              <div
                className="responsive-form-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                  alignItems: "end",
                }}
              >
                <div>
                  <label>Description</label>
                  <input
                    type="text"
                    value={billForm.description}
                    onChange={(e) =>
                      setBillForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Description"
                  />
                </div>

                <div>
                  <label>Qty</label>
                  <input
                    type="number"
                    value={billForm.qty}
                    onChange={(e) =>
                      setBillForm((prev) => ({
                        ...prev,
                        qty: e.target.value,
                      }))
                    }
                    placeholder="Qty"
                  />
                </div>

                <div>
                  <label>Price</label>
                  <input
                    type="number"
                    value={billForm.price}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBillForm((prev) => ({ ...prev, price: val }));
                      if (activeProcedureKey) {
                        const num = Number(val);
                        if (!Number.isNaN(num)) {
                          setProcedurePrices((prev) => ({
                            ...prev,
                            [activeProcedureKey]: num,
                          }));
                        }
                      }
                    }}
                    placeholder="Price"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="actions" style={{ gap: "8px", display: "flex", flexWrap: "wrap" }}>
          <button className="btn primary" type="submit">
            Save Treatment Plan
          </button>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              setShowExamPreview((v) => !v);
              setReportData(null);
            }}
            disabled={!visitId}
            style={{ flex: "1 1 auto", minWidth: "140px" }}
          >
            Preview Exam & Treatment
          </button>

          {canShowDocs && (
            <>
              <button
                type="button"
                className="btn sm"
                onClick={handleConsentPreview}
                style={{ flex: "1 1 auto", minWidth: "140px" }}
              >
                Consent Form - Preview / Download
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={handleGuidePreview}
                style={{ flex: "1 1 auto", minWidth: "140px" }}
              >
                Post-Operative Guide - Preview / Download
              </button>
            </>
          )}
        </div>
      </form>

      {reportData && (
        <div ref={reportPreviewRef} style={{ marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>
              {reportType === "consent"
                ? "Consent Form Preview"
                : "Post-Operative Guide Preview"}
            </h3>
            <button type="button" className="btn sm" onClick={handleClosePreview}>
              Close Preview
            </button>
          </div>

          <div className="print-surface">
            {reportType === "consent" && <DentalConsent data={reportData} />}
            {reportType === "guide" && <PostOperativeGuide data={reportData} />}
            {reportType === "invoice" && <BillingInvoice data={reportData} />}
          </div>
        </div>
      )}

      {showExamPreview && patientInfo && visitTreatmentPlan && (
        <div ref={examPreviewRef} style={{ marginTop: 16 }} className="print-surface">
          <ExamTreatmentSummary
            patient={patientInfo}
            visit={visits.find((v) => String(v.id) === String(visitId)) || {}}
            examItems={visitExamItems}
            treatmentPlan={visitTreatmentPlan}
          />
        </div>
      )}
      </div>
    </section>
  );
}

