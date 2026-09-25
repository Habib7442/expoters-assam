"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      "expired-callback": () => void
      "error-callback": () => void
      appearance?: "always" | "execute" | "interaction-only"
      size?: "normal" | "flexible" | "compact"
    },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let scriptPromise: Promise<void> | null = null

/** Loads the Turnstile script once per page, however many widgets mount. */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Failed to load Turnstile"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export type TurnstileWidgetHandle = {
  /** Tokens are single use (spec 0006, AC-2): call after every failed submission. */
  reset: () => void
}

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void
}

/**
 * Cloudflare Turnstile bot check (spec 0006). Rendered explicitly (not via
 * the auto scanning `cf-turnstile` class) so it also works inside a dialog
 * that mounts after page load. "interaction-only" keeps it invisible for
 * most visitors; it only shows a checkbox when Cloudflare needs one.
 * Renders nothing when no site key is configured (the server then skips
 * the check and logs it, AC-4).
 */
export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { onToken },
  ref,
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current(null)
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current)
    },
  }))

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false

    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          size: "flexible",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        })
      })
      .catch(() => {
        // Script blocked or offline: the server rejects the missing token
        // with a "please try again" message, so nothing more to do here.
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
      // The parent's token must never outlive the widget that issued it:
      // a reopened dialog would otherwise resend an already used token.
      onTokenRef.current(null)
    }
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={containerRef} />
})
