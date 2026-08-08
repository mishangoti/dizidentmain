import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

export default function WowDashLayout({
  brandLabel = "Clinic Hub",
  brandLogo = "/images/logo.png",
  navItems = [],
  headerActions,
  headerBelow,
  onLogout,
  children,
  searchPlaceholder = "Search...",
}) {
  const [isCompact, setIsCompact] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.body.classList.toggle("overlay-active", isMobileOpen);
    return () => document.body.classList.remove("overlay-active");
  }, [isMobileOpen]);

  useEffect(() => {
    const DESKTOP_BP = 1200;
    const syncShellForViewport = () => {
      const isDesktop = window.innerWidth >= DESKTOP_BP;
      if (isDesktop) {
        setIsMobileOpen(false);
      } else {
        setIsCompact(false);
      }
    };

    syncShellForViewport();
    window.addEventListener("resize", syncShellForViewport);
    return () => window.removeEventListener("resize", syncShellForViewport);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const navClass = useMemo(
    () => ({ isActive }) => (isActive ? "active-page" : ""),
    []
  );

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const handleNavClick = () => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <aside
        className={`sidebar${isCompact ? " active" : ""}${
          isMobileOpen ? " sidebar-open" : ""
        }`}
      >
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={() => {
            if (isMobileOpen) {
              setIsMobileOpen(false);
            }
          }}
          aria-label="Close sidebar"
        >
          <i className="ri-close-line"></i>
        </button>

        <div>
          <a href="/" className="sidebar-logo">
            <img src={brandLogo} alt={brandLabel} className="light-logo" />
          </a>
        </div>

        <div className="sidebar-menu-area">
          <ul className="sidebar-menu" id="sidebar-menu">
            {navItems.map((item, index) => {
              if (item.type === "group") {
                return (
                  <li
                    className="sidebar-menu-group-title"
                    key={`group-${item.label}-${index}`}
                  >
                    {item.label}
                  </li>
                );
              }

              const itemKey = item.to || item.label || `nav-${index}`;

              return (
                <li key={itemKey}>
                  <NavLink
                    className={navClass}
                    to={item.to}
                    end={item.end}
                    onClick={handleNavClick}
                  >
                    {item.icon && (
                      <i className={`${item.icon} menu-icon`}></i>
                    )}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
          {onLogout && !isCompact && (
            <div className="sidebar-footer">
              <button
                type="button"
                className="btn btn-sm sidebar-logout-btn"
                onClick={onLogout}
              >
                <i className="ri-logout-circle-line me-8"></i>
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      <div
        className={`sidebar-backdrop${isMobileOpen ? " show" : ""}`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      ></div>

      <main className={`dashboard-main${isCompact ? " active" : ""}`}>
        <div className="navbar-header">
          <div className="row align-items-center justify-content-between">
            <div className="col-auto">
              <div className="d-flex flex-wrap align-items-center gap-4">
                <button
                  type="button"
                  className={`sidebar-toggle${isCompact ? " active" : ""}`}
                  onClick={() => setIsCompact((prev) => !prev)}
                  aria-label="Toggle sidebar"
                >
                  <i className="ri-menu-2-line icon text-2xl non-active"></i>
                  <i className="ri-arrow-right-s-line icon text-2xl active"></i>
                </button>
                <button
                  type="button"
                  className="sidebar-mobile-toggle d-xl-none"
                  onClick={() => setIsMobileOpen(true)}
                  aria-label="Open sidebar"
                >
                  <i className="ri-menu-2-line icon text-2xl"></i>
                </button>
                {/* <form className="navbar-search">
                  <input type="text" name="search" placeholder={searchPlaceholder} />
                  <i className="ri-search-line icon"></i>
                </form> */}
              </div>
            </div>
            <div className="col-auto">
              <div className="d-flex flex-wrap align-items-center gap-3">
                {/* <button
                  type="button"
                  className="w-40-px h-40-px bg-neutral-200 rounded-circle d-flex justify-content-center align-items-center"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                  <i
                    className={
                      theme === "dark" ? "ri-sun-line text-xl" : "ri-moon-line text-xl"
                    }
                  ></i>
                </button> */}
                {headerActions}
              </div>
            </div>
          </div>
          {headerBelow && <div className="navbar-header-below">{headerBelow}</div>}
        </div>

        <div className="dashboard-main-body">{children}</div>
      </main>
    </div>
  );
}
