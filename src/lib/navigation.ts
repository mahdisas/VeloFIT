import {
  Archive,
  Boxes,
  Calendar,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Dumbbell,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  ListTodo,
  type LucideIcon,
  MapPin,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Ruler,
  Settings,
  Settings2,
  Shapes,
  Table,
  Tags,
  User,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";

export type NavChild = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Present → renders as a collapsible group (e.g. Classes) */
  children?: NavChild[];
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Summary", href: "/summary", icon: ClipboardList },
  { title: "Clients", href: "/clients", icon: Users },
  { title: "Leads", href: "/leads", icon: UserPlus },
  { title: "Tasks", href: "/tasks", icon: ListTodo },
  { title: "Messages Center", href: "/messages", icon: MessagesSquare },
  {
    title: "Classes",
    href: "/classes",
    icon: CalendarDays,
    children: [
      { title: "Calendar", href: "/classes/calendar", icon: Calendar },
      { title: "Classes Table", href: "/classes/table", icon: Table },
      { title: "Classes Kinds", href: "/classes/kinds", icon: Shapes },
      { title: "Groups Management", href: "/classes/groups", icon: UsersRound },
      { title: "Classes Settings", href: "/classes/settings", icon: Settings2 },
    ],
  },
  { title: "Reports", href: "/reports", icon: ChartColumn },
  { title: "Workouts Plans", href: "/workout-plans", icon: Dumbbell },
  {
    title: "Finance",
    href: "/finance",
    icon: Wallet,
    children: [
      { title: "Products", href: "/finance/products", icon: Boxes },
      { title: "Categories", href: "/finance/categories", icon: Tags },
      { title: "Subscription Packages", href: "/finance/subscription-packages", icon: Layers },
    ],
  },
  {
    title: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    children: [
      { title: "Campaigns", href: "/marketing/campaigns", icon: LayoutGrid },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { title: "SMS Settings", href: "/settings/sms-settings", icon: MessageSquare },
      { title: "Locations", href: "/settings/locations", icon: MapPin },
      { title: "Measurement Types", href: "/settings/measurement-types", icon: Ruler },
      { title: "Users", href: "/settings/users", icon: User },
    ],
  },
  {
    title: "Archive",
    href: "/archive",
    icon: Archive,
    children: [
      { title: "Users", href: "/archive/users", icon: UserRound },
      { title: "Clients", href: "/archive/clients", icon: UsersRound },
    ],
  },
];

/**
 * Per-gym page visibility (platform console → gym → Pages). The operator can
 * hide any top-level section a gym doesn't need; the hidden hrefs live in
 * gyms.settings.hiddenPages and the sidebar filters on them. Dashboard and
 * Settings are locked so a gym can never lose its home or its own controls.
 * NOTE: this is decluttering, not a security boundary — direct URLs still work.
 */
export const LOCKED_NAV_HREFS = new Set(["/dashboard", "/settings"]);

/** The sections the platform console may hide, as { href, title } pairs. */
export const HIDEABLE_NAV: { href: string; title: string }[] = NAV_ITEMS.filter(
  (i) => !LOCKED_NAV_HREFS.has(i.href)
).map((i) => ({ href: i.href, title: i.title }));
