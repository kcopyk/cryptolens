"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}

/** Fade-up on scroll via IntersectionObserver — never a scroll listener. */
export default function RevealSection({ children, className = "", as: Tag = "div" }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = Tag === "section" ? sectionRef.current : divRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in");
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in");
          obs.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -4% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [Tag]);

  if (Tag === "section") {
    return (
      <section ref={sectionRef} className={`reveal ${className}`}>
        {children}
      </section>
    );
  }

  return (
    <div ref={divRef} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
