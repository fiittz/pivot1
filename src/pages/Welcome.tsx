import { useState, useEffect, useRef, useCallback } from "react";
import { Check, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";

const ROTATING_WORDS = ["business", "team", "practice"];

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    clients: "Up to 10 clients",
    description: "For sole practitioners getting started.",
    features: [
      "Up to 10 clients",
      "2 team members",
      "CSV import",
      "ROS & CRO report generation",
      "Client portal & e-signatures",
      "Email support",
    ],
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: 79,
    clients: "Up to 50 clients",
    description: "For growing practices. Most popular.",
    features: [
      "Up to 50 clients",
      "10 team members",
      "Everything in Starter, plus:",
      "Xero, Sage & QuickBooks import",
      "TAIN auto-sync from ROS",
      "Bulk filing workflows",
      "Audit trail & compliance reporting",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    id: "practice",
    name: "Practice",
    price: 149,
    clients: "Unlimited clients",
    description: "For established practices at scale.",
    features: [
      "Unlimited clients",
      "Unlimited team members",
      "Everything in Growth, plus:",
      "Dedicated onboarding",
      "Same-day support",
    ],
    highlighted: false,
  },
];

/* ── Laptop mockup styles (shared) ─────────────────────────── */
const laptopStyles: Record<string, React.CSSProperties> = {
  bezel: { background: "#18181b", borderRadius: "12px 12px 0 0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: "50%" },
  url: { flex: 1, marginLeft: 12, background: "#27272a", borderRadius: 4, padding: "4px 10px", color: "#71717a", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" },
  screen: { background: "#fff", borderLeft: "3px solid #18181b", borderRight: "3px solid #18181b", display: "flex", flexDirection: "column", height: 380, overflow: "hidden" },
  topbar: { height: 40, borderBottom: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 },
  topbarLeft: { display: "flex", alignItems: "center", gap: 6 },
  brand: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, fontWeight: 700, color: "#09090b", letterSpacing: 0.5 },
  avatar: { width: 26, height: 26, borderRadius: "50%", background: "#e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#52525b" },
  contentArea: { display: "flex", flex: 1 },
  sidebar: { width: 140, background: "#f9fafb", borderRight: "1px solid #e5e7eb", padding: "12px 8px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 },
  sidebarItem: { padding: "6px 12px", color: "#6b7280", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, borderRadius: 6 },
  sidebarActive: { padding: "6px 12px", color: "#1e293b", fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, borderRadius: 6, background: "rgba(30,41,59,0.08)" },
  sidebarIcon: { width: 12, height: 12, borderRadius: 3, border: "1.5px solid currentColor", opacity: 0.5 },
  main: { flex: 1, padding: "14px 18px", overflow: "hidden" },
  mainTitle: { fontSize: 16, fontWeight: 700, color: "#09090b" },
  mainSub: { fontSize: 10, color: "#9ca3af", marginBottom: 10 },
  tab: { fontSize: 11, fontWeight: 500, paddingBottom: 6, color: "#9ca3af", cursor: "default" },
  tabActive: { fontSize: 11, fontWeight: 500, paddingBottom: 6, color: "#1e293b", borderBottom: "2px solid #1e293b", cursor: "default" },
  th: { textAlign: "left" as const, fontSize: 10, fontWeight: 500, color: "#6b7280", padding: "6px 10px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "6px 10px", fontSize: 11, color: "#52525b", borderBottom: "1px solid #f4f4f5" },
  tdName: { padding: "6px 10px", fontSize: 11, color: "#09090b", fontWeight: 600, borderBottom: "1px solid #f4f4f5" },
  badge: { display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 500, background: "#f1f5f9", color: "#475569" },
  btn: { background: "#1e293b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" as const },
  bottomBezel: { background: "#18181b", height: 6 },
  base: { background: "#d4d4d8", height: 14, borderRadius: "0 0 4px 4px", boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)" },
};

const LaptopShell = ({ url, activeSidebar, children }: { url: string; activeSidebar: string; children: React.ReactNode }) => (
  <div>
    <div style={laptopStyles.bezel}>
      <div style={{ ...laptopStyles.dot, background: "#ef4444" }} />
      <div style={{ ...laptopStyles.dot, background: "#eab308" }} />
      <div style={{ ...laptopStyles.dot, background: "#22c55e" }} />
      <div style={laptopStyles.url}>{url}</div>
    </div>
    <div style={laptopStyles.screen}>
      <div style={laptopStyles.topbar}>
        <div style={laptopStyles.topbarLeft}>
          <img src="/enhance-penguin-transparent.png" alt="Balnce" style={{ width: 22, height: 22, objectFit: "contain" }} />
          <div style={laptopStyles.brand}>BALNCE</div>
        </div>
        <div style={laptopStyles.avatar}>SR</div>
      </div>
      <div style={laptopStyles.contentArea}>
        <div style={laptopStyles.sidebar} className="hidden md:flex flex-col">
          {["Dashboard", "Clients", "Filings", "Settings", "Team"].map((item) => (
            <div key={item} style={item === activeSidebar ? laptopStyles.sidebarActive : laptopStyles.sidebarItem}>
              <div style={laptopStyles.sidebarIcon} />
              {item}
            </div>
          ))}
        </div>
        <div style={laptopStyles.main}>{children}</div>
      </div>
    </div>
    <div style={laptopStyles.bottomBezel} />
    <div style={laptopStyles.base} />
  </div>
);

/* Screen 1: Clients list */
const ScreenClients = () => (
  <LaptopShell url="app.balnce.ie/clients" activeSidebar="Clients">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={laptopStyles.mainTitle}>Clients</div>
      <div style={laptopStyles.btn}>+ Add Client</div>
    </div>
    <div style={laptopStyles.mainSub}>5 of 10 clients used</div>
    <div style={{ display: "flex", gap: 14, marginBottom: 10, borderBottom: "1px solid #e5e7eb" }}>
      <div style={laptopStyles.tabActive}>Active</div>
      <div style={laptopStyles.tab}>Archived</div>
    </div>
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Name", "Type", "Tax Ref", "CRO", "Year End"].map((h) => (
              <th key={h} style={laptopStyles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["Oakmont Carpentry & Joinery Ltd", "Ltd", "1234567T", "456789", "31 Dec"],
            ["O'Brien Consulting", "Sole Trader", "7654321W", "BN789012", "31 Dec"],
            ["Kavanagh Dental", "Ltd", "9876543A", "321654", "30 Sep"],
            ["Doyle Architects", "LLP", "3456789E", "654321", "31 Mar"],
            ["Walsh & Partners", "Sole Trader", "2345678K", "BN654321", "31 Dec"],
          ].map(([name, type, tax, cro, ye], i) => (
            <tr key={i}>
              <td style={laptopStyles.tdName}>{name}</td>
              <td style={laptopStyles.td}><span style={laptopStyles.badge}>{type}</span></td>
              <td style={laptopStyles.td}>{tax}</td>
              <td style={laptopStyles.td}>{cro}</td>
              <td style={laptopStyles.td}>{ye}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </LaptopShell>
);

/* Screen 2: Dashboard */
const ScreenDashboard = () => (
  <LaptopShell url="app.balnce.ie" activeSidebar="Dashboard">
    <div style={laptopStyles.mainTitle}>Dashboard</div>
    <div style={laptopStyles.mainSub}>Welcome back, Jamie</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
      {[
        { label: "Active Clients", value: "5", color: "#E8930C" },
        { label: "Filings This Month", value: "12", color: "#22c55e" },
        { label: "Pending Signatures", value: "3", color: "#3b82f6" },
        { label: "Next Deadline", value: "23 Sep", sub: "CT1 · Oakmont", color: "#ef4444" },
      ].map((card) => (
        <div key={card.label} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 8, color: "#9ca3af", fontWeight: 500, marginBottom: 3 }}>{card.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: card.color }}>{card.value}</div>
          {"sub" in card && card.sub && <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 1 }}>{card.sub}</div>}
        </div>
      ))}
    </div>
    <div style={{ fontSize: 12, fontWeight: 600, color: "#09090b", marginBottom: 8 }}>Recent Activity</div>
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      {[
        { action: "CT1 filed", client: "Kavanagh Dental", time: "2h ago", status: "Filed" },
        { action: "Signature received", client: "Doyle Architects", time: "4h ago", status: "Signed" },
        { action: "Form 11 draft", client: "O'Brien Consulting", time: "1d ago", status: "Draft" },
      ].map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: i < 2 ? "1px solid #f4f4f5" : "none" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#09090b" }}>{row.action}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>{row.client}</div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <span style={{ ...laptopStyles.badge, background: row.status === "Filed" ? "#dcfce7" : row.status === "Signed" ? "#dbeafe" : "#f1f5f9", color: row.status === "Filed" ? "#166534" : row.status === "Signed" ? "#1e40af" : "#475569" }}>{row.status}</span>
            <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>{row.time}</div>
          </div>
        </div>
      ))}
    </div>
  </LaptopShell>
);

