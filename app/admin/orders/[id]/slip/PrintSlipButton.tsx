"use client";

export default function PrintSlipButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-blue btn-sm">
      Print
    </button>
  );
}
