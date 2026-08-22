import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import WowDashLayout from "../../components/layout/WowDashLayout";
import api from "../../api/api";

export default function SuperAdminDashboard({ user, onLogout }) {
  const navItems = [
    { type: "link", label: "Overview", to: "/super-admin/overview", end: true, icon: "ri-home-5-line" },
    { type: "group", label: "Administration" },
    { type: "link", label: "Organizations", to: "/super-admin/organizations", icon: "ri-government-line" },
  ];

  return (
    <WowDashLayout
      brandLabel="Super Control Center"
      navItems={navItems}
      onLogout={onLogout}
      searchPlaceholder="Search clinics..."
      headerActions={
        <div className="d-flex align-items-center gap-2">
          <div className="w-40-px h-40-px bg-primary-100 text-primary-600 rounded-circle d-flex justify-content-center align-items-center fw-bold text-md shadow-sm border border-white">
            SA
          </div>
          <div className="d-flex flex-column text-start">
            <span className="text-xs text-secondary-light" style={{ lineHeight: 1 }}>Welcome,</span>
            <span className="fw-semibold text-primary-light text-sm" style={{ lineHeight: 1.2 }}>
              Super Admin
            </span>
          </div>
        </div>
      }
    >
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<SuperAdminOverview />} />
        <Route path="organizations" element={<ManageOrganizations />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Routes>
    </WowDashLayout>
  );
}

