const scenarios = {
  rbac: {
    query: "Add role-based access control to workspace API routes",
    files: [
      ["routes/workspaces.ts", "entry", "Route boundary"], ["middleware/authorize.ts", "change", "New policy guard"],
      ["services/membership.ts", "change", "Role lookup"], ["models/role.ts", "change", "Permission matrix"],
      ["routes/projects.ts", "verify", "Inherited routes"], ["tests/workspaces.spec.ts", "verify", "Access cases"]
    ],
    nodes: [["workspaces.ts", "entry", "Workspace routes", 8, 46], ["authorize.ts", "change", "Policy guard", 37, 23], ["membership.ts", "change", "Role lookup", 37, 70], ["role.ts", "change", "Permission matrix", 65, 23], ["projects.ts", "verify", "Project routes", 65, 70], ["workspace.spec.ts", "verify", "Access tests", 88, 46]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5]],
    risk: ["Medium risk", "Authorization changes can accidentally broaden access. The plan keeps the policy at the route boundary and tests denial paths first."],
    context: ["28%", "12 files selected from 186. Nothing unrelated was loaded."],
    plan: [["Define the permission model", "Add a small, explicit role-to-action matrix. Keep the vocabulary in one place so it cannot drift across routes.", "models/role.ts"], ["Enforce at the route boundary", "Introduce a reusable authorize() guard before workspace handlers. The handler should never decide whether the caller is allowed.", "middleware/authorize.ts"], ["Use membership as the source of truth", "Resolve a caller's role through the existing membership service; do not add a parallel role lookup.", "services/membership.ts"], ["Prove allow and deny paths", "Add member, admin, and unknown-user cases for both workspace and project routes.", "tests/workspaces.spec.ts"]],
    proofs: [["Why these files?", "Every selected file is on a request path from workspace routes to role evaluation or a downstream route that inherits access."], ["What was excluded?", "Billing, notifications, and search do not consume workspace membership. They are intentionally outside the working context."], ["How will it be verified?", "8 authorization cases: 4 allowed actions, 3 denied actions, and 1 regression test for unauthenticated access."]]
  },
  audit: {
    query: "Add audit events for sensitive workspace actions",
    files: [["routes/workspaces.ts", "entry", "Action boundary"], ["services/audit.ts", "change", "New event writer"], ["events/publisher.ts", "change", "Async publish"], ["workers/audit.ts", "change", "Event consumer"], ["models/audit-event.ts", "change", "Event schema"], ["tests/audit.spec.ts", "verify", "Durability tests"]],
    nodes: [["workspaces.ts", "entry", "Workspace routes", 8, 46], ["audit.ts", "change", "Audit writer", 35, 22], ["publisher.ts", "change", "Event bus", 35, 71], ["audit.ts", "change", "Audit worker", 63, 22], ["audit-event.ts", "change", "Event schema", 63, 71], ["audit.spec.ts", "verify", "Audit tests", 88, 46]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5]], risk: ["Medium risk", "Audit writes must not make workspace actions unavailable. The critical path publishes asynchronously and records an idempotency key."], context: ["24%", "9 files selected from 186. The event worker is included; unrelated analytics is not."],
    plan: [["Name the audit contract", "Define an immutable event payload with actor, action, workspace, target, timestamp, and idempotency key.", "models/audit-event.ts"], ["Capture at action boundaries", "Emit events at the existing workspace route boundary, after authorization and before the response is returned.", "routes/workspaces.ts"], ["Make delivery asynchronous", "Use the existing publisher so audit latency cannot block a user action.", "events/publisher.ts"], ["Prove durability and duplication", "Test a successful write, publisher retry, and duplicate event handling.", "tests/audit.spec.ts"]],
    proofs: [["Why these files?", "They form the only path from a sensitive action to durable storage."], ["What was excluded?", "Read-only routes and front-end telemetry do not create audit records."], ["How will it be verified?", "6 cases cover event shape, ordering, retry, and idempotency."]]
  },
  billing: {
    query: "Move billing webhooks to the event worker",
    files: [["routes/webhooks.ts", "entry", "Webhook intake"], ["events/publisher.ts", "change", "Durable queue"], ["workers/billing.ts", "change", "New consumer"], ["services/subscription.ts", "change", "Idempotent update"], ["models/webhook.ts", "change", "Delivery state"], ["tests/billing.spec.ts", "verify", "Retry tests"]],
    nodes: [["webhooks.ts", "entry", "Webhook intake", 8, 46], ["publisher.ts", "change", "Durable queue", 35, 22], ["webhook.ts", "change", "Delivery state", 35, 71], ["billing.ts", "change", "Billing worker", 63, 22], ["subscription.ts", "change", "Subscription write", 63, 71], ["billing.spec.ts", "verify", "Worker tests", 88, 46]], edges: [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5]], risk: ["High risk", "Webhooks are retried by providers. The worker must persist delivery state before changing a subscription and tolerate duplicate events."], context: ["31%", "14 files selected from 186. Payment UI is intentionally outside the request path."],
    plan: [["Persist incoming delivery state", "Record provider event id and payload hash before publishing work. This is the idempotency anchor.", "models/webhook.ts"], ["Make intake fast", "Validate signature, persist, and enqueue. Remove subscription updates from the request handler.", "routes/webhooks.ts"], ["Move updates into the worker", "Consume the event and update subscriptions using the existing transaction boundary.", "workers/billing.ts"], ["Test retries before happy paths", "Simulate duplicate events, worker crashes, and out-of-order delivery.", "tests/billing.spec.ts"]],
    proofs: [["Why these files?", "They span the complete external webhook-to-subscription write path."], ["What was excluded?", "Invoices and checkout UI only read subscription state; they need no implementation changes."], ["How will it be verified?", "7 cases cover signature failure, duplicate delivery, crash recovery, and ordering."]]
  }
};

