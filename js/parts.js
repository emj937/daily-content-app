// ============================================================
// Renders a single "part" into a container element. A part is
// one of three types — this is the one place that knows how to
// draw each of them, so the public page and any future surface
// stay consistent.
//   { type: "text", text }
//   { type: "checklist", items: [string, ...] }
//   { type: "dropdown", questions: [{ question, options: [string,...] }] }
// ============================================================

import { fireConfetti } from "./confetti.js";

export function renderPart(container, part, confettiColors, onResponse) {
  container.innerHTML = "";

  if (!part) return;

  if (part.type === "heading") {
    const headingEl = document.createElement("div");
    headingEl.className = "heading-text";
    headingEl.textContent = part.text || "";
    container.appendChild(headingEl);
    return;
  }

  if (part.type === "divider") {
    const dividerEl = document.createElement("div");
    dividerEl.className = "divider-line";
    container.appendChild(dividerEl);
    return;
  }

  if (part.type === "checklist") {
    const list = document.createElement("div");
    list.className = "checklist";
    const checkboxes = [];
    (part.items || []).forEach((item) => {
      const row = document.createElement("label");
      row.className = "check-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      const span = document.createElement("span");
      span.textContent = item;
      cb.addEventListener("change", () => {
        row.classList.toggle("done", cb.checked);
        if (onResponse) onResponse({ type: "checklist", item, checked: cb.checked });
        if (checkboxes.length && checkboxes.every((c) => c.checked)) {
          fireConfetti(confettiColors || ["#5b6fe0", "#8b5fd9", "#d94f95"]);
        }
      });
      checkboxes.push(cb);
      row.appendChild(cb);
      row.appendChild(span);
      list.appendChild(row);
    });
    container.appendChild(list);
    return;
  }

  if (part.type === "dropdown") {
    const list = document.createElement("div");
    list.className = "question-list";
    (part.questions || []).forEach((q) => {
      const item = document.createElement("div");
      item.className = "question-item";
      const label = document.createElement("div");
      label.className = "q-label";
      label.textContent = q.question;
      const select = document.createElement("select");
      const placeholder = document.createElement("option");
      placeholder.textContent = "Choose one";
      placeholder.value = "";
      select.appendChild(placeholder);
      (q.options || []).forEach((opt) => {
        const o = document.createElement("option");
        o.textContent = opt;
        select.appendChild(o);
      });
      select.addEventListener("change", () => {
        if (select.value && onResponse) {
          onResponse({ type: "dropdown", question: q.question, answer: select.value });
        }
      });
      item.appendChild(label);
      item.appendChild(select);
      list.appendChild(item);
    });
    container.appendChild(list);
    return;
  }

  // default: text
  const textEl = document.createElement("div");
  textEl.className = "body-text";
  textEl.textContent = part.text || "";
  container.appendChild(textEl);
}

/**
 * Builds a full card: label, accent bar/dot, the current part, and
 * (if there's more than one part) dot navigation between parts.
 * `solo` adds a class used when the card is the only thing on screen
 * (the Nighttime takeover, with no section tab bar above it).
 */
export function buildCard(label, accent, parts, { solo = false, confettiColors, onResponse } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "card" + (solo ? " solo" : "");
  wrap.style.setProperty("--accent", accent);
  wrap.style.background = `color-mix(in srgb, ${accent} 12%, var(--base))`;

  const labelEl = document.createElement("div");
  labelEl.className = "label";
  const dot = document.createElement("span");
  dot.className = "dot";
  labelEl.appendChild(dot);
  labelEl.appendChild(document.createTextNode(label));
  wrap.appendChild(labelEl);

  const content = document.createElement("div");
  content.className = "card-content";
  wrap.appendChild(content);

  if (!parts || !parts.length) {
    content.innerHTML = `<div class="body-text muted">Nothing set for today yet.</div>`;
    return wrap;
  }

  renderPart(content, parts[0], confettiColors, onResponse);

  if (parts.length > 1) {
    let current = 0;
    const dial = document.createElement("div");
    dial.className = "dial";
    parts.forEach((_, i) => {
      const tick = document.createElement("div");
      tick.className = "tick" + (i === 0 ? " active" : "");
      dial.appendChild(tick);
    });
    wrap.appendChild(dial);

    const goTo = (i) => {
      current = (i + parts.length) % parts.length;
      renderPart(content, parts[current], confettiColors, onResponse);
      [...dial.children].forEach((tick, idx) => tick.classList.toggle("active", idx === current));
    };

    const prevZone = document.createElement("div");
    prevZone.className = "nav-zone prev";
    prevZone.addEventListener("click", () => goTo(current - 1));
    wrap.appendChild(prevZone);

    const nextZone = document.createElement("div");
    nextZone.className = "nav-zone next";
    nextZone.addEventListener("click", () => goTo(current + 1));
    wrap.appendChild(nextZone);
  }

  return wrap;
}