/* Screen 3: Filing workspace */
const ScreenWorkspace = () => (
  <LaptopShell url="app.balnce.ie/workspaces/ct1-2025" activeSidebar="Filings">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={laptopStyles.mainTitle}>CT1 — Oakmont Carpentry & Joinery Ltd</div>
        <div style={laptopStyles.mainSub}>Tax Year 2025 · Draft</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ ...laptopStyles.btn, background: "#fff", color: "#1e293b", border: "1px solid #e5e7eb" }}>Preview</div>
        <div style={laptopStyles.btn}>File to ROS</div>
      </div>
    </div>
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Section", "Amount", "Source", ""].map((h) => (
              <th key={h} style={laptopStyles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["Adjusted Trading Profit", "€157,000", "Xero", "subtotal"],
            ["Capital Allowances", "€(8,400)", "Workbook", "credit"],
            ["Excess CA Carry Forward", "€(1,050)", "Prior Year", "credit"],
            ["Corporation Tax @ 12.5%", "€18,444", "Workbook", "figure"],
            ["Employment Credit", "€(3,200)", "ROS", "credit"],
            ["Start-Up Relief (s486C)", "€(5,000)", "Workbook", "credit"],
            ["Net CT Payable", "€10,244", "Workbook", "subtotal"],
          ].map(([label, amount, source, type], i) => (
            <tr key={i} style={type === "subtotal" ? { background: "#f9fafb" } : {}}>
              <td style={{ ...laptopStyles.tdName, fontWeight: type === "subtotal" ? 700 : 600 }}>{label}</td>
              <td style={{ ...laptopStyles.td, color: type === "credit" ? "#16a34a" : "#52525b", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{amount}</td>
              <td style={laptopStyles.td}><span style={laptopStyles.badge}>{source}</span></td>
              <td style={laptopStyles.td}><span style={{ ...laptopStyles.badge, background: type === "credit" ? "#dbeafe" : type === "subtotal" ? "#fef3c7" : "#f1f5f9", color: type === "credit" ? "#1e40af" : type === "subtotal" ? "#92400e" : "#475569" }}>{type}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </LaptopShell>
);

/* Screen 4: Form 11 workspace */
const ScreenForm11 = () => (
  <LaptopShell url="app.balnce.ie/workspaces/form11-2025" activeSidebar="Filings">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={laptopStyles.mainTitle}>Form 11 — Siobhán Byrne</div>
        <div style={laptopStyles.mainSub}>Tax Year 2025 · In Review</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ ...laptopStyles.btn, background: "#fff", color: "#1e293b", border: "1px solid #e5e7eb" }}>Preview</div>
        <div style={laptopStyles.btn}>File to ROS</div>
      </div>
    </div>
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Section", "Amount", "Source", ""].map((h) => (
              <th key={h} style={laptopStyles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["Self-Employment Income", "€94,200", "Sage", "figure"],
            ["Rental Income", "€18,600", "Manual", "figure"],
            ["Allowable Expenses", "€(31,400)", "Sage", "deduction"],
            ["Capital Allowances", "€(4,200)", "Manual", "deduction"],
            ["Pension Contribution", "€(8,000)", "Manual", "credit"],
            ["Net Income", "€69,200", "Workbook", "subtotal"],
            ["Tax Credits", "€(4,000)", "ROS", "credit"],
            ["Tax Payable", "€19,339", "Workbook", "subtotal"],
          ].map(([label, amount, source, type], i) => (
            <tr key={i} style={type === "subtotal" ? { background: "#f9fafb" } : {}}>
              <td style={{ ...laptopStyles.tdName, fontWeight: type === "subtotal" ? 700 : 600 }}>{label}</td>
              <td style={{ ...laptopStyles.td, color: type === "deduction" || type === "credit" ? "#16a34a" : "#52525b", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{amount}</td>
              <td style={laptopStyles.td}><span style={laptopStyles.badge}>{source}</span></td>
              <td style={laptopStyles.td}><span style={{ ...laptopStyles.badge, background: type === "credit" ? "#dbeafe" : type === "deduction" ? "#dcfce7" : type === "subtotal" ? "#fef3c7" : "#f1f5f9", color: type === "credit" ? "#1e40af" : type === "deduction" ? "#166534" : type === "subtotal" ? "#92400e" : "#475569" }}>{type}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </LaptopShell>
);

/* Screen 5: CRO Abridged Accounts */
const ScreenAbridged = () => (
  <LaptopShell url="app.balnce.ie/workspaces/abridged-2025" activeSidebar="Filings">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={laptopStyles.mainTitle}>Abridged Accounts — Oakmont Carpentry & Joinery Ltd</div>
        <div style={laptopStyles.mainSub}>Year End 31 Dec 2025 · Ready to File</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ ...laptopStyles.btn, background: "#fff", color: "#1e293b", border: "1px solid #e5e7eb" }}>Download PDF</div>
        <div style={{ ...laptopStyles.btn, background: "#fff", color: "#E8930C", border: "1px solid #E8930C" }}>Send for Signature</div>
        <div style={laptopStyles.btn}>File to CRO</div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {/* Assets */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ ...laptopStyles.th, fontSize: 11, fontWeight: 600, color: "#09090b" }}>Assets</div>
        {[
          ["Tangible Assets", "€58,800", false],
          ["Debtors", "€34,500", false],
          ["Cash at Bank", "€62,400", false],
          ["Total Assets", "€155,700", true],
        ].map(([label, amount, bold], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid #f4f4f5", background: bold ? "#f9fafb" : "#fff" }}>
            <span style={{ fontSize: 11, color: "#09090b", fontWeight: bold ? 700 : 400 }}>{label as string}</span>
            <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "#52525b", fontWeight: bold ? 700 : 400 }}>{amount as string}</span>
          </div>
        ))}
      </div>
      {/* Liabilities */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ ...laptopStyles.th, fontSize: 11, fontWeight: 600, color: "#09090b" }}>Liabilities</div>
        {[
          ["Creditors < 1 year", "€(31,244)", false],
          ["Creditors > 1 year", "€(15,000)", false],
          ["Total Liabilities", "€(46,244)", true],
          ["Net Assets", "€109,456", true],
        ].map(([label, amount, bold], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid #f4f4f5", background: bold ? "#f9fafb" : "#fff" }}>
            <span style={{ fontSize: 11, color: "#09090b", fontWeight: bold ? 700 : 400 }}>{label as string}</span>
            <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: (amount as string).startsWith("€(") ? "#16a34a" : "#52525b", fontWeight: bold ? 700 : 400 }}>{amount as string}</span>
          </div>
        ))}
      </div>
    </div>
    {/* Capital */}
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginTop: 10 }}>
      <div style={{ ...laptopStyles.th, fontSize: 11, fontWeight: 600, color: "#09090b" }}>Capital & Reserves</div>
      {[
        ["Called Up Share Capital", "€100"],
        ["Profit & Loss Account", "€109,356"],
        ["Shareholders' Funds", "€109,456"],
      ].map(([label, amount], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid #f4f4f5", background: i === 2 ? "#f9fafb" : "#fff" }}>
          <span style={{ fontSize: 11, color: "#09090b", fontWeight: i === 2 ? 700 : 400 }}>{label}</span>
          <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "#52525b", fontWeight: i === 2 ? 700 : 400 }}>{amount}</span>
        </div>
      ))}
    </div>
  </LaptopShell>
);

