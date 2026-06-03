// App.jsx — thin wrapper around your existing dashboard.jsx.
// Does NOT modify dashboard.jsx (per T2 scope rule).
//
// EXPORT NOTE: this assumes dashboard.jsx has a DEFAULT export, e.g.
//   export default function Dashboard() { ... }
// If yours is a NAMED export (e.g. `export function Dashboard()`),
// change the import below to:  import { Dashboard } from './dashboard.jsx';
import Dashboard from './dashboard.jsx';

// ── Zone E public/private gate (DEC-04) ─────────────────────────────────────
// publicView = true when the URL is opened as  ?view=public
//              OR the site is built with  VITE_PUBLIC_VIEW=true
//
// IMPORTANT: passing this prop only HIDES Zone E once dashboard.jsx actually
// reads `publicView` and guards the Zone E render, e.g.:
//   {!publicView && <ZoneE ... />}
// Until that one-line guard exists inside dashboard.jsx, Zone E (401k /
// compound simulator / personal finance) is visible to EVERYONE with the link.
const params = new URLSearchParams(window.location.search);
const publicView =
  params.get('view') === 'public' ||
  import.meta.env.VITE_PUBLIC_VIEW === 'true';

export default function App() {
  return <Dashboard publicView={publicView} />;
}
