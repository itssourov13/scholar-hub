"use client";

import { useState } from "react";
import type { FAQ } from "../data/types";
import styles from "./guide-detail.module.css";

interface Props {
  faqs: FAQ[];
}

export default function GuideAccordion({ faqs }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <div className={styles.accordion} role="list">
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            id={`faq-${i}`}
            className={`${styles.accordionItem} ${isOpen ? styles.accordionItemOpen : ""}`}
            role="listitem"
          >
            <button
              type="button"
              className={styles.accordionTrigger}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
              id={`faq-btn-${i}`}
              onClick={() => toggle(i)}
            >
              <span className={styles.accordionQ}>{faq.question}</span>
              <span className={styles.accordionIcon} aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-btn-${i}`}
              className={styles.accordionPanel}
              hidden={!isOpen}
            >
              <p className={styles.accordionAnswer}>{faq.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
