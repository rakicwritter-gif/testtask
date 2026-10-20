import { Textarea, TextInput } from '@mantine/core'
import { useState, type ChangeEvent } from 'react'
import classes from './workspace.module.css'

type CorrectionFieldProps = {
  id: string
  value: string
  edited: boolean
  originalText: string
  confidence: number
  emptyText?: string
  ariaLabel?: string
  multiline?: boolean
  numeric?: boolean
  suffix?: string
  onCommit: (raw: string) => string | null
  onRestore: () => void
}

export function CorrectionField({
  id,
  value,
  edited,
  originalText,
  confidence,
  emptyText,
  ariaLabel,
  multiline = false,
  numeric = false,
  suffix,
  onCommit,
  onRestore,
}: CorrectionFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = draft ?? value
  const hintId = `${id}-original`

  function change(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setDraft(event.currentTarget.value)
    setError(null)
  }

  function blur() {
    if (draft === null) return
    const message = onCommit(draft)
    if (message) {
      setError(message)
      return
    }
    setDraft(null)
    setError(null)
  }

  const describedBy = edited ? hintId : undefined

  return (
    <div className={classes.correction}>
      {multiline ? (
        <Textarea
          id={id}
          size="xs"
          autosize
          minRows={1}
          maxRows={3}
          value={shown}
          error={error}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          onChange={change}
          onBlur={blur}
        />
      ) : (
        <TextInput
          id={id}
          size="xs"
          value={shown}
          error={error}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          inputMode={numeric ? 'decimal' : 'text'}
          classNames={numeric ? { input: classes.numericInput } : undefined}
          rightSection={suffix}
          rightSectionWidth={suffix ? 28 : undefined}
          onChange={change}
          onBlur={blur}
        />
      )}
      {edited ? (
        <div className={classes.editedRow}>
          <span className={classes.editedMark}>Edited</span>
          <button
            type="button"
            className={classes.restoreButton}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setDraft(null)
              setError(null)
              onRestore()
            }}
          >
            Restore original
          </button>
          <p id={hintId} className={classes.originalHint}>
            Original: {originalText}. Confidence {confidence}.
          </p>
        </div>
      ) : null}
      {!edited && shown.trim() === '' && emptyText ? (
        <p className={classes.emptyHint}>{emptyText}</p>
      ) : null}
    </div>
  )
}
