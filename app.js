const boardEl = document.getElementById("board");
const dialogEl = document.getElementById("card-dialog");
const formEl = document.getElementById("card-form");
const addCardBtn = document.getElementById("add-card-btn");
const loadBaselineBtn = document.getElementById("load-baseline-btn");
const stickyNoteTextEl = document.getElementById("sticky-note-text");
const STORAGE_KEY = "requirements-board-state";
const SCHEMA_VERSION = 2;
const BASELINE_VERSION = 12;

const DEFAULT_STICKY_TEXT = [
  "- przeanalizowanie procesu zwrotów w S4h na wszystkich rynkach",
  "- Ustalenie zakresu danych których musi być wypełniony dla returns w selfService (różne rynki, różne scenariusze: consigment, free of charged, stock cleaning) - czy jakieś pola mają predefiniowane wartości jak Reason ? Które pola obowiązkowe, które opcjonalne ? Uwaga: reason lista sparowana miedzy różnymi orderTypes wiec nie wszystkie mają zastawanie dla Returns",
  "- Warunki wejścia w proces co musi być sprawdzone w selfService",
  "- Ustalenie relacji zwrot -> faktur -> order w różnych scenariuszach (free of charge, stock cleaning)",
  "- Ustalenie orderType dla zwrotów dla różnych typów zamówień (zwykle, free of change, consigment) i różnych rynków (Brazylia ma swój)",
  "- Instrukcja po zatwierdzeniu czy powinna zawierać dokumenty do wydruku, jakie ? Czy różne per rynek ?",
  "- Jakie statusy może mieć zwrot ?",
  "- Różnicę w zwrocie obsługiwanym lokalnie a przez third pary ? Czy jakaś różnica przy zgłaszaniu ?",
].join("\n");

const TYPES = ["Business", "Functional", "Non-functional", "Report/Analytical", "Security"];
const SYSTEMS = ["SAP Commerce", "SAP S/4HANA", "Integration", "Migration", "Cross-system"];
const SYSTEM_PREFIX = {
  "SAP Commerce": "Hybrisreq",
  "SAP S/4HANA": "S4Hanareq",
  Integration: "Integration",
  Migration: "Migration",
  "Cross-system": "Crossreq",
};

