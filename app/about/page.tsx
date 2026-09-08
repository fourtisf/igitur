import type { Metadata } from "next";
import { twitterCard } from "@/lib/twitter-card";

import { pageOg } from "@/lib/og-pages";

import { TelegramIcon, XIcon } from "@/components/icons";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Igitur turns a stated belief into a weighted portfolio with a written reason on every holding. What it is, and what it deliberately will not do.",
  alternates: { canonical: "/about" },
  openGraph: {
    url: "/about",
    title: `About — ${SITE.name}`,
    description: "What Igitur is, and what it deliberately will not do.",
    images: [{ url: pageOg("about"), width: 1200, height: 630 }],
  },
  twitter: twitterCard(pageOg("about")),
};

export default function AboutPage() {
  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">About</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
        A prototype, built in the open.
      </h1>
      <div className="bento rv">
        <div className="cell c3">
          <h3>What this is</h3>
          <p className="p" style={{ marginTop: 8 }}>
            Igitur turns a stated belief into a weighted portfolio with a written reason on every
            holding. It exists to close the gap between having a view about the next decade and
            being able to express that view as positions.
          </p>
          <p className="p" style={{ marginTop: 10 }}>
            It is a working prototype. The research layer is free and stays free; a token is planned
            for the parts that cost money to run, and its terms are published on the token page
            before anything is deployed.
          </p>
        </div>
        <div className="cell c3">
          <h3>What it deliberately will not do</h3>
          <p className="p" style={{ marginTop: 8 }}>
            It will not place an order, hold your money, or tell you what to buy. It will not
            produce an answer when it does not have one. It will not show a benchmark only when the
            benchmark is losing. It will not run a presale, sell a whitelist, or message you first.
          </p>
          <p className="p" style={{ marginTop: 10 }}>
            Every one of those is easy to get wrong in this category, which is why they are written
            down here.
          </p>
        </div>
        <div className="cell c6">
          <h3>Contact</h3>
          <p className="p" style={{ marginTop: 8 }}>
            Corrections to the universe, the conviction scores or the written theses are the most
            useful thing anyone can send.{" "}
            {SITE.x || SITE.telegram
              ? "Reach us on the channels below — they are the only official ones, and anything claiming to be us anywhere else is not."
              : "There is no public channel for it yet; when one opens it will be announced on this domain first, and anything claiming to be us before then is not."}
          </p>
          {SITE.x || SITE.telegram ? (
            <div className="socbig">
              {SITE.x ? (
                <a href={SITE.x} target="_blank" rel="noopener">
                  <XIcon />@{SITE.xHandle}
                </a>
              ) : null}
              {SITE.telegram ? (
                <a href={SITE.telegram} target="_blank" rel="noopener">
                  <TelegramIcon />
                  t.me/{SITE.telegramHandle}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