const el = (id) => document.getElementById(id);
const chooseScenario = (text) => text.toLowerCase().includes("audit") ? scenarios.audit : text.toLowerCase().includes("billing") || text.toLowerCase().includes("webhook") ? scenarios.billing : scenarios.rbac;
let current = scenarios.rbac;

function renderGraph(s) {
  const lines = s.edges.map(([from, to]) => { const a = s.nodes[from], b = s.nodes[to]; return `<line x1="${a[3]}%" y1="${a[4]}%" x2="${b[3]}%" y2="${b[4]}%" />`; }).join("");
  const nodes = s.nodes.map(([name, kind, label, x, y]) => `<button class="graph-node ${kind}" style="left:${x}%;top:${y}%" title="${label}"><b>${name}</b><span>${label}</span></button>`).join("");
  el("graph").innerHTML = `<svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${nodes}`;
}
function render(s) {
  current = s;
  el("issue-input").value = s.query;
  el("file-count").textContent = `${s.files.length} files`;
  el("file-list").innerHTML = s.files.map(([file, kind, detail]) => `<button class="file-row"><i class="file-dot ${kind}"></i><span><strong>${file}</strong><small>${detail}</small></span><b>›</b></button>`).join("");
  el("context-percent").textContent = s.context[0]; el("context-note").textContent = s.context[1]; el("meter-fill").style.width = s.context[0];
  renderGraph(s);
  el("risk-card").innerHTML = `<span class="risk-tag">${s.risk[0]}</span><p>${s.risk[1]}</p>`;
  el("plan-list").innerHTML = s.plan.map(([title, copy, file], i) => `<article class="plan-step"><div class="step-no">0${i + 1}</div><div><h3>${title}</h3><p>${copy}</p><code>↳ ${file}</code></div><button class="check" aria-label="Mark ${title} reviewed">✓</button></article>`).join("");
  el("proofs").innerHTML = s.proofs.map(([title, copy], i) => `<article class="proof"><span>0${i + 1}</span><h3>${title}</h3><p>${copy}</p></article>`).join("");
  document.querySelectorAll(".check").forEach(btn => btn.addEventListener("click", () => btn.classList.toggle("done")));
}
function toast(message) { const t = el("toast"); t.textContent = message; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3000); }

el("analyze-button").addEventListener("click", () => { el("analyze-button").classList.add("loading"); el("analyze-button").innerHTML = "Mapping context <span>···</span>"; setTimeout(() => { render(chooseScenario(el("issue-input").value)); el("analyze-button").classList.remove("loading"); el("analyze-button").innerHTML = "Analyze change <span>↵</span>"; toast("Change map updated from the relevant request path."); }, 550); });
document.querySelectorAll("[data-issue]").forEach(button => button.addEventListener("click", () => render(chooseScenario(button.dataset.issue))));
el("approve-button").addEventListener("click", () => { el("approve-button").innerHTML = "Plan approved <span>✓</span>"; el("approve-button").classList.add("approved"); toast("Plan approved. Ready to hand to an execution agent."); });
el("focus-button").addEventListener("click", () => { el("graph").classList.toggle("focused"); toast("Critical path highlighted."); });
render(current);