const BASELINE_CARDS = [
  { id: "BR-01", title: "Self-Service return intake", description: "Customers initiate returns in My Account instead of phone/email forms.", subdescription: "Shift intake channel to e-commerce and reduce CS manual workload.", system: "SAP Commerce", type: "Business", phase: "I", dependencies: [] },
  { id: "BR-02", title: "Support two return scenarios", description: "Support order-linked and non-order-linked warehouse cleaning returns.", subdescription: "Both scenarios are in scope for global rollout.", system: "Cross-system", type: "Business", phase: "I", dependencies: ["BR-01"] },
  { id: "BR-03", title: "Automatic ERP registration", description: "Returns submitted in Commerce are automatically registered in S/4 via CPI.", subdescription: "No manual CS registration for standard intake.", system: "Cross-system", type: "Business", phase: "I", dependencies: ["BR-01"] },
  { id: "BR-04", title: "Customer status transparency", description: "Customers can track return history and latest status in Self-Service.", subdescription: "Include item, quantity, reason, dates and credit memo reference.", system: "SAP Commerce", type: "Business", phase: "I", dependencies: ["BR-03"] },
  {
    id: "BR-05",
    title: "Post-submission guidance",
    description: "Show next steps after submission: shipping address, cost responsibility, credit note info.",
    subdescription:
      "GAP/OP: Delivery note printing needs to be supported after submitting the request in Self-Service; " +
      "GAP/OP: Define the exact next step document/instruction (e.g., package note) and its content.",
    system: "SAP Commerce",
    type: "Business",
    phase: "I",
    dependencies: ["BR-01"],
  },
  { id: "BR-06", title: "Historical continuity", description: "Historical returns from S/4 visible in Commerce from go-live.", subdescription: "Migration/bootstrap of return history is required.", system: "Migration", type: "Business", phase: "II", dependencies: ["BR-04"] },
  { id: "BR-07", title: "Global model with local variance", description: "Global process for Americas/Asia/Europe with controlled local differences.", subdescription: "Process is standardized where legally and operationally possible.", system: "Cross-system", type: "Business", phase: "II", dependencies: ["BR-02"] },
  { id: "BR-08", title: "KPI measurability in Power BI", description: "Enable market-level and order-line-level KPI reporting.", subdescription: "Return share, cycle time, CS effort reduction, CSAT and active users growth.", system: "Cross-system", type: "Business", phase: "II", dependencies: ["BR-03"] },
  { id: "BR-09", title: "Quality complaints out of scope", description: "Quality complaints remain handled by separate process.", subdescription: "Self-Service must not misclassify complaints as standard returns.", system: "Cross-system", type: "Business", phase: "I", dependencies: [] },

  { id: "COM-F-01", title: "Create order-linked return", description: "Logged-in customer can create return from historical order lines.", subdescription: "Initiate return directly from My Account order history.", system: "SAP Commerce", type: "Functional", phase: "I", dependencies: ["BR-01"] },
  { id: "COM-F-02", title: "Select lines and quantities", description: "User can select one or multiple lines and quantities.", subdescription: "Reason is captured per return line.", system: "SAP Commerce", type: "Functional", phase: "I", dependencies: ["COM-F-01"] },
  {
    id: "COM-F-03",
    title: "Non-order-linked return form",
    description: "Dedicated entry path for warehouse cleaning returns.",
    subdescription:
      "GAP/OP: Define the scope of the returns form (fields) and required scenarios for what the return can be linked to " +
      "(order, invoice, free-of-charge order; plus stock-cleaning scenario). " +
      "GAP/OP: Define how return delivery object is handled (third party vs local warehouse) and whether it is sent to S/4 from Self-Service.",
    system: "SAP Commerce",
    type: "Functional",
    phase: "I",
    dependencies: ["BR-02"],
  },
  {
    id: "COM-F-04",
    title: "Eligibility validation in UI flow",
    description: "Validate return eligibility before submit.",
    subdescription:
      "GAP/OP: Define the complete list of conditions for whether a product can be returned (eligibility rules) " +
      "and how those conditions map to the return-reason catalog used for returns (S/4 reason codes).",
    system: "SAP Commerce",
    type: "Functional",
    phase: "I",
    dependencies: ["COM-F-02"],
  },
  { id: "COM-F-05", title: "Submit to CPI", description: "Commerce sends confirmed return payload to CPI.", subdescription: "Trigger interface with correlation identifier.", system: "SAP Commerce", type: "Functional", phase: "I", dependencies: ["BR-03"] },
  { id: "COM-F-06", title: "Return history in My Account", description: "Show return details, status and credit memo info sourced from S/4.", subdescription: "History must include existing and new returns.", system: "SAP Commerce", type: "Functional", phase: "II", dependencies: ["BR-06"] },
  { id: "COM-F-07", title: "Status synchronization display", description: "Display status updates received through CPI from S/4.", subdescription: "Customer gets near-real-time visibility.", system: "SAP Commerce", type: "Functional", phase: "II", dependencies: ["CPI-F-03"] },
  { id: "COM-F-08", title: "Termination visibility", description: "Show terminated status if return-not-received window expires.", subdescription: "Status model comes from backend rules.", system: "SAP Commerce", type: "Functional", phase: "II", dependencies: ["S4-I-03"] },

  { id: "COM-NF-01", title: "Adoption-oriented UX", description: "Return flow must be low-friction and intuitive.", subdescription: "Minimize customer effort to improve digital channel adoption.", system: "SAP Commerce", type: "Non-functional", phase: "I", dependencies: [] },
  { id: "COM-NF-02", title: "Regional configurability", description: "Support region-specific texts and instructions.", subdescription: "Allow legal/operational differences without code forks.", system: "SAP Commerce", type: "Non-functional", phase: "II", dependencies: ["BR-07"] },
  { id: "COM-NF-03", title: "User-facing error clarity", description: "Provide clear, actionable errors for validation/integration failures.", subdescription: "Errors should guide customer to resolve or contact support.", system: "SAP Commerce", type: "Non-functional", phase: "I", dependencies: [] },

  { id: "COM-S-01", title: "Authenticated access only", description: "Only logged-in users can create and view returns.", subdescription: "Anonymous access is blocked for return data.", system: "SAP Commerce", type: "Security", phase: "I", dependencies: [] },
  { id: "COM-S-02", title: "Ownership authorization", description: "Customer can only view own orders and return records.", subdescription: "Enforce strict data-access boundaries.", system: "SAP Commerce", type: "Security", phase: "I", dependencies: [] },
  { id: "COM-S-03", title: "Input hardening", description: "Sanitize and validate all return form inputs.", subdescription: "Protect against malformed and unsafe input data.", system: "SAP Commerce", type: "Security", phase: "I", dependencies: [] },

  { id: "CPI-F-01", title: "Inbound return create from Commerce", description: "CPI receives return create requests from Commerce.", subdescription: "Note: CPI scope limited to basic interface patterns; validate and map data to the S/4 return creation message model.", system: "SAP CPI", type: "Functional", phase: "I", dependencies: ["COM-F-05"] },
  {
    id: "CPI-F-02",
    title: "Map and call S/4 interface (basic scope)",
    description: "Transform payload and invoke existing S/4 return creation interface.",
    subdescription:
      "Note: CPI scope limited to basic interface patterns (create return + propagate resulting status/credit updates). " +
      "GAP/OP: Define the exact set of data fields required to create a return in S/4 and the accepted values " +
      "(e.g., return reason is a list in S/4; only a subset must be used for returns — exclude items such as POOR quality if not applicable). " +
      "GAP/OP: Define OrderType mappings (generic vs local; consignments use different OrderType).",
    system: "SAP CPI",
    type: "Functional",
    phase: "I",
    dependencies: ["CPI-F-01"],
  },
  {
    id: "CPI-F-03",
    title: "Outbound status/credit updates (basic scope)",
    description: "Propagate S/4 status and credit memo updates to Commerce.",
    subdescription:
      "Note: CPI scope limited to basic interface patterns for customer tracking (status + credit memo info).",
    system: "SAP CPI",
    type: "Functional",
    phase: "II",
    dependencies: ["S4-I-03"],
  },
  { id: "CPI-F-04", title: "Retry and error routing", description: "Provide controlled retry and failure handling for messages.", subdescription: "Note: CPI scope limited to basic interface patterns; support operations with reprocessing path.", system: "SAP CPI", type: "Functional", phase: "II", dependencies: [] },
  { id: "CPI-NF-02", title: "Idempotent integration processing", description: "Prevent duplicate return creation due to retries.", subdescription: "Note: CPI scope limited to basic interface patterns; use idempotency keys/correlation IDs.", system: "SAP CPI", type: "Non-functional", phase: "I", dependencies: ["CPI-F-01"] },
  {
    id: "CPI-S-01",
    title: "Secure technical authentication (basic scope)",
    description: "Secure service authentication between Commerce, CPI and S/4.",
    subdescription: "Note: CPI scope limited to basic interface patterns; use enterprise-approved authentication mechanism.",
    system: "SAP CPI",
    type: "Security",
    phase: "I",
    dependencies: [],
  },
  {
    id: "CPI-S-02",
    title: "Encrypted transport (basic scope)",
    description: "All data in transit must use TLS.",
    subdescription: "Note: CPI scope limited to basic interface patterns; no plaintext transport across integration hops.",
    system: "SAP CPI",
    type: "Security",
    phase: "I",
    dependencies: [],
  },

  {
    id: "CPI-NOTE-01",
    title: "CPI scope note: basic interfaces only",
    description: "CPI is limited to the minimum required integration patterns for this feature.",
    subdescription:
      "CPI basics: (1) create return request handling, (2) status/credit memo updates to Commerce, (3) idempotency & retry/error routing. " +
      "Advanced orchestration beyond these basics is out of scope for this iteration.",
    system: "SAP CPI",
    type: "Business",
    phase: "I",
    dependencies: [],
  },

  { id: "S4-I-01", title: "Accept inbound return creation", description: "S/4 accepts return requests from CPI into existing process.", subdescription: "No redesign of core returns process; integration enablement only.", system: "SAP S/4HANA", type: "Functional", phase: "I", dependencies: ["CPI-F-02"] },
  {
    id: "S4-I-02",
    title: "Support both return scenarios",
    description: "Existing process handles invoice-linked regular returns and exceptional non-order-linked cases.",
    subdescription:
      "Regular scenario should be linked to invoice. GAP/OP: Clarify whether free-of-charge returns can be linked directly to orders. " +
      "GAP/OP: Define Return OrderTypes (generic vs local) and consignment-specific OrderType differences. " +
      "GAP/OP: Define different link scenarios for objects the return is associated with (invoice as regular scenario, order for free-of-charge order if confirmed, plus stock-cleaning scenario). " +
      "GAP/OP: Confirm return delivery object semantics (third party vs local warehouse) and whether S/4 creation requires these values.",
    system: "SAP S/4HANA",
    type: "Functional",
    phase: "I",
    dependencies: ["S4-I-01"],
  },
  { id: "S4-I-03", title: "Expose status lifecycle", description: "Expose customer-trackable status progression to CPI/Commerce.", subdescription: "Status dictionary and mapping to customer-facing labels required.", system: "SAP S/4HANA", type: "Functional", phase: "II", dependencies: ["S4-I-01"] },
  { id: "S4-I-04", title: "Expose credit memo details", description: "Expose credit memo data required by customer tracking and finance visibility.", subdescription: "Data granularity for frontend to be defined.", system: "SAP S/4HANA", type: "Functional", phase: "II", dependencies: ["S4-I-01"] },
  { id: "S4-I-05", title: "Provide history dataset", description: "Provide historical returns data for initial Commerce visibility.", subdescription: "Migration/bootstrap approach to be finalized.", system: "Migration", type: "Functional", phase: "II", dependencies: ["BR-06"] },

  { id: "S4-I-NF-01", title: "Integration stability", description: "S/4 interfaces remain stable for expected return volumes.", subdescription: "Support global rollout with market peaks.", system: "SAP S/4HANA", type: "Non-functional", phase: "II", dependencies: [] },
  { id: "S4-I-S-01", title: "Auditable interface transactions", description: "Track and audit return integration events.", subdescription: "Maintain compliance-ready traceability.", system: "SAP S/4HANA", type: "Security", phase: "I", dependencies: [] },

  { id: "REP-01", title: "KPI by market", description: "Report KPIs at country/market level in Power BI.", subdescription: "Global plus regional breakdown.", system: "Cross-system", type: "Report/Analytical", phase: "II", dependencies: ["BR-08"] },
  { id: "REP-02", title: "KPI by order line", description: "Report KPIs on order-line level, not only return header.", subdescription: "Data model granularity requirement.", system: "Cross-system", type: "Report/Analytical", phase: "II", dependencies: ["BR-08"] },
  { id: "REP-03", title: "Live/regular KPI refresh", description: "Power BI KPI status must be regularly refreshed.", subdescription: "Target cadence to be agreed with analytics team.", system: "Cross-system", type: "Report/Analytical", phase: "II", dependencies: ["REP-01"] },
  { id: "REP-04", title: "Baseline vs post-go-live comparison", description: "Capture as-is baseline from manual process for KPI comparison.", subdescription: "Baseline ownership and source must be defined early.", system: "Cross-system", type: "Report/Analytical", phase: "I", dependencies: [] },
  { id: "REP-05", title: "Include KPI set", description: "Include return share, processing time, CS effort reduction, CSAT, active-user growth.", subdescription: "KPIs and formulas aligned with charter targets.", system: "Cross-system", type: "Report/Analytical", phase: "II", dependencies: ["REP-01"] },

  {
    id: "OP-DN-01",
    title: "GAP/OP: Delivery note printing in Self-Service",
    description: "Add possibility to print delivery note after submitting the return request in Self-Service.",
    subdescription:
      "Define when the document is generated and which format/fields are printed. " +
      "(Marked differences to be taken into consideration.)",
    system: "SAP Commerce",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-OT-01",
    title: "GAP/OP: Return OrderTypes (generic vs local)",
    description: "OrderTypes for returns: a generic one exists but there may be local ones.",
    subdescription: "Define the mapping between markets and Return OrderTypes.",
    system: "SAP S/4HANA",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-OT-02",
    title: "GAP/OP: Consignment returns OrderType",
    description: "If return happens for consignment, it uses a different orderType.",
    subdescription: "Define which scenario triggers the consignment-specific OrderType.",
    system: "SAP S/4HANA",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-PA-01",
    title: "GAP/OP: Eligibility conditions for product return",
    description: "List conditions determining whether a product can be returned.",
    subdescription: "Define eligibility inputs and output mapping to return reasons/codes.",
    system: "SAP Commerce",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-FM-01",
    title: "GAP/OP: Scope of the returns form",
    description: "Define the set of fields in the Self-Service returns form.",
    subdescription: "Includes order-line selection, non-order details, reasons, quantities, and required attachments/notes (if any).",
    system: "SAP Commerce",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-CP-01",
    title: "GAP/OP: S/4 payload data set + accepted values",
    description: "Define set of data sent to S/4 to create a return and accepted values.",
    subdescription:
      "Return reason is a list in S/4; only some values apply to returns. " +
      "E.g., POOR quality should not be used for returns (confirm exact allowed subset).",
    system: "SAP CPI",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-LK-01",
    title: "GAP/OP: Return-linked object scenarios",
    description: "Define scenarios for objects linked to a return.",
    subdescription:
      "Regular scenario: return linked to invoice. Open point: free-of-charge scenario may be linked directly to order. Open point: warehouse-cleaning link in S/4 remains to be defined.",
    system: "Cross-system",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-DL-01",
    title: "GAP/OP: Return delivery object semantics",
    description:
      "Return delivery object must be defined: is the return handled by a third party or not.",
    subdescription:
      "Open point: define whether SAP Commerce should send this value to S/4 (and if yes, what values/validation rules apply).",
    system: "SAP CPI",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-MKT-01",
    title: "GAP/OP: OrderTypes per market",
    description: "Define OrderTypes for returns in different markets.",
    subdescription: "Define market-specific configuration and any mandatory variants.",
    system: "SAP S/4HANA",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
  {
    id: "OP-NEXT-01",
    title: "GAP/OP: Next-step document/instructions (package note)",
    description: "Define next step after submission (e.g., package note).",
    subdescription: "Define content and availability conditions for customers.",
    system: "SAP Commerce",
    type: "Business",
    phase: "I",
    dependencies: [],
  },
];

const state = {
  cards: normalizeIdsBySystem(BASELINE_CARDS.map((card) => ({ ...card }))),
  stickyText: DEFAULT_STICKY_TEXT,
};

let editingId = null;
let dragCardId = null;

function render() {
  boardEl.innerHTML = "";
  TYPES.forEach((typeName) => {
    const col = document.createElement("section");
    col.className = "column";
    col.dataset.colType = typeName;
    const count = state.cards.filter((card) => card.type === typeName).length;
    col.innerHTML = `
      <div class="column-header">
        <strong>${typeName}</strong>
        <span class="count">${count} items</span>
      </div>
    `;
    boardEl.appendChild(col);

    SYSTEMS.forEach((systemName) => {
      const lane = document.createElement("div");
      lane.className = "lane";
      lane.innerHTML = `
        <div class="lane-header">${systemName}</div>
        <div class="lane-list" data-type="${typeName}" data-system="${systemName}"></div>
      `;
      const list = lane.querySelector(".lane-list");
      list.addEventListener("dragover", (e) => e.preventDefault());
      list.addEventListener("drop", () => onDrop(typeName, systemName));
      state.cards
        .filter((card) => card.type === typeName && card.system === systemName)
        .forEach((card) => list.appendChild(cardNode(card)));
      col.appendChild(lane);
    });
  });

  renderStickyNote();
}

function cardNode(card) {
  const el = document.createElement("article");
  el.className = `card${isGapCard(card) ? " card-gap" : ""}`;
  el.draggable = true;
  el.dataset.cardId = card.id;
  el.innerHTML = `
    <strong>${card.id}: ${card.title}</strong>
    <div>${card.description || ""}</div>
    <div class="meta">Type: ${card.type} | System: ${card.system} | Phase: ${card.phase}</div>
    <div class="chips">
      <span class="chip">${card.system}</span>
    </div>
    <details>
      <summary>Details</summary>
      <p>${card.subdescription || "-"}</p>
      <p><strong>Dependencies:</strong> ${card.dependencies.join(", ") || "-"}</p>
      <div class="card-actions">
        <button class="edit-btn" type="button">Edit</button>
        <button class="delete-btn" type="button">Delete</button>
      </div>
    </details>
  `;
  el.addEventListener("dragstart", () => {
    dragCardId = card.id;
  });
  el.querySelector(".edit-btn").addEventListener("click", () => openDialog(card.id));
  el.querySelector(".delete-btn").addEventListener("click", () => deleteCard(card.id));
  return el;
}

function isGapCard(card) {
  const content = `${card.title} ${card.description} ${card.subdescription}`.toLowerCase();
  return content.includes("gap/op") || content.includes("open point");
}

function onDrop(typeName, systemName) {
  if (!dragCardId) return;
  const card = state.cards.find((c) => c.id === dragCardId);
  if (card) {
    const oldId = card.id;
    card.type = typeName;
    card.system = systemName;
    card.phase = "I";
    const newId = nextIdForSystem(systemName);
    if (newId !== oldId) {
      card.id = newId;
      remapDependencies(oldId, newId);
    }
  }
  dragCardId = null;
  persist();
  render();
}

function openDialog(cardId = null) {
  editingId = cardId;
  const card = state.cards.find((c) => c.id === cardId);
  formEl.title.value = card?.title || "";
  formEl.description.value = card?.description || "";
  formEl.subdescription.value = card?.subdescription || "";
  formEl.systems.value = card?.system || "SAP Commerce";
  formEl.type.value = card?.type || "Business";
  formEl.phase.value = "I";
  formEl.dependencies.value = card?.dependencies?.join(", ") || "";
  document.getElementById("dialog-title").textContent = editingId ? "Edit Requirement" : "New Requirement";
  dialogEl.showModal();
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const payload = {
    title: formEl.title.value.trim(),
    description: formEl.description.value.trim(),
    subdescription: formEl.subdescription.value.trim(),
    system: formEl.systems.value,
    type: formEl.type.value,
    phase: "I",
    dependencies: splitCsv(formEl.dependencies.value),
  };

  if (editingId) {
    const idx = state.cards.findIndex((c) => c.id === editingId);
    const old = state.cards[idx];
    const updated = { ...old, ...payload };
    if (updated.system !== old.system) {
      const oldId = old.id;
      updated.id = nextIdForSystem(updated.system);
      remapDependencies(oldId, updated.id);
    }
    state.cards[idx] = updated;
  } else {
    const newId = nextIdForSystem(payload.system);
    state.cards.push({ id: newId, ...payload });
  }

  dialogEl.close();
  persist();
  render();
});

