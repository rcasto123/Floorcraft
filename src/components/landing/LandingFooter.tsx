import { Link } from 'react-router-dom'

/**
 * Expanded landing-page footer.
 *
 * The pre-polish footer was a single inline line ("Floorcraft ·
 * User guide & FAQ"), which reads like a hackathon project. Real SaaS
 * sites close with a small grid of link columns — Product /
 * Resources / Company — even if half the links are aspirational. The
 * columns signal "there is a business behind this" without needing
 * the links to actually go anywhere substantive yet.
 *
 * Because no /pricing, /changelog, /privacy, or /terms routes exist in
 * the app shell, every placeholder link points at /help. This keeps
 * the layout honest (no 404s) and the help page is where a curious
 * user would plausibly land anyway when clicking "Privacy" or
 * "Security" on a still-small product. /signup and / are the only
 * routes guaranteed by the router.
 */

type FooterLink = { label: string; to: string }
type FooterColumn = { title: string; links: ReadonlyArray<FooterLink> }

const COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/help' },
      { label: 'Pricing', to: '/help' },
      { label: 'Changelog', to: '/help' },
      { label: 'Sign up', to: '/signup' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'User guide', to: '/help' },
      { label: 'Keyboard shortcuts', to: '/help' },
      { label: 'CSV templates', to: '/help' },
      { label: 'Status', to: '/help' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/help' },
      { label: 'Contact', to: '/help' },
      { label: 'Privacy', to: '/help' },
      { label: 'Terms', to: '/help' },
    ],
  },
]

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      aria-labelledby="landing-footer-heading"
      className="border-t border-[color:var(--color-paper-line)] dark:border-gray-800 bg-[color:var(--color-paper)] dark:bg-gray-950"
    >
      <h2 id="landing-footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 gap-8 sm:grid-cols-4">
        {/* Wordmark / tagline column — anchors the footer visually and
            keeps the link columns from feeling like a directory. */}
        <div className="col-span-2 sm:col-span-1">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-semibold tracking-tight text-gray-900 dark:text-gray-100"
          >
            <span
              aria-hidden="true"
              className="relative inline-flex h-6 w-6 items-center justify-center"
            >
              <span className="absolute inset-0 rounded-md border border-[color:var(--color-blueprint)]" />
              <span className="absolute inset-[5px] rotate-45 border border-[color:var(--color-blueprint)]" />
            </span>
            <span>Floorcraft</span>
          </Link>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
            Office layout &amp; seat management for hybrid teams.
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            A-101 · ISSUE 01
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mb-3">
              {col.title}
            </h3>
            <ul className="space-y-2 text-sm">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-gray-600 hover:text-[color:var(--color-blueprint-strong)] dark:text-gray-300 dark:hover:text-[color:var(--color-blueprint)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[color:var(--color-paper-line)] dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-500">
          <p className="font-mono tabular-nums">&copy; {year} Floorcraft</p>
          <p>Built for hybrid workplace teams.</p>
        </div>
      </div>
    </footer>
  )
}
