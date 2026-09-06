"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderOpen,
  History,
  House,
  Menu,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import styles from "./IBuroClientShellV2.module.css";

export type IBuroClientCaseOptionV2 = {
  id: string;
  displayNumber: string;
  planLabel: string;
};

type ShellProps = {
  children: ReactNode;
  caseId: string;
  displayName: string;
  caseDisplayNumber: string;
  planLabel: string;
  unreadCount: number;
  cases: readonly IBuroClientCaseOptionV2[];
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof House;
};

function initials(displayName: string) {
  return (
    displayName
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "iБ"
  );
}

function AccountAvatar({ className, initialsValue }: { className: string; initialsValue: string }) {
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <span className={className}>
      {!avatarLoaded ? initialsValue : null}
      {!avatarFailed ? (
        // Authenticated same-origin avatar proxy; initials remain the graceful fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/api/platform/account/avatar"
          alt=""
          className={`${styles.userAvatarImage} ${avatarLoaded ? styles.userAvatarImageLoaded : ""}`}
          onLoad={() => setAvatarLoaded(true)}
          onError={() => {
            setAvatarFailed(true);
            setAvatarLoaded(false);
          }}
        />
      ) : null}
    </span>
  );
}

function isActive(pathname: string, href: string, homeHref: string) {
  if (href === homeHref) return pathname === homeHref;
  const route = href.split("?", 1)[0];
  if (route === "/portal/profile") return pathname === route || pathname === "/portal/security";
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function IBuroClientShellV2({
  children,
  caseId,
  displayName,
  caseDisplayNumber,
  planLabel,
  unreadCount,
  cases,
}: ShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousPathnameRef = useRef(pathname);
  const base = `/portal/cases/${caseId}`;
  const userInitials = initials(displayName);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      setDrawerOpen(false);
    }
  }, [pathname]);

  const closeDrawer = (restoreFocus = false) => {
    setDrawerOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  const navigation = useMemo<NavItem[]>(
    () => [
      { label: "Главная", href: base, icon: House },
      { label: "Практикум", href: `${base}/practicum`, icon: BookOpen },
      { label: "Анкета", href: `${base}/questionnaire`, icon: ClipboardList },
      { label: "Документы", href: `${base}/documents`, icon: FileText },
      { label: "Файлы", href: `${base}/files`, icon: FolderOpen },
      { label: "AI-помощник", href: `${base}/ai`, icon: Sparkles },
      { label: "Прогресс", href: `${base}/progress`, icon: ChartNoAxesColumnIncreasing },
      { label: "История дела", href: `${base}/activity`, icon: History },
      { label: "Профиль", href: `/portal/profile?caseId=${caseId}`, icon: UserRound },
    ],
    [base, caseId],
  );

  const nav = (mobile = false) => (
    <nav className={styles.nav} aria-label={mobile ? "Мобильная навигация iБюро" : "Навигация iБюро"}>
      {navigation.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href, base);
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            onClick={() => closeDrawer()}
          >
            <span className={styles.navIcon}><Icon aria-hidden="true" /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const accountCard = () => (
    <div className={styles.singleCaseCard}>
      <AccountAvatar className={`${styles.singleCaseAvatar} ${styles.userAvatar}`} initialsValue={userInitials} />
      <div className={styles.singleCaseCopy}><strong>{displayName}</strong><span>{caseDisplayNumber}</span></div>
    </div>
  );

  const caseSwitcher = (mobile = false) =>
    cases.length > 1 ? (
      <details className={styles.caseSwitcher}>
        <summary aria-label={`Сменить дело. Текущее дело: ${caseDisplayNumber}`}>
          <span className={styles.caseMeta}>{planLabel}</span>
          <strong>{caseDisplayNumber}</strong>
          <span className={styles.caseSwitchLabel}>Сменить дело</span>
        </summary>
        <div className={styles.caseSwitchList}>
          {cases.map((item) => (
            <Link
              key={item.id}
              href={`/portal/cases/${item.id}`}
              aria-current={item.id === caseId ? "page" : undefined}
              onClick={mobile ? () => closeDrawer() : undefined}
            >
              <span>{item.planLabel}</span>
              <strong>{item.displayNumber}</strong>
            </Link>
          ))}
        </div>
      </details>
    ) : null;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/portal" className={styles.brand} aria-label="iБюро — личный кабинет">
          <IBuroBrand dot />
        </Link>
        {nav()}
        <div className={styles.sidebarFooter}>
          {caseSwitcher()}
          {accountCard()}
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              aria-label="Открыть меню"
              aria-expanded={drawerOpen}
              aria-controls="iburo-client-mobile-drawer"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>
            <span className={styles.desktopProductLabel}>Цифровой кабинет по делу</span>
          </div>

          <div className={styles.topbarActions}>
            <Link href={`/portal/notifications?caseId=${caseId}`} className={styles.notificationButton} aria-label={unreadCount ? `Уведомления: ${unreadCount} новых` : "Уведомления"}>
              <Bell aria-hidden="true" />
              {unreadCount > 0 ? <span className={styles.notificationBadge}>{Math.min(unreadCount, 99)}</span> : null}
            </Link>

            <details className={styles.userMenu}>
              <summary className={styles.userChip} aria-label="Меню профиля">
                <AccountAvatar className={styles.userAvatar} initialsValue={userInitials} />
                <span className={styles.userCopy}><strong>{displayName}</strong><span>{planLabel}</span></span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className={styles.userPopover}>
                <Link href={`/portal/profile?caseId=${caseId}`}>Профиль</Link>
                <Link href={`/portal/notifications?caseId=${caseId}`}>Уведомления</Link>
                <Link href={`/portal/security?caseId=${caseId}`}>Безопасность</Link>
                <div className={styles.signOutWrap}><SignOutButton /></div>
              </div>
            </details>
          </div>
        </header>

        <main className={styles.main}>{children}</main>
      </div>

      {drawerOpen ? (
        <div className={styles.drawerOverlay} onPointerDown={() => closeDrawer(true)}>
          <aside id="iburo-client-mobile-drawer" className={styles.drawer} aria-label="Меню iБюро" onPointerDown={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <IBuroBrand dot />
              <button ref={closeButtonRef} type="button" aria-label="Закрыть меню" onClick={() => closeDrawer(true)}>
                <X aria-hidden="true" />
              </button>
            </div>
            {nav(true)}
            <div className={styles.drawerAccount}>
              {accountCard()}
              {caseSwitcher(true)}
              <Link className={styles.drawerNotificationLink} href={`/portal/notifications?caseId=${caseId}`} onClick={() => closeDrawer()}>
                Уведомления{unreadCount ? ` · ${unreadCount}` : ""}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