function splitCsv(value) {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function nextIdForSystem(systemName) {
  const prefix = SYSTEM_PREFIX[systemName] || "Crossreq";
  const usedNumbers = state.cards
    .filter((c) => c.system === systemName || c.id.startsWith(`${prefix}-`))
    .map((c) => {
      const match = c.id.match(/-(\d+)$/);
      return match ? Number.parseInt(match[1], 10) : 0;
    });
  const next = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;
  return `${prefix}-${next}`;
}

function remapDependencies(oldId, newId) {
  state.cards.forEach((card) => {
    card.dependencies = card.dependencies.map((dep) => (dep === oldId ? newId : dep));
  });
}

function normalizeIdsBySystem(cards) {
  // IDs must be compact and consistent after removals.
  // Approach:
  //  1) Assign provisional IDs, remap dependencies, then filter out removed + security cards.
  //  2) Re-assign final compact IDs and remap dependencies again.

  const removedIds = new Set([
    "Integration-8",
    "Crossreq-1",
    "Crossreq-11",
    "S4Hanareq-5",
    "Hybrisreq-6",
  ]);

  const mapLegacySystem = (sys) => (sys === "SAP CPI" ? "Integration" : sys);

  // Pass 1: provisional IDs + dependency remap based on original card IDs
  const idMap1 = new Map(); // originalId -> provisionalId
  const counters1 = {};
  const pass1 = cards.map((card) => {
    const mappedSystem = mapLegacySystem(card.system);
    const system = SYSTEMS.includes(mappedSystem) ? mappedSystem : "Cross-system";
    const prefix = SYSTEM_PREFIX[system];
    counters1[prefix] = (counters1[prefix] || 0) + 1;
    const provisionalId = `${prefix}-${counters1[prefix]}`;
    idMap1.set(card.id, provisionalId);
    return { ...card, system, id: provisionalId, phase: "I" };
  });

  pass1.forEach((card) => {
    card.dependencies = (card.dependencies || []).map((depOld) => idMap1.get(depOld) || depOld);
  });

  // Filter out security and requested removals
  const pass1Filtered = pass1.filter((card) => card.type !== "Security" && !removedIds.has(card.id));
  const pass1IdsSet = new Set(pass1Filtered.map((c) => c.id));
  pass1Filtered.forEach((card) => {
    card.dependencies = (card.dependencies || []).filter((depId) => pass1IdsSet.has(depId));
  });

  // Pass 2: compact final IDs
  const idMap2 = new Map(); // provisionalId -> finalId
  const counters2 = {};
  const pass2 = pass1Filtered.map((card) => {
    const prefix = SYSTEM_PREFIX[card.system];
    counters2[prefix] = (counters2[prefix] || 0) + 1;
    const finalId = `${prefix}-${counters2[prefix]}`;
    idMap2.set(card.id, finalId);
    return { ...card, id: finalId, phase: "I" };
  });

  const finalIdsSet = new Set(pass2.map((c) => c.id));
  pass2.forEach((card) => {
    card.dependencies = (card.dependencies || [])
      .map((depOldProvisional) => idMap2.get(depOldProvisional) || depOldProvisional)
      .filter((depId) => finalIdsSet.has(depId));
  });

  return pass2;
}

function deleteCard(cardId) {
  const confirmed = window.confirm(`Delete ${cardId}?`);
  if (!confirmed) return;
  state.cards = state.cards.filter((card) => card.id !== cardId);
  state.cards.forEach((card) => {
    card.dependencies = card.dependencies.filter((dep) => dep !== cardId);
  });
  persist();
  render();
}

addCardBtn.addEventListener("click", () => openDialog());
loadBaselineBtn.addEventListener("click", () => {
  const confirmed = window.confirm("Replace current board with the full returns baseline requirements?");
  if (!confirmed) return;
  state.cards = normalizeIdsBySystem(BASELINE_CARDS.map((card) => ({ ...card })));
  state.stickyText = DEFAULT_STICKY_TEXT;
  persist();
  render();
});

function renderStickyNote() {
  if (!stickyNoteTextEl) return;
  stickyNoteTextEl.value = state.stickyText || "";
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      baselineVersion: BASELINE_VERSION,
      cards: state.cards,
      stickyText: state.stickyText,
    })
  );
}

