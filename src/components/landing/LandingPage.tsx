import { Link } from 'react-router-dom'
import { useSession } from '../../lib/auth/session'
import { useMyTeams } from '../../lib/teams/useMyTeams'
import { FloorPlanHero } from './FloorPlanHero'
import { BrowserFrame } from './BrowserFrame'

/**
 * Public landing page at `/`.
 *
 * Auth-gated CTA logic (preserved from earlier phases):
 *   - Signed out → Sign up / Log in.
 *   - Signed in, has teams → jump straight to the first team home.
 *   - Signed in, no teams yet → /dashboard, which itself redirects to
 *     /onboarding/team (via `DashboardRedirect` + `RequireTeam`).
 *
 * Visual direction: Linear-adjacent, light-theme-only, indigo accent,
 * no stock photography — the product's own stylized floor plan is the
 * hero illustration.
 */
export function LandingPage() {
  const session = useSession()
  const teams = useMyTeams()

  // The CTA row stacks on mobile so each button lands above the fold
  // on 375px viewports. Authenticated users see a single "Open
  // dashboard" pill instead of the sign-up split.
  const primaryCta =
    session.status === 'authenticated' ? (
      <div className="flex justify-center">
        <Link
          to={teams && teams.length > 0 ? `/t/${teams[0].slug}` : '/dashboard'}
          className="px-8 py-3 bg-blue-600 text-white text-lg font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all inline-block"
        >
          Open dashboard
        </Link>
      </div>
    ) : (
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/signup"
          className="px-6 py-3 bg-blue-600 text-white text-lg font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all text-center"
        >
          Start free
        </Link>
        <Link
          to="/help"
          className="px-6 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 text-lg text-center"
        >
          See a demo
        </Link>
      </div>
    )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500 mb-5">
          Workplace planning, reimagined
        </p>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-4">
          Plan your office.
          <br />
          <span className="text-gray-500">Seat your team.</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          The floor-plan editor built for hybrid workplace teams.
        </p>
        {primaryCta}

        {/* Enlarged hero illustration inside a simulated browser
            chrome. The indigo glow sits behind the frame to lift it
            off the gradient background. */}
        <div className="relative mt-16 sm:mt-20 max-w-4xl mx-auto">
          <div
            aria-hidden="true"
            className="absolute inset-x-8 top-10 bottom-0 rounded-3xl bg-blue-400/20 blur-3xl"
          />
          <div className="relative">
            <BrowserFrame>
              <FloorPlanHero />
            </BrowserFrame>
          </div>
        </div>
      </section>

      {/* Social-proof row */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <p className="text-center text-xs uppercase tracking-wider text-gray-400 mb-4">
          Trusted by teams at
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {['Acme', 'Nimbus', 'Orbit', 'Lattice', 'Fielder'].map((name) => (
            <div
              key={name}
              className="grayscale h-10 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-500 font-semibold text-sm tracking-wider transition-colors"
            >
              {name}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        Floorcraft — Office layout &amp; seat management
        <span className="mx-2">·</span>
        <Link to="/help" className="hover:text-blue-600">
          User guide &amp; FAQ
        </Link>
      </footer>
    </div>
  )
}