function SuperAdminOverview() {
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/organizations")
      .then((res) => {
        const list = res.data || [];
        const active = list.filter((o) => o.isActive).length;
        setStats({
          total: list.length,
          active,
          inactive: list.length - active,
        });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-fluid py-4 wowdash-users">
      <h4 className="mb-4 fw-bold">Platform Overview</h4>
      {loading ? (
        <div className="text-secondary">Loading metrics...</div>
      ) : (
        <div className="row gy-4">
          <div className="col-12 col-sm-6 col-xl-4">
            <div className="card p-3 shadow-2 radius-8 h-100">
              <div className="d-flex align-items-center justify-content-between gap-2">
                <div>
                  <h6 className="fw-semibold mb-2">{stats.total}</h6>
                  <span className="text-secondary-light text-sm">Total Organizations</span>
                </div>
                <span className="w-48-px h-48-px bg-primary-100 text-primary-600 flex-shrink-0 d-flex justify-content-center align-items-center rounded-circle">
                  <i className="ri-government-line text-xl"></i>
                </span>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-4">
            <div className="card p-3 shadow-2 radius-8 h-100">
              <div className="d-flex align-items-center justify-content-between gap-2">
                <div>
                  <h6 className="fw-semibold mb-2">{stats.active}</h6>
                  <span className="text-secondary-light text-sm">Active Clinics</span>
                </div>
                <span className="w-48-px h-48-px bg-success-100 text-success-600 flex-shrink-0 d-flex justify-content-center align-items-center rounded-circle">
                  <i className="ri-checkbox-circle-line text-xl"></i>
                </span>
              </div>
            </div>
          </div>
          <div className="col-12 col-sm-6 col-xl-4">
            <div className="card p-3 shadow-2 radius-8 h-100">
              <div className="d-flex align-items-center justify-content-between gap-2">
                <div>
                  <h6 className="fw-semibold mb-2">{stats.inactive}</h6>
                  <span className="text-secondary-light text-sm">Suspended Clinics</span>
                </div>
                <span className="w-48-px h-48-px bg-danger-100 text-danger-600 flex-shrink-0 d-flex justify-content-center align-items-center rounded-circle">
                  <i className="ri-close-circle-line text-xl"></i>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageOrganizations() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);

  // Form states
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Search, Status and Pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const loadOrgs = () => {
    setLoading(true);
    api.get("/organizations")
      .then((res) => setOrgs(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const openAddModal = () => {
    setEditingOrg(null);
    setName("");
    setMobile("");
    setPassword("");
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (org) => {
    setEditingOrg(org);
    setName(org.name || "");
    setMobile(org.mobile || "");
    setPassword("");
    setIsActive(org.isActive ?? true);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !mobile) {
      alert("Name and Mobile are required");
      return;
    }

    try {
      if (editingOrg) {
        // Edit Org
        const payload = { name, mobile, isActive };
        if (password) payload.password = password;
        await api.put(`/organizations/${editingOrg.id}`, payload);
      } else {
        // Add Org
        await api.post("/organizations", { name, mobile, password });
      }
      setModalOpen(false);
      loadOrgs();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Action failed. Please verify inputs.");
    }
  };

  const handleToggleStatus = async (org) => {
    try {
      await api.put(`/organizations/${org.id}`, {
        isActive: !org.isActive,
      });
      loadOrgs();
    } catch (err) {
      console.error(err);
      alert("Failed to toggle organization status.");
    }
  };

  const handleModalBackdropClick = (e) => {
    if (e.target.classList.contains("modal")) {
      setModalOpen(false);
    }
  };

  // Filter and paginate orgs client-side
  const filteredOrgs = useMemo(() => {
    let list = orgs;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((org) => {
        const orgName = (org.name || "").toLowerCase();
        const orgMobile = (org.mobile || "").toLowerCase();
        return orgName.includes(q) || orgMobile.includes(q);
      });
    }
    if (statusFilter === "ACTIVE") {
      list = list.filter((org) => org.isActive);
    } else if (statusFilter === "SUSPENDED") {
      list = list.filter((org) => !org.isActive);
    }
    return list;
  }, [orgs, searchQuery, statusFilter]);

  const totalItems = filteredOrgs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safePage = Math.min(page, totalPages);

  const paginatedOrgs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredOrgs.slice(start, start + pageSize);
  }, [filteredOrgs, safePage, pageSize]);

  return (
    <div className="container-fluid py-4 wowdash-users">
      <div className="page-header mb-4">
        <div>
          <h2 className="fw-bold mb-1">Organizations</h2>
          <div className="page-subtitle text-secondary-light">Manage registered organizations, clinics, and accounts.</div>
        </div>
      </div>

      <div className="card border-0 shadow-sm radius-12 overflow-hidden">
        <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
          <div className="d-flex align-items-center flex-wrap gap-3">
            <h6 className="mb-0 fw-semibold text-lg text-primary-light">Registered Clinics</h6>
            <span className="text-md fw-medium text-secondary-light mb-0">Show</span>
            <select
              className="form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <form className="navbar-search" onSubmit={(e) => e.preventDefault()}>
              <input
                type="text"
                className="bg-base h-40-px w-auto"
                placeholder="Search clinics"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </form>
            <select
              className="form-select form-select-sm w-auto ps-12 py-6 radius-12 h-40-px"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary text-sm btn-sm px-12 py-12 radius-8 d-flex align-items-center gap-2"
            onClick={openAddModal}
          >
            <i className="ri-add-line"></i> Add Organization
          </button>
        </div>

        <div className="card-body p-24">
          {loading ? (
            <div className="p-4 text-secondary">Loading organization list...</div>
          ) : filteredOrgs.length === 0 ? (
            <div className="p-4 text-secondary text-center">
              {searchQuery || statusFilter !== "ALL" ? "No clinics match the filters." : "No organizations registered yet."}
            </div>
          ) : (
            <>
              <div className="table-responsive scroll-sm">
                <table className="table bordered-table sm-table mb-0">
                  <thead>
                    <tr>
                      <th>S.L</th>
                      <th>ID</th>
                      <th>Clinic Name</th>
                      <th>Mobile Contact</th>
                      <th>Status</th>
                      <th>Registered At</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrgs.map((org, idx) => (
                      <tr key={org.id}>
                        <td>{String((safePage - 1) * pageSize + idx + 1).padStart(2, "0")}</td>
                        <td>{org.id}</td>
                        <td className="fw-semibold text-primary-light">{org.name}</td>
                        <td>{org.mobile}</td>
                        <td>
                          <span className={`badge px-2.5 py-1.5 radius-4 text-xs ${org.isActive ? "bg-success-100 text-success" : "bg-danger-100 text-danger"}`}>
                            {org.isActive ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td className="text-secondary text-sm">
                          {org.createdAt ? new Date(org.createdAt).toLocaleDateString("en-IN") : "-"}
                        </td>
                        <td className="text-right">
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => openEditModal(org)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => handleToggleStatus(org)}
                              style={{
                                borderColor: org.isActive ? "#fecaca" : "#bbf7d0",
                                background: org.isActive ? "#fee2e2" : "#f0fdf4",
                                color: org.isActive ? "#b91c1c" : "#166534"
                              }}
                            >
                              {org.isActive ? "Suspend" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24">
                <span className="text-sm text-secondary-light">
                  {totalItems
                    ? `Showing ${(safePage - 1) * pageSize + 1} to ${Math.min(safePage * pageSize, totalItems)} of ${totalItems} entries`
                    : "Showing 0 to 0 of 0 entries"}
                </span>
                {totalPages > 1 && (
                  <ul className="pagination d-flex flex-wrap align-items-center gap-2 justify-content-center">
                    <li className="page-item">
                      <button
                        type="button"
                        className="page-link bg-neutral-300 text-secondary-light fw-semibold radius-8 border-0 d-flex align-items-center justify-content-center h-32-px w-32-px text-md"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                      >
                        ‹
                      </button>
                    </li>
                    {(() => {
                      const pages = [];
                      const maxButtons = 5;
                      let start = Math.max(1, safePage - Math.floor(maxButtons / 2));
                      let end = Math.min(totalPages, start + maxButtons - 1);
                      if (end - start + 1 < maxButtons) {
                        start = Math.max(1, end - maxButtons + 1);
                      }
                      for (let p = start; p <= end; p += 1) {
                        pages.push(
                          <li className="page-item" key={`page-${p}`}>
                            <button
                              type="button"
                              className={
                                "page-link fw-semibold radius-8 border-0 d-flex align-items-center justify-content-center h-32-px w-32-px text-md " +
                                (p === safePage
                                  ? "bg-primary-600 text-white"
                                  : "bg-neutral-300 text-secondary-light")
                              }
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          </li>
                        );
                      }
                      return pages;
                    })()}
                    <li className="page-item">
                      <button
                        type="button"
                        className="page-link bg-neutral-300 text-secondary-light fw-semibold radius-8 border-0 d-flex align-items-center justify-content-center h-32-px w-32-px text-md"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                      >
                        ›
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* High Quality Modal */}
      {modalOpen && (
        <div className="modal show wow-modal" onClick={handleModalBackdropClick}>
          <div className="modal-card wow-modal-card">
            <div className="wow-modal-header d-flex justify-content-between align-items-center">
              <div>
                <h3 className="wow-modal-title">{editingOrg ? "Edit Organization" : "Create New Organization"}</h3>
                <p className="wow-modal-subtitle">
                  {editingOrg ? "Update clinic details and credentials." : "Register a new clinic on the platform."}
                </p>
              </div>
              <button
                type="button"
                className="btn-close border-0 bg-transparent text-secondary-light"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                style={{ fontSize: "1.2rem", cursor: "pointer", outline: "none" }}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="wow-modal-form">
              <div className="colspan">
                <label className="form-label fw-semibold text-sm text-primary-light">Clinic / Organization Name</label>
                <input
                  type="text"
                  className="form-control w-100"
                  placeholder="e.g. Dizi Dental Clinic"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="colspan">
                <label className="form-label fw-semibold text-sm text-primary-light">Mobile Number</label>
                <input
                  type="text"
                  className="form-control w-100"
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  disabled={!!editingOrg}
                />
              </div>
              <div className="colspan">
                <label className="form-label fw-semibold text-sm text-primary-light">
                  Password {editingOrg && <span className="text-secondary-light fw-normal">(leave blank to keep unchanged)</span>}
                </label>
                <input
                  type="password"
                  className="form-control w-100"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!editingOrg}
                />
              </div>
              {editingOrg && (
                <div className="form-check form-switch mt-2 colspan d-flex align-items-center gap-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="orgActiveSwitch"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                  <label className="form-check-label fw-semibold text-sm text-primary-light mb-0" htmlFor="orgActiveSwitch" style={{ cursor: "pointer" }}>
                    Active Clinic Account
                  </label>
                </div>
              )}
              <div className="actions wow-modal-actions colspan">
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Clinic</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
