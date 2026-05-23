import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/workouts", label: "Workouts" },
  { href: "/coach", label: "Coach" },
  { href: "/profile", label: "Profile" },
  { href: "/race", label: "Race" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <nav className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-1 overflow-x-auto">
        <span className="font-semibold mr-3">🏊‍♂️🚴‍♂️🏃‍♂️</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 rounded text-sm hover:bg-zinc-100 whitespace-nowrap"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
