/**
 * The message composer.
 *
 * Three things worth knowing about this component:
 *
 * * **Typing throttle.** A `typing` frame per keystroke would flood the
 *   socket. This sends `is_typing: true` at most once every
 *   `TYPING_THROTTLE_MS`, and always sends `false` after a pause —
 *   otherwise the other side's indicator sticks on until its TTL expires.
 * * **Enter sends, Shift+Enter breaks.** Standard for chat, and the
 *   placeholder says so, because guessing wrong is annoying in both
 *   directions.
 * * **Images go over HTTP.** The consumer refuses them explicitly; the
 *   multipart parser and Pillow validators only exist on the HTTP side.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { Spinner } from '../ui/Spinner'
import { MAX_CHAT_IMAGE_MB, MAX_MESSAGE_LENGTH } from '../../utils/constants'

/** How often a `typing: true` frame may be sent while the user types. */
const TYPING_THROTTLE_MS = 3000

export function Composer({ onSend, onSendImage, onTyping, disabled = false }) {
  const [body, setBody] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)

  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const lastTypingSent = useRef(0)
  const stopTypingTimer = useRef(null)

  // A pending "stopped typing" timer must not outlive the component, or
  // it fires a frame for a conversation that is no longer open.
  useEffect(() => {
    return () => {
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    }
  }, [])

  const signalTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSent.current > TYPING_THROTTLE_MS) {
      lastTypingSent.current = now
      onTyping?.(true)
    }

    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    stopTypingTimer.current = setTimeout(() => {
      lastTypingSent.current = 0
      onTyping?.(false)
    }, TYPING_THROTTLE_MS)
  }, [onTyping])

  const submit = () => {
    const text = body.trim()
    if (!text || disabled) return

    onSend(text)
    setBody('')
    // Sending implies you have stopped typing.
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current)
    lastTypingSent.current = 0
    onTyping?.(false)
    textareaRef.current?.focus()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const onFileChange = async (event) => {
    const file = event.target.files?.[0]
    // Reset immediately so picking the same file twice still fires change.
    event.target.value = ''
    if (!file) return

    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Only image files can be sent.')
      return
    }
    if (file.size > MAX_CHAT_IMAGE_MB * 1024 * 1024) {
      setError(`Images must be under ${MAX_CHAT_IMAGE_MB} MB.`)
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    try {
      await onSendImage(file, setUploadProgress)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - body.length

  return (
    <div className="border-t border-sand-200 bg-white p-3 dark:border-sand-800 dark:bg-slate-900">
      {error ? (
        <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {isUploading ? (
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Spinner className="[&>svg]:h-4 [&>svg]:w-4" label="Uploading image" />
          <span>Uploading… {uploadProgress}%</span>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="sr-only"
          aria-label="Attach an image"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          aria-label="Attach an image"
          title={`Attach an image (max ${MAX_CHAT_IMAGE_MB} MB)`}
          className="btn-ghost shrink-0 p-2.5"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 15-4.6-4.6a2 2 0 0 0-2.8 0L4 20M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
            />
            <circle cx="9" cy="9.5" r="1.5" />
          </svg>
        </button>

        <label htmlFor="composer-input" className="sr-only">
          Write a message
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          value={body}
          onChange={(event) => {
            setBody(event.target.value)
            signalTyping()
          }}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled}
          placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
          className="input max-h-40 min-h-[2.75rem] flex-1 resize-none py-3"
        />

        <button
          type="button"
          onClick={submit}
          disabled={disabled || !body.trim()}
          className="btn-primary shrink-0 px-4 py-2.5"
        >
          Send
        </button>
      </div>

      {remaining < 200 ? (
        <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
          {remaining} characters left
        </p>
      ) : null}
    </div>
  )
}
