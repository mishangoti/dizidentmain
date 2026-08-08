// src/pages/InventoryView.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { API_BASE_URL } from "../config";
import "../assets/css/wowdash-users.css";

const CATEGORY_OPTIONS = [
  { value: "consumable", label: "Consumable" },
  { value: "non-consumable", label: "Non-Consumable" },
  { value: "medicines", label: "Medic ines" },
  { value: "other", label: "Other" },
];

const ITEMS_PER_PAGE = 10;

// For type dropdown in daily movement
const MOVEMENT_TYPES = [
  { value: "ADJUST_PLUS", label: "Stock Adjust (+)" },
  { value: "ADJUST_MINUS", label: "Stock Adjust ()" },
  { value: "WASTAGE", label: "Wastage / Expired" },
];

// Helper: map qty + minStock to status label
const getStatusLabel = (qty, minStock) => {
  const q = Number(qty) || 0;
  const m = Number(minStock) || 0;

  if (q === 0) return "Out of stock";
  if (m > 0 && q <= m) return "Low";
  return "OK";
};

// Helper: render coloured status pill
const renderStatusPill = (qty, minStock) => {
  const label = getStatusLabel(qty, minStock);

  let color = "#15803d"; // OK
  if (label === "Low") color = "#c05621";
  if (label === "Out of stock") color = "#b91c1c";

  return (
    <span
      style={{
        color,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "0.75rem",
        background:
          label === "OK"
            ? "rgba(22,163,74,0.08)"
            : label === "Low"
            ? "rgba(192,86,33,0.08)"
            : "rgba(185,28,28,0.08)",
      }}
    >
      {label}
    </span>
  );
};

// Helper: convert movement type + qty to signed change (for preview only)
const computeMovementChange = (type, qty) => {
  const q = Number(qty) || 0;
  if (q <= 0) return 0;

  switch (type) {
    case "ADJUST_PLUS":
      return q; // plus
    case "ADJUST_MINUS":
    case "WASTAGE":
      return -q; // minus
    default:
      return 0;
  }
};