function restore() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    // Backward compatibility: older saves stored cards directly without schemaVersion.
    const savedVersion = parsed.schemaVersion || 1;
    const stickyText = typeof parsed.stickyText === "string" ? parsed.stickyText : "";
    const cards = parsed.cards || [];
    if (savedVersion < SCHEMA_VERSION) {
      // Upgrade path: reload latest baseline so new systems/ID patterns are guaranteed.
      state.cards = normalizeIdsBySystem(BASELINE_CARDS.map((card) => ({ ...card })));
      state.stickyText = DEFAULT_STICKY_TEXT;
      persist();
      return;
    }
    const savedBaselineVersion = parsed.baselineVersion || 1;
    if (savedBaselineVersion !== BASELINE_VERSION) {
      state.cards = normalizeIdsBySystem(BASELINE_CARDS.map((card) => ({ ...card })));
      state.stickyText = DEFAULT_STICKY_TEXT;
      persist();
      return;
    }
    state.cards = normalizeIdsBySystem(cards.map((card) => ({
      ...card,
      type: TYPES.includes(card.type) ? card.type : "Business",
      system: card.system || card.systems?.[0] || "Cross-system",
      dependencies: Array.isArray(card.dependencies) ? card.dependencies : [],
    })));
    state.stickyText = stickyText || DEFAULT_STICKY_TEXT;
  } catch {
    // Ignore malformed local storage data.
  }
}

restore();
state.cards = normalizeIdsBySystem(state.cards);
persist();
render();

let stickyTimer = null;
if (stickyNoteTextEl) {
  stickyNoteTextEl.addEventListener("input", () => {
    state.stickyText = stickyNoteTextEl.value;
    clearTimeout(stickyTimer);
    stickyTimer = setTimeout(() => persist(), 200);
  });
}
