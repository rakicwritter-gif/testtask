import { Textarea, TextInput } from '@mantine/core'
import { useState, type ChangeEvent } from 'react'
import { LOW_CONFIDENCE_THRESHOLD, type IssueCue } from '../model/validation.ts'
import { formatConfidence } from './display.ts'
import classes from './workspace.module.css'

type CorrectionFieldProps = {
  id: string
  value: string
  edited: boolean
  originalText: string
  confidence: number
  emptyText?: string
  ariaLabel?: string
  attention?: IssueCue | null
  disabled?: boolean
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
  attention,
  disabled = false,
  multiline = false,
  numeric = false,
  suffix,
  onCommit,
  onRestore,
}: CorrectionFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = draft ?? value
  const valueEmpty = shown.trim() === ''
  const showProvenance =
    edited || valueEmpty || confidence < LOW_CONFIDENCE_THRESHOLD
  const hintId = `${id}-original`
  const attentionId = attention ? `${id}-attention` : undefined
  const describedBy =
    [edited ? hintId : undefined, attentionId].filter(Boolean).join(' ') ||
    undefined

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

  return (
    <div className={edited ? classes.correctionEdited : classes.correction}>
      {multiline ? (
        <Textarea
          id={id}
          size="sm"
          autosize
          minRows={1}
          maxRows={3}
          value={shown}
          error={error}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          disabled={disabled}
          onChange={change}
          onBlur={blur}
        />
      ) : (
        <TextInput
          id={id}
          size="sm"
          value={shown}
          error={error}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-describedby={describedBy}
          disabled={disabled}
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
          {disabled ? null : (
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
          )}
          <p id={hintId} className={classes.originalHint}>
            Original: {originalText}. Confidence {formatConfidence(confidence)}.
          </p>
        </div>
      ) : showProvenance ? (
        <p
          className={classes.originalHint}
          title={`${formatConfidence(confidence)} · Original: ${originalText}`}
        >
          {formatConfidence(confidence)} · Original: {originalText}
        </p>
      ) : null}
      {!edited && valueEmpty && emptyText ? (
        <p className={classes.emptyHint}>{emptyText}</p>
      ) : null}
      {attention ? (
        <p
          id={attentionId}
          className={
            attention.severity === 'blocking'
              ? classes.blockingCue
              : classes.warningCue
          }
        >
          {attention.label}
        </p>
      ) : null}
    </div>
  )
}