/* Screen 6: Audit Trail */
const ScreenAuditTrail = () => (
  <LaptopShell url="app.balnce.ie/workspaces/ct1-2025" activeSidebar="Filings">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={laptopStyles.mainTitle}>Audit Trail — Oakmont Carpentry & Joinery Ltd</div>
    </div>
    <div style={laptopStyles.mainSub}>CT1 · Tax Year 2025 · All changes tracked</div>
    <div style={{ display: "flex", gap: 14, marginBottom: 10, borderBottom: "1px solid #e5e7eb" }}>
      <div style={laptopStyles.tabActive}>All Activity</div>
      <div style={laptopStyles.tab}>Changes</div>
      <div style={laptopStyles.tab}>Comments</div>
    </div>
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      {[
        { user: "SR", name: "Siobhán R.", action: "Approved filing for submission", node: "", time: "Today, 14:32", color: "#16a34a" },
        { user: "SR", name: "Siobhán R.", action: "Applied Start-Up Relief (s486C)", node: "€5,000 credit added", time: "Today, 14:18", color: "#E8930C" },
        { user: "DK", name: "Darragh K.", action: "Added comment on Employment Credit", node: "\"Verify headcount with payroll\"", time: "Today, 11:05", color: "#3b82f6" },
        { user: "DK", name: "Darragh K.", action: "Changed Cost of Sales", node: "€108,900 → €112,300", time: "Yesterday, 16:42", color: "#E8930C" },
        { user: "DK", name: "Darragh K.", action: "Imported trial balance from Xero", node: "48 accounts mapped", time: "Yesterday, 09:15", color: "#8b5cf6" },
        { user: "SR", name: "Siobhán R.", action: "Created workspace", node: "CT1 · Tax Year 2025", time: "12 Mar, 10:00", color: "#6b7280" },
      ].map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: i < 5 ? "1px solid #f4f4f5" : "none", alignItems: "flex-start" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#52525b", flexShrink: 0, marginTop: 1 }}>{row.user}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#09090b" }}>
              <span style={{ fontWeight: 600 }}>{row.name}</span>{" "}
              <span style={{ color: "#52525b" }}>{row.action}</span>
            </div>
            {row.node && (
              <div style={{ fontSize: 10, color: row.color, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>{row.node}</div>
            )}
          </div>
          <div style={{ fontSize: 9, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0 }}>{row.time}</div>
        </div>
      ))}
    </div>
  </LaptopShell>
);

