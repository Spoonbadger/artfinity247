"use client";

/** Reloads the page the visitor was trying to open (the worker serves /offline in its place). */
export default function RetryButton() {
  return (
    <button type="button" onClick={() => window.location.reload()} className="btn btn-blue">
      Try again
    </button>
  );
}
