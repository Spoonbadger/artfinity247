// components/CookieBanner.tsx
"use client";
import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("cookieConsent") === "accepted") return;
    setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-200 text-black p-3 text-sm shadow-md">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 flex-wrap">
        <p className="m-0">
          This site uses cookies to improve your experience. By clicking{" "}
          <strong>Accept</strong>, you consent to cookies.{" "}
          <a href="/cookie-policy" className="underline text-blue-300">
            Learn more
          </a>
          .
        </p>
        <button
          onClick={accept}
          className="bg-white text-black px-3 py-1 rounded font-semibold"
        >
          Accept
        </button>
      </div>
    </div>
  );
}