const CAROUSEL_SCREENS = [
  { id: "dashboard", label: "Dashboard", component: ScreenDashboard },
  { id: "clients", label: "Clients", component: ScreenClients },
  { id: "workspace", label: "CT1", component: ScreenWorkspace },
  { id: "form11", label: "Form 11", component: ScreenForm11 },
  { id: "abridged", label: "Abridged", component: ScreenAbridged },
  { id: "audit", label: "Audit Trail", component: ScreenAuditTrail },
];

function LaptopCarousel() {
  const [active, setActive] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const next = useCallback(() => setActive((p) => (p + 1) % CAROUSEL_SCREENS.length), []);
  const prev = useCallback(() => setActive((p) => (p - 1 + CAROUSEL_SCREENS.length) % CAROUSEL_SCREENS.length), []);

  useEffect(() => {
    intervalRef.current = setInterval(next, 5000);
    return () => clearInterval(intervalRef.current);
  }, [next]);

  const goTo = (i: number) => {
    setActive(i);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(next, 5000);
  };

  const Screen = CAROUSEL_SCREENS[active].component;

  return (
    <section className="px-6 md:px-12 py-24 border-t border-black/10 bg-[#f5f5f5]">
      <div className="max-w-4xl mx-auto">
        <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] mb-4 text-center">
          See It In Action
        </p>
        <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-4xl mb-12 text-center">
          Built for how you work.
        </h2>
        <p className="font-['IBM_Plex_Sans'] text-black/40 text-sm text-center mb-12">
          See it for yourself —{" "}
          <a href="https://calendly.com/jamie-balnce/30min" target="_blank" rel="noopener noreferrer" className="text-[#E8930C] hover:underline font-medium">
            book a 30-minute demo
          </a>
        </p>

        {/* Laptop */}
        <div className="relative">
          <div style={{ transition: "opacity 0.3s ease" }}>
            <Screen />
          </div>

          {/* Nav arrows */}
          <button
            onClick={() => { prev(); clearInterval(intervalRef.current); intervalRef.current = setInterval(next, 5000); }}
            className="absolute left-[-48px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors hidden lg:flex"
          >
            <ChevronLeft className="w-5 h-5 text-black/40" />
          </button>
          <button
            onClick={() => { next(); clearInterval(intervalRef.current); intervalRef.current = setInterval(next, 5000); }}
            className="absolute right-[-48px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors hidden lg:flex"
          >
            <ChevronRight className="w-5 h-5 text-black/40" />
          </button>
        </div>

        {/* Dots + labels */}
        <div className="flex items-center justify-center gap-6 mt-8">
          {CAROUSEL_SCREENS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors ${
                i === active ? "text-[#E8930C]" : "text-black/30 hover:text-black/50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

const Welcome = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <img
            src="/enhance-penguin-transparent.png"
            alt="Balnce"
            className="w-8 h-8 object-contain"
          />
          <span className="text-2xl font-bold tracking-[0.15em] text-black" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            BALNCE
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => scrollTo("for-you")}
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-black/60 hover:text-black transition-colors hidden sm:block"
          >
            For You
          </button>
          <button
            onClick={() => scrollTo("features")}
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-black/60 hover:text-black transition-colors hidden sm:block"
          >
            Features
          </button>
          <button
            onClick={() => scrollTo("pricing")}
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-black/60 hover:text-black transition-colors hidden sm:block"
          >
            Pricing
          </button>
          <a
            href="https://calendly.com/jamie-balnce/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:text-[#d4840b] transition-colors hidden sm:block"
          >
            Book a Demo
          </a>
          <a
            href="https://app.balnce.ie"
            className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border border-black px-5 py-2.5 text-black hover:bg-black hover:text-white transition-colors"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-4xl text-center">
          <h1
            className="font-['IBM_Plex_Sans'] font-bold tracking-tight leading-[1.1] mb-6"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}
          >
            <span className="text-black">Your </span>
            <span
              className={`inline-block transition-all duration-300 ${
                isAnimating
                  ? "opacity-0 translate-y-2"
                  : "opacity-100 translate-y-0"
              }`}
              style={{ color: "#E8930C", minWidth: "3ch" }}
            >
              {ROTATING_WORDS[wordIndex]}
            </span>
            <span className="text-black"> deserves</span>
            <br />
            <span className="text-black">better tools.</span>
          </h1>

          <p className="font-['IBM_Plex_Sans'] text-black/50 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Irish tax filing, simplified. ROS, CRO, and practice
            management — one platform built for Irish accountants.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => scrollTo("pricing")}
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border-2 border-[#E8930C] bg-[#E8930C] px-8 py-4 text-white hover:bg-[#E8930C]/90 transition-colors"
            >
              Get Started
            </button>
            <a
              href="https://calendly.com/jamie-balnce/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border-2 border-black px-8 py-4 text-black hover:bg-black hover:text-white transition-colors"
            >
              Book a Demo
            </a>
          </div>

        </div>
      </div>

      {/* Social Proof */}
      <section className="px-6 md:px-12 py-16 border-t border-black/10 bg-white">
        <div className="max-w-md mx-auto text-center">
          <blockquote className="font-['IBM_Plex_Sans'] text-black/60 text-lg leading-relaxed mb-4 italic">
            "Balnce cut our filing time from hours to minutes."
          </blockquote>
          <p className="font-['IBM_Plex_Sans'] font-semibold text-black text-sm">
            Siobhán
          </p>
          <p className="font-['IBM_Plex_Mono'] text-[11px] text-black/40 uppercase tracking-widest">
            Managing Partner
          </p>
        </div>
      </section>

      {/* Integrations ticker */}
      <section className="py-14 border-t border-black/10 bg-white overflow-hidden">
        <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-black/30 text-center mb-10">
          Integrates with
        </p>
        <div className="max-w-3xl mx-auto relative overflow-hidden">
          <div className="flex animate-[scroll_30s_linear_infinite] gap-24 w-max" style={{ paddingLeft: "calc(50% - 120px)" }}>
            {[...Array(3)].map((_, dupeIdx) => (
              <div key={dupeIdx} className="flex gap-24 items-center">
                {[
                  { name: "Xero", img: "/logos/xero.png" },
                  { name: "Sage", img: "/logos/sage.jpg" },
                  { name: "QuickBooks", img: "/logos/quickbooks.png" },
                  { name: "Revenue.ie", img: "/logos/revenue.jpg" },
                  { name: "CRO", img: "/logos/cro.gif" },
                  { name: "Excel", img: "/logos/excel.png" },
                ].map((int) => (
                  <div key={int.name} className="flex flex-col items-center gap-3 shrink-0" style={{ width: 140 }}>
                    {int.img ? (
                      <img src={int.img} alt={int.name} className={`${int.name === "Revenue.ie" ? "h-32 md:h-40" : "h-16 md:h-20"} w-auto object-contain`} style={{ maxWidth: int.name === "Revenue.ie" ? 280 : 140 }} />
                    ) : (
                      <div className="h-16 md:h-20 flex items-center justify-center px-4 rounded-lg border border-black/10 bg-white">
                        <span className="font-['IBM_Plex_Sans'] font-bold text-xl md:text-2xl text-black/50">{int.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
      </section>

      {/* How it works — Visual Pipeline */}
      <section id="features" className="px-4 md:px-12 py-12 md:py-24 border-t border-black/10 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] mb-3 md:mb-4" style={{ textAlign: "center" }}>
            How It Works
          </p>
          <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-2xl md:text-4xl mb-3 md:mb-4 text-center">
            Everything flows through Balnce.
          </h2>
          <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm md:text-base text-center mb-8 md:mb-16">
            See it in action —{" "}
            <a href="https://calendly.com/jamie-balnce/30min" target="_blank" rel="noopener noreferrer" className="text-[#E8930C] hover:underline font-medium">
              book a 30-minute demo
            </a>.
          </p>

          {/* Visual pipeline */}
          <div className="relative" style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* === ROW 1: Input steps === */}
            <div className="grid grid-cols-3 gap-3 md:gap-6 mb-4">
              {[
                { label: "Connect", desc: "Upload your cert. Clients sync from Revenue." },
                { label: "Import", desc: "Pull numbers from Xero, Sage, or CSV." },
                { label: "Team", desc: "Invite your team. Control access." },
              ].map((step) => (
                <div key={step.label} className="text-center">
                  <div
                    className="inline-block border border-black rounded-full px-3 md:px-5 py-1.5 md:py-2 mb-2 md:mb-3"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "clamp(10px, 2.5vw, 13px)", fontWeight: 500 }}
                  >
                    {step.label}
                  </div>
                  <p className="font-['IBM_Plex_Sans'] text-black/40 text-[9px] md:text-xs leading-snug md:leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* === SVG: Top arrows → Hub → Bottom arrows with animated dots === */}
            <div style={{ position: "relative", height: "clamp(160px, 35vw, 280px)" }}>
              <svg viewBox="0 0 800 280" fill="none" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
                {/* Top lines converging to hub */}
                <line x1="133" y1="0" x2="400" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                <line x1="400" y1="0" x2="400" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                <line x1="667" y1="0" x2="400" y2="100" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />

                {/* Animated orange dots flowing DOWN top lines */}
                <circle r="3.5" fill="#E8930C">
                  <animateMotion dur="2s" repeatCount="indefinite" path="M133,0 L400,100" />
                </circle>
                <circle r="3.5" fill="#E8930C">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="0.3s" path="M400,0 L400,100" />
                </circle>
                <circle r="3.5" fill="#E8930C">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="0.6s" path="M667,0 L400,100" />
                </circle>

                {/* Second wave — staggered */}
                <circle r="2.5" fill="#E8930C" opacity="0.5">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1s" path="M133,0 L400,100" />
                </circle>
                <circle r="2.5" fill="#E8930C" opacity="0.5">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1.3s" path="M400,0 L400,100" />
                </circle>
                <circle r="2.5" fill="#E8930C" opacity="0.5">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1.6s" path="M667,0 L400,100" />
                </circle>

                {/* Bottom lines from hub to outputs */}
                <line x1="400" y1="180" x2="133" y2="280" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                <line x1="400" y1="180" x2="400" y2="280" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                <line x1="400" y1="180" x2="667" y2="280" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />

                {/* Animated orange dots flowing DOWN from hub */}
                <circle r="3.5" fill="#E8930C">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1s" path="M400,180 L133,280" />
                </circle>
                <circle r="3.5" fill="#E8930C">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1.3s" path="M400,180 L400,280" />
                </circle>
                <circle r="3.5" fill="#E8930C">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="1.6s" path="M400,180 L667,280" />
                </circle>

                <circle r="2.5" fill="#E8930C" opacity="0.5">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="2s" path="M400,180 L133,280" />
                </circle>
                <circle r="2.5" fill="#E8930C" opacity="0.5">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="2.3s" path="M400,180 L400,280" />
                </circle>
                <circle r="2.5" fill="#E8930C" opacity="0.5">
                  <animateMotion dur="2s" repeatCount="indefinite" begin="2.6s" path="M400,180 L667,280" />
                </circle>
              </svg>

              {/* Hub — centre penguin */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "clamp(50px, 10vw, 80px)",
                  height: "clamp(50px, 10vw, 80px)",
                  background: "#fff",
                  border: "2px solid #E8930C",
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}
              >
                <img
                  src="/enhance-penguin-transparent.png"
                  alt="Balnce"
                  style={{ width: "85%", height: "85%", objectFit: "contain" }}
                />
              </div>
            </div>

            {/* === ROW 2: Output steps === */}
            <div className="grid grid-cols-3 gap-3 md:gap-6 mt-4">
              {[
                { label: "Manage", desc: "Clients, filings, audit trail. All in one place." },
                { label: "Work", desc: "ROS & CRO filings built and reviewed in one workplace." },
                { label: "Client Portal", desc: "Client signs on screen. No printing." },
              ].map((step) => (
                <div key={step.label} className="text-center">
                  <div
                    className="inline-block border border-black rounded-full px-3 md:px-5 py-1.5 md:py-2 mb-2 md:mb-3"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "clamp(10px, 2.5vw, 13px)", fontWeight: 500 }}
                  >
                    {step.label}
                  </div>
                  <p className="font-['IBM_Plex_Sans'] text-black/40 text-[9px] md:text-xs leading-snug md:leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* === Bottom: horizontal bar + vertical drop to File === */}
            <div style={{ position: "relative", height: "clamp(30px, 8vw, 60px)" }}>
              <svg viewBox="0 0 800 60" fill="none" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
                <line x1="133" y1="0" x2="667" y2="0" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                <line x1="400" y1="0" x2="400" y2="60" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
                <circle r="3" fill="#E8930C" opacity="0.7">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path="M133,0 L400,0" />
                </circle>
                <circle r="3" fill="#E8930C" opacity="0.7">
                  <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.3s" path="M667,0 L400,0" />
                </circle>
                <circle r="3" fill="#E8930C" opacity="0.7">
                  <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.6s" path="M400,0 L400,60" />
                </circle>
              </svg>
            </div>

            <div className="text-center mt-2 md:mt-0">
              <a
                href="https://app.balnce.ie"
                className="inline-block border-2 border-[#E8930C] bg-[#E8930C] rounded-full px-4 md:px-8 py-2 md:py-3 text-white whitespace-nowrap hover:bg-[#d4840b] hover:border-[#d4840b] transition-colors cursor-pointer"
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "clamp(9px, 2.5vw, 14px)", fontWeight: 600, textDecoration: "none" }}
              >
                Generate & File Tax Reports in Minutes
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Laptop Carousel */}
      <LaptopCarousel />

      {/* 04 / Pricing */}
      <section id="pricing" className="px-6 md:px-12 py-24 border-t border-black/10 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] mb-4">
            04 / Pricing
          </p>
          <div className="text-center mb-16">
            <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-4xl mb-4">
              Simple, transparent pricing.
            </h2>
            <p className="font-['IBM_Plex_Sans'] text-black/50 text-lg max-w-2xl mx-auto">
              Pick a plan based on how many clients you manage. Usage-based filing options also available —{" "}
              <a href="https://calendly.com/jamie-balnce/30min" target="_blank" rel="noopener noreferrer" className="text-[#E8930C] hover:underline">
                book a demo
              </a>{" "}
              to find what works for your practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col p-8 ${
                  plan.highlighted
                    ? "border-2 border-[#E8930C] bg-white shadow-lg"
                    : "border border-black/10 bg-white"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="font-['IBM_Plex_Mono'] text-[10px] uppercase tracking-widest bg-[#E8930C] text-white px-4 py-1">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="font-['IBM_Plex_Sans'] font-bold text-black text-xl mb-1">
                  {plan.name}
                </h3>
                <p className="font-['IBM_Plex_Sans'] text-black/50 text-sm mb-6">
                  {plan.description}
                </p>

                <div className="mb-6">
                  <span className="font-['IBM_Plex_Sans'] font-bold text-4xl text-black">
                    €{plan.price}
                  </span>
                  <span className="font-['IBM_Plex_Sans'] text-black/40 text-sm">
                    /month
                  </span>
                </div>

                <p className="font-['IBM_Plex_Mono'] text-xs text-[#E8930C] font-bold uppercase tracking-wider mb-6">
                  {plan.clients}
                </p>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#E8930C] mt-0.5 flex-shrink-0" />
                      <span className="font-['IBM_Plex_Sans'] text-black/60 text-sm">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={`https://app.balnce.ie?plan=${plan.id}`}
                  className={`block text-center font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest px-6 py-4 transition-colors ${
                    plan.highlighted
                      ? "border-2 border-[#E8930C] bg-[#E8930C] text-white hover:bg-[#E8930C]/90"
                      : "border border-black/20 text-black hover:bg-black hover:text-white"
                  }`}
                >
                  Get Started
                </a>
              </div>
            ))}
          </div>

          <p className="text-center font-['IBM_Plex_Sans'] text-black/30 text-sm mt-8">
            All prices exclude VAT.{" "}
            <a href="https://calendly.com/jamie-balnce/30min" target="_blank" rel="noopener noreferrer" className="text-[#E8930C] hover:underline font-medium">Book a demo</a> anytime.
          </p>
        </div>
      </section>

      {/* 05 / CTA */}
      <section className="px-6 md:px-12 py-24 border-t border-black/10 bg-[#f5f5f5]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] mb-6">
            Ready to automate?
          </p>
          <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-3xl md:text-5xl leading-tight mb-6">
            Generate & file tax reports<br />in minutes.
          </h2>
          <p className="font-['IBM_Plex_Sans'] text-black/50 text-lg mb-10">
            Join Irish practices already saving hours on every return.
          </p>
          <a
            href="https://app.balnce.ie"
            className="inline-block font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest border-2 border-[#E8930C] bg-[#E8930C] px-10 py-4 text-white hover:bg-[#E8930C]/90 transition-colors"
          >
            Create Account
          </a>
        </div>
      </section>

      {/* 06 / Location */}
      <section className="px-6 md:px-12 py-24 border-t border-black/10">
        <div className="max-w-5xl mx-auto">
          <p className="font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] mb-4">
            06 / Location
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
              <h2 className="font-['IBM_Plex_Sans'] font-bold text-black text-2xl mb-6">
                BALNCE
              </h2>
              <div className="font-['IBM_Plex_Sans'] text-black/50 text-sm leading-relaxed space-y-1">
                <a
                  href="https://maps.google.com/?q=61+Thomas+St,+The+Liberties,+Dublin+8,+D08+W250,+Ireland"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:text-black transition-colors"
                >
                  <p>3rd Floor, 61 Thomas St</p>
                  <p>The Liberties, Dublin 8</p>
                  <p>D08 W250, Ireland</p>
                </a>
                <p className="pt-2">
                  <a
                    href="mailto:hello@balnce.ie"
                    className="text-black/60 hover:text-black transition-colors"
                  >
                    hello@balnce.ie
                  </a>
                </p>
                <p className="pt-3">
                  <a
                    href="https://calendly.com/jamie-balnce/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E8930C] hover:text-[#d4840b] font-medium transition-colors"
                  >
                    Book an in-person meeting →
                  </a>
                </p>
              </div>
            </div>
            <div>
              <a
                href="https://calendly.com/jamie-balnce/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="font-['IBM_Plex_Sans'] text-sm text-[#E8930C] hover:text-[#d4840b] font-medium transition-colors inline-block mb-3"
              >
                Book an in-person meeting ↓
              </a>
              <div className="rounded-lg overflow-hidden border border-black/10" style={{ height: 220 }}>
                <iframe
                  title="Balnce Location"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2382.1!2d-6.2785!3d53.3405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x48670e9f2d4b9c1d%3A0x0!2s61+Thomas+St%2C+The+Liberties%2C+Dublin+8!5e0!3m2!1sen!2sie!4v1"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-12 border-t border-black/10">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src="/enhance-penguin-transparent.png"
                  alt="Balnce"
                  className="w-6 h-6 object-contain"
                />
                <span className="font-['IBM_Plex_Sans'] font-bold text-black text-sm">
                  BALNCE
                </span>
              </div>
              <p className="font-['IBM_Plex_Sans'] text-black/40 text-xs">
                Irish tax filing, simplified.
              </p>
            </div>

            {/* Navigate */}
            <div>
              <h4 className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-widest text-black/30 mb-4">
                Navigate
              </h4>
              <div className="space-y-2">
                <button
                  onClick={() => scrollTo("for-you")}
                  className="block font-['IBM_Plex_Sans'] text-sm text-black/60 hover:text-black transition-colors"
                >
                  For You
                </button>
                <button
                  onClick={() => scrollTo("features")}
                  className="block font-['IBM_Plex_Sans'] text-sm text-black/60 hover:text-black transition-colors"
                >
                  Features
                </button>
                <button
                  onClick={() => scrollTo("pricing")}
                  className="block font-['IBM_Plex_Sans'] text-sm text-black/60 hover:text-black transition-colors"
                >
                  Pricing
                </button>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-widest text-black/30 mb-4">
                Legal
              </h4>
              <div className="space-y-2">
                <a
                  href="/privacy"
                  className="block font-['IBM_Plex_Sans'] text-sm text-black/60 hover:text-black transition-colors"
                >
                  Privacy Policy
                </a>
                <a
                  href="/terms"
                  className="block font-['IBM_Plex_Sans'] text-sm text-black/60 hover:text-black transition-colors"
                >
                  Terms of Service
                </a>
              </div>
            </div>

            {/* Connect */}
            <div>
              <h4 className="font-['IBM_Plex_Mono'] text-[11px] uppercase tracking-widest text-black/30 mb-4">
                Connect
              </h4>
              <div className="space-y-2">
                <a
                  href="mailto:hello@balnce.ie"
                  className="block font-['IBM_Plex_Sans'] text-sm text-black/60 hover:text-black transition-colors"
                >
                  hello@balnce.ie
                </a>
                <a
                  href="https://linkedin.com/company/balnce"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-['IBM_Plex_Sans'] text-sm text-black/60 hover:text-black transition-colors"
                >
                  LinkedIn
                </a>
                <a
                  href="https://calendly.com/jamie-balnce/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-['IBM_Plex_Sans'] text-sm text-[#E8930C] hover:text-[#d4840b] font-medium transition-colors"
                >
                  Book a Demo
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-black/10 pt-6">
            <p className="font-['IBM_Plex_Sans'] text-black/30 text-xs">
              &copy; {new Date().getFullYear()} Balnce. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;
