"use client";

import { useEffect, useState } from "react";

/** Fire a toast from anywhere on the client. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent("premise:toast", { detail: message }));
}

export function Toast() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function show(e: Event) {
      setMsg((e as CustomEvent<string>).detail);
      setOn(true);
      clearTimeout(timer);
      timer = setTimeout(() => setOn(false), 1900);
    }
    window.addEventListener("premise:toast", show);
    return () => {
      window.removeEventListener("premise:toast", show);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={"toast" + (on ? " on" : "")} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
