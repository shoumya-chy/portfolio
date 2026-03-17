"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Settings, LogIn, LogOut } from "lucide-react";
import { LoginModal } from "@/components/content-ideas/LoginModal";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Experience", href: "#experience" },
  { label: "Projects", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "Tools", href: "/tools" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAdmin(false);
    window.location.reload();
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setIsAdmin(true);
    window.location.reload();
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)]"
            : "bg-transparent"
        }`}
      >
        <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight hover:text-[var(--color-accent)] transition-colors"
          >
            SC<span className="text-[var(--color-accent)]">.</span>
          </Link>

          {/* Desktop */}
          <ul className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors rounded-lg hover:bg-[var(--color-bg-card)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Link
                  href="/admin/settings"
                  className="px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors rounded-lg hover:bg-[var(--color-bg-card)] flex items-center gap-1"
                >
                  <Settings size={14} />
                  Settings
                </Link>
              </li>
            )}
            <li className="ml-2">
              <a
                href="/Shoumya_Chowdhury_Resume.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium border border-[var(--color-accent)] text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent)] hover:text-white transition-all"
              >
                Resume
              </a>
            </li>
            <li className="ml-1">
              {isAdmin ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors rounded-lg hover:bg-red-400/10"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors rounded-lg hover:bg-[var(--color-bg-card)]"
                >
                  <LogIn size={14} />
                  Sign In
                </button>
              )}
            </li>
          </ul>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-[var(--color-bg)]/95 backdrop-blur-xl border-b border-[var(--color-border)] animate-fade-in">
            <ul className="px-6 py-4 space-y-1">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)] rounded-lg transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {isAdmin && (
                <li>
                  <Link
                    href="/admin/settings"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-1 px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)] rounded-lg transition-colors"
                  >
                    <Settings size={14} />
                    Settings
                  </Link>
                </li>
              )}
              <li>
                {isAdmin ? (
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="flex items-center gap-1.5 w-full px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowLogin(true); setMobileOpen(false); }}
                    className="flex items-center gap-1.5 w-full px-3 py-2.5 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)] rounded-lg transition-colors"
                  >
                    <LogIn size={14} />
                    Sign In
                  </button>
                )}
              </li>
            </ul>
          </div>
        )}
      </header>

      {/* Global Login Modal */}
      {showLogin && (
        <LoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
