/**
 * Form field primitives.
 *
 * The point of these is that the accessibility wiring — `id`/`htmlFor`,
 * `aria-invalid`, `aria-describedby` pointing at the error — is done once
 * instead of being re-derived (and usually half-forgotten) at every call
 * site. A field with an error that no screen reader announces is a bug
 * that is invisible in review.
 */

import { useId } from 'react'

/** Renders the field-level message for a name, if any. */
function FieldError({ id, messages }) {
  if (!messages?.length) return null
  return (
    <p id={id} className="mt-1 text-sm text-red-600 dark:text-red-400">
      {messages[0]}
    </p>
  )
}

function FieldShell({ label, htmlFor, hint, error, errorId, hintId, required, children }) {
  return (
    <div>
      {label ? (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required ? (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? (
        <p id={hintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} messages={error} />
    </div>
  )
}

export function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  required = false,
  disabled = false,
  autoComplete,
  maxLength,
  inputMode,
  ...rest
}) {
  const generatedId = useId()
  const id = `field-${name || generatedId}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const hasError = Boolean(error?.length)

  return (
    <FieldShell
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      errorId={errorId}
      hintId={hintId}
      required={required}
    >
      <input
        id={id}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className={`input ${hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        {...rest}
      />
    </FieldShell>
  )
}

export function TextArea({
  label,
  name,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
  error,
  required = false,
  disabled = false,
  maxLength,
  showCount = false,
  ...rest
}) {
  const generatedId = useId()
  const id = `field-${name || generatedId}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const hasError = Boolean(error?.length)

  return (
    <FieldShell
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      errorId={errorId}
      hintId={hintId}
      required={required}
    >
      <textarea
        id={id}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className={`input resize-y ${hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        {...rest}
      />
      {showCount && maxLength ? (
        <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
          {(value ?? '').length}/{maxLength}
        </p>
      ) : null}
    </FieldShell>
  )
}

export function Select({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
  required = false,
  disabled = false,
  ...rest
}) {
  const generatedId = useId()
  const id = `field-${name || generatedId}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const hasError = Boolean(error?.length)

  return (
    <FieldShell
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      errorId={errorId}
      hintId={hintId}
      required={required}
    >
      <select
        id={id}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className={`input ${hasError ? 'border-red-500' : ''}`}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export function Checkbox({ label, name, checked, onChange, hint, disabled = false }) {
  const generatedId = useId()
  const id = `field-${name || generatedId}`

  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
      />
      <div>
        <label
          htmlFor={id}
          className="text-sm text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        {hint ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

/** A group of checkboxes for a multi-select, laid out as a wrapping row. */
export function CheckboxGroup({ label, options, value = [], onChange, error, hint }) {
  const toggle = (optionValue) => {
    const next = value.includes(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue]
    onChange(next)
  }

  return (
    <fieldset>
      {label ? (
        <legend className="label">{label}</legend>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
      {error?.length ? (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error[0]}</p>
      ) : null}
    </fieldset>
  )
}

/**
 * A range with a live label.
 *
 * Used for age and distance, where the current value is the whole point
 * and a bare slider gives no feedback.
 */
export function RangeField({
  label,
  name,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue = (v) => v,
  hint,
}) {
  const id = `field-${name}`
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="label mb-0">
          {label}
        </label>
        <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
          {formatValue(value)}
        </span>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
      />
      {hint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * A form-level error banner.
 *
 * For failures that belong to the whole submission rather than one field
 * — a rejected login, a network drop, a non-field error from the server.
 */
export function FormError({ error, className = '' }) {
  if (!error) return null
  return (
    <div
      role="alert"
      className={`alert-error ${className}`}
    >
      <p className="font-medium">{error.message}</p>
      {error.code === 'email_not_verified' ? (
        <p className="mt-1 text-red-600 dark:text-red-400">
          Check your inbox for the confirmation link.
        </p>
      ) : null}
      {error.requestId ? (
        <p className="mt-1 font-mono text-xs opacity-70">
          Reference: {error.requestId}
        </p>
      ) : null}
    </div>
  )
}

/** A success banner, for after a save. */
export function FormSuccess({ message, className = '' }) {
  if (!message) return null
  return (
    <div
      role="status"
      className={`alert-success ${className}`}
    >
      {message}
    </div>
  )
}
