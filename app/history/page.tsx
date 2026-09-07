import type { Metadata } from "next";

import { HistoryList } from "./HistoryList";

export const metadata: Metadata = {
  title: "Session history",
  description:
    "Every book you built this session, held in memory and never sent anywhere. It disappears on refresh — which is why every book carries its own address.",
  alternates: { canonical: "/history" },
  // Nothing here is the same for two readers, so there is nothing to index.
  robots: { index: false, follow: true },
};

export default function HistoryPage() {
  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">History</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "18ch" }}>
        Everything you built this session.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        Held in memory only, never sent anywhere. Refresh the page and it is gone — which is also
        why every book carries its own address.
      </p>
      <HistoryList />
    </section>
  );
}