export default function InventoryView() {
  // Loaded from backend
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [treatmentTemplates, setTreatmentTemplates] = useState([]);
  const [vendors, setVendors] = useState([]);

  const [showAddUpdateStock, setShowAddUpdateStock] = useState(false);
  const [showDailyMovement, setShowDailyMovement] = useState(false);
  const [showAutoAdjust, setShowAutoAdjust] = useState(false);

  const closeAllModals = () => {
    setShowAddUpdateStock(false);
    setShowDailyMovement(false);
    setShowAutoAdjust(false);
  };

  const handleModalBackdropClick = (e) => {
    if (e.target.classList.contains("modal")) {
      closeAllModals();
    }
  };

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [newItem, setNewItem] = useState({
    name: "",
    category: "consumable",
    unit: "",
    location: "",
    minStock: "",
    currentQty: "",
    price: "",
    notes: "",
    vendorId: "",
  });

  // Daily movement form
  const [movementForm, setMovementForm] = useState({
    itemId: "",
    date: new Date().toISOString().slice(0, 10),
    type: "ADJUST_PLUS",
    qty: "",
    note: "",
  });

  // Form to create/edit a template
  const [templateForm, setTemplateForm] = useState({
    id: null,
    name: "",
    rows: [
      {
        itemId: "",
        qtyPerTreatment: "",
      },
    ],
  });

  // Form to apply a template (auto adjust stock)
  const [autoAdjustForm, setAutoAdjustForm] = useState({
    templateId: "",
    treatmentsCount: "1",
    date: new Date().toISOString().slice(0, 10),
    note: "",
  });

  // ===== API HELPERS =====

  const fetchItems = async () => {
    try {
      const res = await api.get("/inventory/items");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Error loading items", e);
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await api.get("/inventory/movements");
      setMovements(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Error loading movements", e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get("/inventory/treatment-templates");
      const normalized = (Array.isArray(res.data) ? res.data : []).map((t) => ({
        ...t,
        rows: (t.rows || []).map((r) => ({
          id: r.id,
          itemId:
            r.itemId ??
            (r.item ? r.item.id : undefined) ??
            (typeof r.item_id !== "undefined" ? r.item_id : undefined),
          qtyPerTreatment:
            r.qtyPerTreatment ??
            r.quantityPerProcedure ??
            r.quantityPerTreatment ??
            0,
        })),
      }));
      setTreatmentTemplates(normalized);
    } catch (e) {
      console.error("Error loading treatment templates", e);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get("/vendors");
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Error loading vendors", e);
    }
  };

  const refreshItemsAndMovements = async () => {
    await Promise.all([fetchItems(), fetchMovements()]);
  };

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([
        fetchItems(),
        fetchMovements(),
        fetchTemplates(),
        fetchVendors(),
      ]);
    };
    loadAll();
  }, []);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter]);

  // Summary per category (hospital-style quick dashboard)
  const categoryStats = useMemo(() => {
    const base = {
      consumable: { count: 0, qty: 0 },
      "non-consumable": { count: 0, qty: 0 },
      medicines: { count: 0, qty: 0 },
      other: { count: 0, qty: 0 },
    };

    items.forEach((item) => {
      const cat = item.category || "other";
      if (!base[cat]) return;
      base[cat].count += 1;
      base[cat].qty += Number(item.currentQty ?? item.current_stock ?? 0) || 0;
    });

    return base;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((i) => i.category === categoryFilter);
  }, [items, categoryFilter]);

  // Pagination
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const handleNewItemChange = (field, value) => {
    setNewItem((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) {
      alert("Please enter an item name.");
      return;
    }
    if (newItem.currentQty === "") {
      alert("Please enter opening quantity.");
      return;
    }

    const openingQtyNum = Number(newItem.currentQty) || 0;
    const priceNum = Number(newItem.price) || 0;
    const minStockNum = Number(newItem.minStock) || 0;

    const payload = {
      name: newItem.name.trim(),
      category: newItem.category,
      unit: newItem.unit.trim(),
      location: newItem.location.trim(),
      minStock: minStockNum,
      openingQty: openingQtyNum,
      price: priceNum,
      notes: newItem.notes.trim(),
      vendorId: newItem.vendorId ? Number(newItem.vendorId) : null,
    };

    try {
      const res = await api.post("/inventory/items", payload);
      const saved = res.data;
      setItems((prev) => [...prev, saved]);

      // reset form (keep last used category & vendor)
      setNewItem({
        name: "",
        category: newItem.category,
        unit: "",
        location: "",
        minStock: "",
        currentQty: "",
        price: "",
        notes: "",
        vendorId: newItem.vendorId || "",
      });
    } catch (e) {
      console.error("Error saving item", e);
      alert("Error saving item. Please try again.");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Remove this item from inventory?")) return;
    try {
      await api.delete(`/inventory/items/${id}`);

      setItems((prev) => prev.filter((item) => item.id !== id));
      setMovements((prev) => prev.filter((m) => m.itemId !== id));
    } catch (e) {
      console.error("Error deleting item", e);
      alert("Error deleting item.");
    }
  };

  const renderStatus = (item) => {
    const qty = item.currentQty ?? item.current_stock ?? 0;
    const min = item.minStock ?? item.reorderLevel ?? 0;
    return renderStatusPill(qty, min);
  };

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const fromRow = totalItems === 0 ? 0 : startIndex + 1;
  const toRow = Math.min(endIndex, totalItems);

  // Daily Movement form handlers
  const handleMovementChange = (field, value) => {
    setMovementForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Currently selected item in Daily Movement form
  const selectedMovementItem = useMemo(() => {
    const idNum = Number(movementForm.itemId);
    if (!idNum) return null;
    return items.find((i) => i.id === idNum) || null;
  }, [movementForm.itemId, items]);

  // Projected qty after movement (for live preview)
  const projectedMovement = useMemo(() => {
    if (!selectedMovementItem) return null;

    const currentQty =
      Number(selectedMovementItem.currentQty ?? selectedMovementItem.current_stock ?? 0) || 0;
    const minStock =
      Number(selectedMovementItem.minStock ?? selectedMovementItem.reorderLevel ?? 0) || 0;
    const change = computeMovementChange(movementForm.type, movementForm.qty);
    const projectedQty = Math.max(0, currentQty + change);

    return {
      currentQty,
      projectedQty,
      currentStatus: getStatusLabel(currentQty, minStock),
      projectedStatus: getStatusLabel(projectedQty, minStock),
      minStock,
    };
  }, [selectedMovementItem, movementForm.type, movementForm.qty]);

  const handleSubmitMovement = async () => {
    if (!movementForm.itemId) {
      alert("Please select an item.");
      return;
    }
    if (!movementForm.qty || Number(movementForm.qty) <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const itemId = Number(movementForm.itemId);
    const qty = Number(movementForm.qty);
    const type = movementForm.type;
    const dateStr = movementForm.date || new Date().toISOString().slice(0, 10);

    const change = computeMovementChange(type, qty);
    if (change === 0) {
      alert("Movement type not recognised or quantity is zero.");
      return;
    }

    const payload = {
      itemId,
      date: dateStr,
      type: type,
      qty: qty,
      note: movementForm.note,
    };

    try {
      await api.post("/inventory/movements", payload);
      await refreshItemsAndMovements();

      // reset qty and note, keep item & date & type for faster daily entry
      setMovementForm((prev) => ({
        ...prev,
        qty: "",
        note: "",
      }));
    } catch (e) {
      console.error("Error saving movement", e);
      alert("Error saving stock movement.");
    }
  };

  // ===== Treatment Template Management Handlers =====

  const handleTemplateNameChange = (value) => {
    setTemplateForm((prev) => ({
      ...prev,
      name: value,
    }));
  };

  const handleTemplateRowChange = (index, field, value) => {
    setTemplateForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = {
        ...rows[index],
        [field]: value,
      };
      return { ...prev, rows };
    });
  };

  const handleTemplateAddRow = () => {
    setTemplateForm((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          itemId: "",
          qtyPerTreatment: "",
        },
      ],
    }));
  };

  const handleTemplateRemoveRow = (index) => {
    setTemplateForm((prev) => {
      const rows = prev.rows.filter((_, i) => i !== index);
      return {
        ...prev,
        rows: rows.length ? rows : [{ itemId: "", qtyPerTreatment: "" }],
      };
    });
  };

  const handleTemplateReset = () => {
    setTemplateForm({
      id: null,
      name: "",
      rows: [
        {
          itemId: "",
          qtyPerTreatment: "",
        },
      ],
    });
  };

  const handleTemplateEdit = (template) => {
    setTemplateForm({
      id: template.id,
      name: template.name,
      rows:
        template.rows && template.rows.length
          ? template.rows.map((r) => ({
              itemId: String(
                r.itemId ??
                  (r.item ? r.item.id : undefined) ??
                  (typeof r.item_id !== "undefined" ? r.item_id : "")
              ),
              qtyPerTreatment: String(
                r.qtyPerTreatment ??
                  r.quantityPerProcedure ??
                  r.quantityPerTreatment ??
                  ""
              ),
            }))
          : [
              {
                itemId: "",
                qtyPerTreatment: "",
              },
            ],
    });
    setShowAutoAdjust(true);
  };

  const handleTemplateDelete = async (templateId) => {
    if (!window.confirm("Delete this treatment template?")) return;

    try {
      await api.delete(`/inventory/treatment-templates/${templateId}`);
      setTreatmentTemplates((prev) => prev.filter((t) => t.id !== templateId));

      setTemplateForm((prev) =>
        prev.id === templateId
          ? {
              id: null,
              name: "",
              rows: [
                {
                  itemId: "",
                  qtyPerTreatment: "",
                },
              ],
            }
          : prev
      );
    } catch (e) {
      console.error("Error deleting template", e);
      alert("Error deleting template.");
    }
  };

  const handleTemplateSave = async () => {
    const name = templateForm.name.trim();
    if (!name) {
      alert("Please enter a treatment name.");
      return;
    }

    const cleanedRows = templateForm.rows
      .map((r) => ({
        itemId: Number(r.itemId) || 0,
        qtyPerTreatment: Number(r.qtyPerTreatment) || 0,
      }))
      .filter((r) => r.itemId && r.qtyPerTreatment > 0);

    if (cleanedRows.length === 0) {
      alert("Add at least one item with quantity per treatment.");
      return;
    }

    const payload = {
      id: templateForm.id || null,
      name,
      rows: cleanedRows,
    };

    try {
      const res = await api.post("/inventory/treatment-templates", payload);
      const saved = res.data;

      setTreatmentTemplates((prev) => {
        const existsIndex = prev.findIndex((t) => t.id === saved.id);
        if (existsIndex >= 0) {
          const clone = [...prev];
          clone[existsIndex] = saved;
          return clone;
        }
        return [...prev, saved];
      });

      // Reset form but keep Auto panel open
      setTemplateForm({
        id: null,
        name: "",
        rows: [
          {
            itemId: "",
            qtyPerTreatment: "",
          },
        ],
      });
    } catch (e) {
      console.error("Error saving template", e);
      alert("Error saving template.");
    }
  };

  const handleAutoAdjustFormChange = (field, value) => {
    setAutoAdjustForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const selectedTemplate = useMemo(() => {
    const idNum = Number(autoAdjustForm.templateId);
    if (!idNum) return null;
    return treatmentTemplates.find((t) => t.id === idNum) || null;
  }, [autoAdjustForm.templateId, treatmentTemplates]);

  // Preview of total deduction per item based on template + treatmentsCount
  const autoAdjustPreview = useMemo(() => {
    if (!selectedTemplate) return [];
    const count = Number(autoAdjustForm.treatmentsCount) || 0;
    if (count <= 0) return [];

    return selectedTemplate.rows
      .map((row) => {
        const item = items.find((i) => i.id === row.itemId);
        if (!item) return null;
        const perCase = Number(row.qtyPerTreatment) || 0;
        const total = perCase * count;
        if (total <= 0) return null;

        const currentQty =
          Number(item.currentQty ?? item.current_stock ?? 0) || 0;
        const minStock =
          Number(item.minStock ?? item.reorderLevel ?? 0) || 0;

        return {
          itemId: item.id,
          name: item.name,
          perCase,
          total,
          currentQty,
          finalQty: Math.max(0, currentQty - total),
          minStock,
        };
      })
      .filter(Boolean);
  }, [selectedTemplate, autoAdjustForm.treatmentsCount, items]);

 const handleApplyAutoAdjustment = async () => {
  if (!selectedTemplate) {
    alert("Please select a treatment template.");
    return;
  }

  const count = Number(autoAdjustForm.treatmentsCount) || 0;
  if (count <= 0) {
    alert("Please enter number of treatments (e.g. 1, 2, 3).");
    return;
  }

  const dateStr =
    autoAdjustForm.date || new Date().toISOString().slice(0, 10);

  const noteBase =
    autoAdjustForm.note?.trim() ||
    `${count}  ${selectedTemplate.name} (auto stock adjustment)`;

// IMPORTANT: match backend DTO field names exactly
  const payload = {
    templateId: selectedTemplate.id,   // Long templateId
    treatmentsCount: count,            // int treatmentsCount
    date: dateStr,                     // String date
    note: noteBase,                    // String note
  };

  try {
    await api.post("/inventory/auto-adjustments", payload);
    await refreshItemsAndMovements();

    // Reset only count + note, keep template for next adjustment
    setAutoAdjustForm((prev) => ({
      ...prev,
      treatmentsCount: "1",
      note: "",
    }));
  } catch (e) {
    console.error("Error applying auto adjustment", e);
    alert("Error applying auto adjustment.");
  }
};


  // Helper to show vendor name in stock table
  const getVendorLabelForItem = (item) => {
    if (item.vendorName) return item.vendorName;
    if (item.vendor && typeof item.vendor === "object" && item.vendor.name) {
      return item.vendor.name;
    }
    if (item.vendorId) {
      const v = vendors.find(
        (ven) => String(ven.id) === String(item.vendorId)
      );
      if (v) return v.name;
    }
    return "";
  };

  return (
    <section id="view-inventory" className="view show wowdash-users">
      <div className="page-header">
        <div>
          <h2>Inventory (Lite)</h2>
          <div className="page-subtitle">Track stock levels, suppliers, and daily movement.</div>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards (Consumable / Non-Consumable / Medicines / Other) */}
        <div className="cards" style={{ paddingTop: 0 }}>
        <div className="card inventory-summary-card">
          <h3>Consumable</h3>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Items
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {categoryStats.consumable.count}{" "}
            <span
              style={{ fontSize: "0.8rem", color: "var(--greyDark)" }}
            >
              / {categoryStats.consumable.qty} units
            </span>
          </div>
        </div>
        <div className="card inventory-summary-card">
          <h3>Non-Consumable</h3>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Items
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {categoryStats["non-consumable"].count}{" "}
            <span
              style={{ fontSize: "0.8rem", color: "var(--greyDark)" }}
            >
              / {categoryStats["non-consumable"].qty} units
            </span>
          </div>
        </div>
        <div className="card inventory-summary-card">
          <h3>Medicines</h3>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Items
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {categoryStats.medicines.count}{" "}
            <span
              style={{ fontSize: "0.8rem", color: "var(--greyDark)" }}
            >
              / {categoryStats.medicines.qty} units
            </span>
          </div>
        </div>
        <div className="card warn inventory-summary-card">
          <h3>Other</h3>
          <div className="muted" style={{ fontSize: "0.8rem" }}>
            Items
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {categoryStats.other.count}{" "}
            <span
              style={{ fontSize: "0.8rem", color: "var(--greyDark)" }}
            >
              / {categoryStats.other.qty} units
            </span>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH: Stock Register (READ-ONLY) */}
      <div className="panel" style={{ margin: "16px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <h3 style={{ margin: 0 }}>Stock Register</h3>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={"btn sm" + (categoryFilter === "all" ? " primary" : "")}
              onClick={() => setCategoryFilter("all")}
            >
              All
            </button>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={
                  "btn sm" +
                  (categoryFilter === cat.value ? " primary" : "")
                }
                onClick={() => setCategoryFilter(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "var(--greyLight-2)",
              boxShadow: "var(--shadow)",
              borderRadius: "1rem",
              overflow: "hidden",
              fontSize: "0.85rem",
            }}
          >
            <thead
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--white)",
                fontWeight: 600,
              }}
            >
              <tr>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>
                  Item
                </th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>
                  Vendor
                </th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>
                  Category
                </th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>
                  Location
                </th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>
                  Unit
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>
                  Price
                </th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>
                  In Stock
                </th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>
                  Status
                </th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedItems.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: "10px 14px",
                      textAlign: "center",
                      background: "var(--greyLight-1)",
                      color: "var(--greyDark)",
                    }}
                  >
                    No items in this view. Add items below or adjust
                    filter.
                  </td>
                </tr>
              )}

              {paginatedItems.map((item, index) => {
                const catLabel =
                  CATEGORY_OPTIONS.find(
                    (c) => c.value === item.category
                  )?.label ||
                  item.category ||
                  "-";

                const qty =
                  item.currentQty ?? item.current_stock ?? 0;
                const price =
                  typeof item.price !== "undefined"
                    ? Number(item.price)
                    : item.rate ?? 0;

                return (
                  <tr
                    key={item.id}
                    style={{
                      backgroundColor:
                        index % 2 === 0
                          ? "var(--greyLight-1)"
                          : "var(--greyLight-2)",
                      borderBottom: "1px solid var(--greyLight-3)",
                    }}
                  >
                    <td style={{ padding: "6px 12px" }}>{item.name}</td>
                    <td style={{ padding: "6px 12px" }}>
                      {getVendorLabelForItem(item)}
                    </td>

                    <td style={{ padding: "6px 12px" }}>{catLabel}</td>

                    <td style={{ padding: "6px 12px" }}>
                      {item.location || ""}
                    </td>

                    <td
                      style={{ padding: "6px 12px", textAlign: "center" }}
                    >
                      {item.unit || ""}
                    </td>

                    <td
                      style={{ padding: "6px 12px", textAlign: "right" }}
                    >
                      {Number(price).toFixed(2)}
                    </td>

                    {/* READ-ONLY STOCK COLUMN */}
                    <td
                      style={{
                        padding: "6px 12px",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {qty}
                    </td>

                    <td
                      style={{
                        padding: "6px 12px",
                        textAlign: "center",
                      }}
                    >
                      {renderStatus(item)}
                    </td>

                    <td
                      style={{
                        padding: "6px 12px",
                        textAlign: "center",
                      }}
                    >
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination row */}
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.8rem",
            color: "var(--greyDark)",
          }}
        >
          <span>
            Showing {fromRow}{toRow} of {totalItems} items
          </span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              className="btn sm"
              onClick={handlePrevPage}
              disabled={safePage === 1}
            >
               Prev
            </button>
            <span>
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={handleNextPage}
              disabled={safePage === totalPages}
            >
              Next 
            </button>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH: Action buttons (Add / Daily / Auto) */}
      <div className="d-flex align-items-center flex-wrap gap-3 px-24" style={{ marginBottom: "16px" }}>
        <button
          type="button"
          className="btn btn-primary text-sm btn-sm px-12 py-12 radius-8"
          onClick={() => setShowAddUpdateStock(true)}
        >
          Add / Update Stock
        </button>

        <button
          type="button"
          className="btn btn-outline text-sm btn-sm px-12 py-12 radius-8"
          onClick={() => setShowDailyMovement(true)}
        >
          Daily Stock Movement
        </button>

        <button
          type="button"
          className="btn btn-outline text-sm btn-sm px-12 py-12 radius-8"
          onClick={() => setShowAutoAdjust(true)}
        >
          Auto Stock Adjustment
        </button>
      </div>

      {/* ADD / UPDATE STOCK MODAL */}
      {showAddUpdateStock && (
        <div className="modal show wow-modal" onClick={handleModalBackdropClick}>
          <div className="modal-card modal-card-lg wow-modal-card">
            <div className="wow-modal-header d-flex align-items-center justify-content-between">
              <div>
                <h3 className="wow-modal-title">Add / Update Stock</h3>
                <p className="wow-modal-subtitle">
                  Create new items or add opening stock for consumables, instruments,
                  medicines and other materials.
                </p>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={closeAllModals}>
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <div>
                <label>Item Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => handleNewItemChange("name", e.target.value)}
                  placeholder="e.g. Gloves (Medium), Composite Syringe..."
                />
              </div>

              <div className="filter-block">
                <label className="filter-label">Vendor</label>
                <select
                  className="neo-input"
                  value={newItem.vendorId || ""}
                  onChange={(e) => handleNewItemChange("vendorId", e.target.value)}
                >
                  <option value=""> Select Vendor </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.mobile ? `(${v.mobile})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Category</label>
                <select
                  value={newItem.category}
                  onChange={(e) => handleNewItemChange("category", e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Unit</label>
                <input
                  type="text"
                  value={newItem.unit}
                  onChange={(e) => handleNewItemChange("unit", e.target.value)}
                  placeholder="pcs / box / bottle"
                />
              </div>

              <div>
                <label>Location</label>
                <input
                  type="text"
                  value={newItem.location}
                  onChange={(e) => handleNewItemChange("location", e.target.value)}
                  placeholder="e.g. Operatory 1, Store Room"
                />
              </div>

              <div>
                <label>Price (per unit)</label>
                <input
                  type="number"
                  value={newItem.price}
                  onChange={(e) => handleNewItemChange("price", e.target.value)}
                  placeholder="e.g. 25"
                />
              </div>

              <div>
                <label>Minimum Stock Alert</label>
                <input
                  type="number"
                  value={newItem.minStock}
                  onChange={(e) => handleNewItemChange("minStock", e.target.value)}
                  placeholder="e.g. 10"
                />
                <p className="muted" style={{ fontSize: "0.75rem" }}>
                  Status rules:{" "}
                  <strong>0 = Out of stock</strong>,{" "}
                  <strong>1 to Min Stock = Low</strong>,{" "}
                  <strong>&gt; Min Stock = OK</strong>.
                </p>
              </div>

              <div>
                <label>Opening Quantity</label>
                <input
                  type="number"
                  value={newItem.currentQty}
                  onChange={(e) => handleNewItemChange("currentQty", e.target.value)}
                  placeholder="e.g. 50"
                />
                {newItem.currentQty !== "" && (
                  <p className="muted" style={{ fontSize: "0.75rem" }}>
                    Status with this opening stock:{" "}
                    <strong>{getStatusLabel(newItem.currentQty, newItem.minStock)}</strong>
                  </p>
                )}
              </div>

              <div>
                <label>Notes (optional)</label>
                <textarea
                  rows={3}
                  className="exam-text"
                  value={newItem.notes}
                  onChange={(e) => handleNewItemChange("notes", e.target.value)}
                  placeholder="Batch / Expiry / Vendor / any remarks"
                />
              </div>

              <div style={{ textAlign: "right", marginTop: "6px" }}>
                <button type="button" className="btn btn-primary" onClick={handleAddItem}>
                  Save / Add to Inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY STOCK MOVEMENT MODAL */}
      {showDailyMovement && (
        <div className="modal show wow-modal" onClick={handleModalBackdropClick}>
          <div className="modal-card modal-card-lg wow-modal-card">
            <div className="wow-modal-header d-flex align-items-center justify-content-between">
              <div>
                <h3 className="wow-modal-title">Daily Stock Movement</h3>
                <p className="wow-modal-subtitle">
                  Record inward and outward movement, manual adjustments or wastage.
                </p>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={closeAllModals}>
                Close
              </button>
            </div>

            <div
              className="responsive-form-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "10px",
                alignItems: "end",
                marginBottom: "12px",
              }}
            >
              <div>
                <label>Item</label>
                <select
                  value={movementForm.itemId}
                  onChange={(e) => handleMovementChange("itemId", e.target.value)}
                >
                  <option value="">Select item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={movementForm.date}
                  onChange={(e) => handleMovementChange("date", e.target.value)}
                />
              </div>

              <div>
                <label>Type</label>
                <select
                  value={movementForm.type}
                  onChange={(e) => handleMovementChange("type", e.target.value)}
                >
                  {MOVEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Quantity</label>
                <input
                  type="number"
                  value={movementForm.qty}
                  onChange={(e) => handleMovementChange("qty", e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            {selectedMovementItem && projectedMovement && (
              <div
                className="muted"
                style={{
                  fontSize: "0.78rem",
                  marginBottom: "10px",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  background: "var(--greyLight-2)",
                }}
              >
                <strong>Stock preview:</strong>{" "}
                <span style={{ fontWeight: 500 }}>{selectedMovementItem.name}</span>{" "}
                - {projectedMovement.currentQty} {"->"} {projectedMovement.projectedQty} units{" "}
                {projectedMovement.projectedQty} units{" "}
                <span style={{ marginLeft: 6 }}>
                  (Current: <strong>{projectedMovement.currentStatus}</strong>, After:{" "}
                  <strong>{projectedMovement.projectedStatus}</strong>)
                </span>
              </div>
            )}

            <div style={{ marginBottom: "10px" }}>
              <label>Remarks (optional)</label>
              <textarea
                rows={2}
                className="exam-text"
                value={movementForm.note}
                onChange={(e) => handleMovementChange("note", e.target.value)}
                placeholder="e.g. Wastage due to expiry, manual correction, etc."
              />
            </div>

            <div style={{ textAlign: "right", marginBottom: "4px" }}>
              <button type="button" className="btn btn-primary" onClick={handleSubmitMovement}>
                Save Movement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO STOCK ADJUSTMENT MODAL */}
      {showAutoAdjust && (
        <div className="modal show wow-modal" onClick={handleModalBackdropClick}>
          <div className="modal-card modal-card-lg wow-modal-card">
            <div className="wow-modal-header d-flex align-items-center justify-content-between">
              <div>
                <h3 className="wow-modal-title">Auto Stock Adjustment (By Treatment)</h3>
                <p className="wow-modal-subtitle">
                  Link treatments to items and quantities. Auto-deduct stock and log an audit trail.
                </p>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={closeAllModals}>
                Close
              </button>
            </div>

            <div
              style={{
                borderBottom: "1px solid var(--greyLight-3)",
                paddingBottom: "12px",
                marginBottom: "12px",
              }}
            >
              <h4 style={{ marginTop: 0, fontSize: "0.95rem" }}>Use Treatment Template</h4>

              <div
                className="responsive-form-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "10px",
                  alignItems: "end",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <label>Treatment</label>
                  <select
                    value={autoAdjustForm.templateId}
                    onChange={(e) => handleAutoAdjustFormChange("templateId", e.target.value)}
                  >
                    <option value="">Select treatment</option>
                    {treatmentTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>No. of Treatments</label>
                  <input
                    type="number"
                    min="1"
                    value={autoAdjustForm.treatmentsCount}
                    onChange={(e) =>
                      handleAutoAdjustFormChange("treatmentsCount", e.target.value)
                    }
                    placeholder="e.g. 1, 2, 3"
                  />
                </div>

                <div>
                  <label>Date</label>
                  <input
                    type="date"
                    value={autoAdjustForm.date}
                    onChange={(e) => handleAutoAdjustFormChange("date", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label>Remarks (optional)</label>
                <textarea
                  rows={2}
                  className="exam-text"
                  value={autoAdjustForm.note}
                  onChange={(e) => handleAutoAdjustFormChange("note", e.target.value)}
                  placeholder="e.g. Todays RCT cases, morning session, etc."
                />
              </div>

              {selectedTemplate && autoAdjustPreview.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>
                    Stock preview for <strong>{selectedTemplate.name}</strong> (
                    {autoAdjustForm.treatmentsCount}):
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.8rem",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>Item</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Per Case</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Total Deduction</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Current {"->"} Final</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Status After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autoAdjustPreview.map((row) => (
                          <tr key={row.itemId}>
                            <td style={{ padding: "4px 6px" }}>{row.name}</td>
                            <td style={{ padding: "4px 6px", textAlign: "center" }}>{row.perCase}</td>
                            <td style={{ padding: "4px 6px", textAlign: "center" }}>{row.total}</td>
                            <td style={{ padding: "4px 6px", textAlign: "center" }}>
                              {row.currentQty} {"->"} {row.finalQty}
                            </td>
                            <td style={{ padding: "4px 6px", textAlign: "center" }}>
                              {renderStatusPill(row.finalQty, row.minStock)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ textAlign: "right" }}>
                <button type="button" className="btn btn-primary" onClick={handleApplyAutoAdjustment}>
                  Apply Auto Adjustment
                </button>
              </div>
            </div>

            <div>
              <h4 style={{ marginTop: 0, fontSize: "0.95rem" }}>Manage Treatment Templates</h4>
              <p className="muted" style={{ fontSize: "0.75rem" }}>
                Define for each treatment which items are used and in what quantity per case.
              </p>

              <div
                style={{
                  borderRadius: "0.75rem",
                  padding: "10px",
                  background: "var(--greyLight-2)",
                  marginBottom: "10px",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <label>Treatment Name</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => handleTemplateNameChange(e.target.value)}
                  />
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.8rem",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "4px 6px", width: "60%" }}>Item</th>
                        <th style={{ textAlign: "center", padding: "4px 6px", width: "25%" }}>
                          Qty per Treatment
                        </th>
                        <th style={{ textAlign: "center", padding: "4px 6px", width: "15%" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateForm.rows.map((row, index) => (
                        <tr key={index}>
                          <td style={{ padding: "4px 6px" }}>
                            <select
                              value={row.itemId}
                              onChange={(e) =>
                                handleTemplateRowChange(index, "itemId", e.target.value)
                              }
                            >
                              <option value="">Select item</option>
                              {items.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "4px 6px", textAlign: "center" }}>
                            <input
                              type="number"
                              min="0"
                              value={row.qtyPerTreatment}
                              onChange={(e) =>
                                handleTemplateRowChange(index, "qtyPerTreatment", e.target.value)
                              }
                              placeholder="e.g. 1"
                              style={{ maxWidth: "80px" }}
                            />
                          </td>
                          <td style={{ padding: "4px 6px", textAlign: "center" }}>
                            <button
                              type="button"
                              className="btn sm"
                              onClick={() => handleTemplateRemoveRow(index)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "8px",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <button type="button" className="btn sm" onClick={handleTemplateAddRow}>
                    + Add Item Row
                  </button>
                  <div style={{ marginLeft: "auto" }}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={handleTemplateReset}
                      style={{ marginRight: "6px" }}
                    >
                      Reset
                    </button>
                    <button type="button" className="btn btn-primary sm" onClick={handleTemplateSave}>
                      {templateForm.id ? "Update Template" : "Save Template"}
                    </button>
                  </div>
                </div>
              </div>

              {treatmentTemplates.length > 0 && (
                <>
                  <div className="muted" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>
                    Saved templates:
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.8rem",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>Treatment</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Items Linked</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Quick Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {treatmentTemplates.map((t) => (
                          <tr key={t.id}>
                            <td style={{ padding: "4px 6px" }}>{t.name}</td>
                            <td style={{ padding: "4px 6px", textAlign: "center" }}>
                              {t.rows?.length || 0}
                            </td>
                            <td style={{ padding: "4px 6px", textAlign: "center" }}>
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() =>
                                  handleAutoAdjustFormChange("templateId", String(t.id))
                                }
                                style={{ marginRight: "4px" }}
                              >
                                Use
                              </button>
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => handleTemplateEdit(t)}
                                style={{ marginRight: "4px" }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => handleTemplateDelete(t.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}







