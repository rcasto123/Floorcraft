import { Link } from 'react-router-dom'
import { Check, ChevronRight, Circle } from 'lucide-react'

/**
 * Onboarding checklist surfaced on the team home dashboard for
 * fresh teams. Distinct from the EmptyTeamState card (which only
 * appears when a team has zero offices) — this checklist shows
 * progressively after the user creates their first office, walking
 * them through the rest of the setup until the team's "lit up":
 *
 *   1. Created your team   — always ✓ (they're on the dashboard)
 *   2. Create your first office
 *   3. Add some employees
 *   4. Invite a teammate
 *
 * Hides itself entirely once all four steps are done — checking a
 * dashboard that's already humming with activity shouldn't be
 * decorated with a "you've done all the things!" trophy ribbon.
 *
 * Steps are derived from data the parent already has (office count,
 * employee count, member count), so this is a pure presentational
 * component with no data fetching of its own.
 */

interface ChecklistStep {
  done: boolean
  label: string
  hint: string
  cta?: { label: string; to?: string; onClick?: () => void }
}

export function OnboardingChecklist({
  hasOffice,
  hasEmployees,
  hasTeammates,
  canCreateOffices,
  onCreateOffice,
  teamSlug,
}: {
  hasOffice: boolean
  hasEmployees: boolean
  hasTeammates: boolean
  canCreateOffices: boolean
  /** Caller wires this to its own create-office flow (which knows
   *  the next default name + handles navigation). */
  onCreateOffice: () => void
  teamSlug: string
}) {
  const steps: ChecklistStep[] = [
    {
      done: true,
      label: 'Create your team',
      hint: "You're here. Welcome.",
    },
    {
      done: hasOffice,
      label: 'Create your first office',
      hint: 'Add walls, desks, conference rooms — start with a blank canvas or a sample layout.',
      cta: canCreateOffices ? { label: 'Create office', onClick: onCreateOffice } : undefined,
    },
    {
      done: hasEmployees,
      label: 'Add some employees',
      hint: 'Drop people onto desks. Roster from CSV or add them one at a time.',
      cta: hasOffice ? undefined : undefined,
    },
    {
      done: hasTeammates,
      label: 'Invite a teammate',
      hint: 'Floorcraft is more useful with a few collaborators on each office.',
      cta: { label: 'Open members', to: `/t/${teamSlug}/settings/members` },
    },
  ]

  const allDone = steps.every((s) => s.done)
  if (allDone) return null

  const completedCount = steps.filter((s) => s.done).length

  return (
    <section
      className="mt-6 mb-2 rounded-lg border border-[color:var(--color-paper-line)] dark:border-gray-800 bg-[color:var(--color-paper-raised)] dark:bg-gray-900 p-4"
      aria-label="Setup checklist"
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Get started
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 tabular-nums">
          {completedCount} of {steps.length}
        </span>
      </header>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-md p-2 -mx-2 transition-colors ${
              step.done
                ? 'opacity-60'
                : 'hover:bg-[color:var(--color-paper-sunken)]/60 dark:hover:bg-gray-800/30'
            }`}
          >
            {step.done ? (
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0"
              >
                <Check size={11} />
              </span>
            ) : (
              <Circle
                size={20}
                aria-hidden="true"
                className="mt-0.5 text-gray-300 dark:text-gray-600 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.done
                    ? 'text-gray-500 dark:text-gray-400 line-through decoration-gray-400/50'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {step.label}
              </p>
              {!step.done && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {step.hint}
                </p>
              )}
            </div>
            {!step.done && step.cta && (
              step.cta.to ? (
                <Link
                  to={step.cta.to}
                  className="inline-flex items-center gap-1 self-center px-2.5 py-1 text-xs font-medium rounded border border-[color:var(--color-paper-line)] dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-[color:var(--color-paper-sunken)] dark:hover:bg-gray-800 shrink-0"
                >
                  {step.cta.label}
                  <ChevronRight size={11} aria-hidden="true" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={step.cta.onClick}
                  className="inline-flex items-center gap-1 self-center px-2.5 py-1 text-xs font-medium rounded border border-[color:var(--color-paper-line)] dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-[color:var(--color-paper-sunken)] dark:hover:bg-gray-800 shrink-0"
                >
                  {step.cta.label}
                  <ChevronRight size={11} aria-hidden="true" />
                </button>
              )
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
