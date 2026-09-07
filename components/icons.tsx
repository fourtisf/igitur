/**
 * The two social marks, and the wordmark tile.
 *
 * These exist as components because the prototype interpolated `${X_SVG}` and
 * `${TG_SVG}` into viewToken() without ever defining them, so /token threw a
 * ReferenceError and rendered a blank page. Defining them once removes a whole
 * class of that bug.
 */

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.9 1.9h3.6l-7.9 9 9.3 12.3h-7.3l-5.7-7.5-6.5 7.5H.8l8.4-9.6L.3 1.9h7.4l5.2 6.8zm-1.3 19.2h2L7.1 3.9H5z" />
    </svg>
  );
}

export function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.1 3.5 19.6 20c-.3 1.2-1 1.5-2 .9l-5.5-4-2.7 2.6c-.3.3-.6.6-1.2.6l.4-5.6L18.8 5c.4-.4-.1-.6-.7-.2L5.5 12.7.1 11c-1.2-.4-1.2-1.2.3-1.8L21.5 1.7c1-.4 1.9.2 1.6 1.8z" />
    </svg>
  );
}

export function BrandMark() {
  return <span className="bmark" />;
}
