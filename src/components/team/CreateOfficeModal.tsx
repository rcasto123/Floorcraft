import { useEffect, useRef, useState } from 'react'
import { Button, Modal, ModalBody, ModalFooter } from '../ui'

/**
 * Replaces the `window.prompt('Name this office:')` calls on
 * TeamHomePage. Native browser prompt dialogs:
 *   - swap Cancel / OK button order across OSes,
 *   - can't show validation,
 *   - can't be themed (visual identity breaks at the most important
 *     conversion moment for a brand-new user),
 *   - block the entire page rather than the form.
 *
 * Owns its own input + submitting state; the parent passes a
 * `defaultName`, an `onSubmit(name)` async handler, and a `submitLabel`
 * so the same modal handles both the "+ New office" flow ("Create
 * office") and the "Import CSV" flow ("Create and open import").
 */
export interface CreateOfficeModalProps {
  open: boolean
  onClose: () => void
  defaultName: string
  title: string
  description?: string
  submitLabel: string
  /** Async create handler — modal disables Submit while it resolves. */
  onSubmit: (name: string) => Promise<void>
}

export function CreateOfficeModal({
  open,
  onClose,
  defaultName,
  title,
  description,
  submitLabel,
  onSubmit,
}: CreateOfficeModalProps) {
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state every time the modal opens — a stale `name` from a
  // previous open would otherwise pre-fill the second invocation. Also
  // autofocus + select the suggested name so the user can either accept
  // the suggestion (Enter) or just start typing to replace.
  useEffect(() => {
    if (!open) return
    setName(defaultName)
    setError(null)
    setBusy(false)
    // Defer focus to the next tick so the Modal's own autofocus on the
    // panel doesn't fight with this one.
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, defaultName])

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter an office name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      // Parent owns navigation + close on success; we don't close here
      // ourselves to avoid a flicker if the parent unmounts the modal.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create office. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
      >
        <ModalBody>
          {description ? (
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{description}</p>
          ) : null}
          <label
            htmlFor="create-office-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5"
          >
            Office name
          </label>
          <input
            ref={inputRef}
            id="create-office-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            maxLength={80}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'create-office-error' : undefined}
            className="block w-full rounded border border-[color:var(--color-paper-line)] dark:border-gray-700 bg-[color:var(--color-paper-raised)] dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 focus-visible:ring-[color:var(--color-blueprint)] disabled:opacity-50"
          />
          {error ? (
            <p id="create-office-error" className="mt-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : submitLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
