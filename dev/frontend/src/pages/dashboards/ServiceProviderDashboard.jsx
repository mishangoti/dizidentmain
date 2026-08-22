import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import WowDashLayout from "../../components/layout/WowDashLayout.jsx";
import api from "../../api/api";

const PROVIDER_TYPES = [
  "PHARMACY",
  "LAB",
  "RADIOLOGY",
  "PATHOLOGY",
  "BLOOD_BANK",
  "AMBULANCE",
  "ORTHODONTIC_LAB",
  "BED_MANAGER",
  "OTHER",
];

function Overview({ profile }) {
  return (
    <div className="card p-24">
      <h5 className="mb-12">Service provider overview</h5>
      <p className="text-secondary-light mb-8">
        Business: <strong>{profile?.businessName || profile?.fullName || "—"}</strong>
      </p>
      <p className="text-secondary-light mb-8">
        Type: <strong>{profile?.providerType || "—"}</strong> · Scope:{" "}
        <strong>{profile?.providerScope || "—"}</strong>
      </p>
      <p className="text-secondary-light mb-0">
        Mobile: {profile?.mobile || "—"} · Email: {profile?.email || "—"}
      </p>
    </div>
  );
}

function ProfileForm({ userId, profile, onSaved }) {
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    businessName: "",
    providerType: "OTHER",
    providerScope: "INDEPENDENT",
    licenseNumber: "",
    contactPhone: "",
    addressLine: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile) return;
    setForm({
      email: profile.email || "",
      fullName: profile.fullName || "",
      businessName: profile.businessName || "",
      providerType: profile.providerType || "OTHER",
      providerScope: profile.providerScope || "INDEPENDENT",
      licenseNumber: profile.licenseNumber || "",
      contactPhone: profile.contactPhone || "",
      addressLine: profile.addressLine || "",
      city: profile.city || "",
      state: profile.state || "",
      postalCode: profile.postalCode || "",
      country: profile.country || "",
    });
  }, [profile]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await api.put(`/users/${userId}/profile`, form);
      onSaved?.(res.data);
      setMessage("Profile saved.");
    } catch (err) {
      console.error(err);
      setMessage("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card p-24" onSubmit={save}>
      <h5 className="mb-16">Profile</h5>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Full name</label>
          <input className="form-control" value={form.fullName} onChange={set("fullName")} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Business name</label>
          <input className="form-control" value={form.businessName} onChange={set("businessName")} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Email</label>
          <input className="form-control" type="email" value={form.email} onChange={set("email")} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Contact phone</label>
          <input className="form-control" value={form.contactPhone} onChange={set("contactPhone")} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Provider type</label>
          <select className="form-control" value={form.providerType} onChange={set("providerType")}>
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Scope</label>
          <select className="form-control" value={form.providerScope} onChange={set("providerScope")}>
            <option value="INDEPENDENT">INDEPENDENT</option>
            <option value="INTERNAL">INTERNAL</option>
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">License number</label>
          <input className="form-control" value={form.licenseNumber} onChange={set("licenseNumber")} />
        </div>
        <div className="col-12">
          <label className="form-label">Address</label>
          <input className="form-control" value={form.addressLine} onChange={set("addressLine")} />
        </div>
        <div className="col-md-4">
          <label className="form-label">City</label>
          <input className="form-control" value={form.city} onChange={set("city")} />
        </div>
        <div className="col-md-4">
          <label className="form-label">State</label>
          <input className="form-control" value={form.state} onChange={set("state")} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Postal code</label>
          <input className="form-control" value={form.postalCode} onChange={set("postalCode")} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Country</label>
          <input className="form-control" value={form.country} onChange={set("country")} />
        </div>
      </div>
      <div className="mt-20 d-flex align-items-center gap-12">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {message && <span className="text-secondary-light">{message}</span>}
      </div>
    </form>
  );
}

export default function ServiceProviderDashboard({ user, onLogout }) {
  const location = useLocation();
  const userId = user?.id || user?.userId;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!userId) return;
    api
      .get(`/users/${userId}/profile`)
      .then((res) => setProfile(res.data))
      .catch((err) => console.error(err));
  }, [userId]);

  const navItems = [
    { to: "/service-provider/overview", label: "Overview", icon: "ri-dashboard-line" },
    { to: "/service-provider/profile", label: "Profile", icon: "ri-user-settings-line" },
  ];

  const title =
    location.pathname.includes("/profile") ? "Profile" : "Overview";

  return (
    <WowDashLayout
      brandLabel="Service Provider"
      navItems={navItems}
      onLogout={onLogout}
      headerActions={
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={onLogout}>
          Logout
        </button>
      }
    >
      <div className="dashboard-main-body">
        <h4 className="mb-20">{title}</h4>
        <Routes>
          <Route path="/" element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview profile={profile} />} />
          <Route
            path="profile"
            element={
              <ProfileForm
                userId={userId}
                profile={profile}
                onSaved={(p) => {
                  setProfile(p);
                  if (p?.fullName) {
                    const next = { ...user, name: p.fullName };
                    localStorage.setItem("hms_user", JSON.stringify(next));
                  }
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </WowDashLayout>
  );
}
