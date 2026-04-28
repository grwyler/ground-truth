const state = {
  activeView: "dashboard",
  selectedApproval: "REQ-114",
  selectedDiff: "requirement",
  blockers: 3,
  score: 82,
  milestoneIndex: 2,
  overrideSubmitted: false,
  approvals: [
    {
      id: "REQ-114",
      type: "Requirement approval",
      title: "REQ-114 - Degraded network operations",
      owner: "Maya Chen",
      version: "v3.1",
      trace: "Workflow linked, test missing",
      body:
        "The platform must preserve operator task state when connectivity drops and restore the last confirmed step after reconnect. Current draft needs a measurable timeout threshold before the requirement can satisfy readiness.",
      status: "Customer review",
    },
    {
      id: "CONOPS-08",
      type: "Workflow approval",
      title: "CONOPS-08 - Degraded connectivity workflow",
      owner: "Rafael Ortiz",
      version: "v3.1",
      trace: "4 linked requirements",
      body:
        "Operator workflow includes nominal path, degraded path, and escalation branch. The v3.1 update splits manual confirmation from automated retry behavior.",
      status: "Operator review",
    },
    {
      id: "INT-07",
      type: "Interface approval",
      title: "INT-07 - Customer identity provider dependency",
      owner: "Ellen Park",
      version: "v2.4",
      trace: "2 linked requirements",
      body:
        "Customer signoff is required for identity provider claims, token lifetime, and fallback operator access during external outage windows.",
      status: "Customer review",
    },
    {
      id: "REQ-131",
      type: "Requirement approval",
      title: "REQ-131 - Audit event retention",
      owner: "Priya Shah",
      version: "v1.7",
      trace: "Complete",
      body:
        "All override decisions, approval invalidations, and export attempts must be retained in the project audit stream with named actor and timestamp.",
      status: "Engineering review",
    },
    {
      id: "CONOPS-12",
      type: "Workflow approval",
      title: "CONOPS-12 - Manual fallback handoff",
      owner: "Jon Bell",
      version: "v1.9",
      trace: "3 linked requirements",
      body:
        "The workflow defines how operators move from automated processing to manual handoff when a downstream dependency is unavailable.",
      status: "Operator review",
    },
    {
      id: "REQ-140",
      type: "Requirement approval",
      title: "REQ-140 - Export package provenance",
      owner: "Nadia Flores",
      version: "v2.0",
      trace: "Complete",
      body:
        "The certification package must include source document provenance for each exported Jira epic and story.",
      status: "Customer review",
    },
  ],
};

const readinessRows = [
  ["Source documents", 100, "SOW, proposal, and operator notes parsed"],
  ["Operator workflows", 88, "1 workflow awaiting approval"],
  ["Requirements", 79, "5 items need final stakeholder decision"],
  ["Acceptance criteria", 73, "3 requirements missing test language"],
  ["Traceability", 91, "2 conditional links still prompted"],
];

const diffData = {
  requirement: {
    title: "Requirement Diff",
    summary: ["Meaningful change detected", "Approval invalidated", "Acceptance criteria still incomplete"],
    previous:
      "The system shall restore operator task state after a network interruption and continue processing when the connection returns.",
    current:
      "The system shall restore operator task state after a network interruption, <mark class='added'>preserve the last confirmed step locally</mark>, and continue processing when the connection returns <mark class='added'>within an approved recovery threshold</mark>.",
    removed:
      "The system shall restore operator task state after a network interruption and continue processing when the connection returns.",
  },
  workflow: {
    title: "Workflow Diff",
    summary: ["Branch split into two operator decisions", "Edge case added", "Operator approval required"],
    previous:
      "Step 4: Operator retries submission after reconnect. Step 5: Supervisor reviews failure if retry is unsuccessful.",
    current:
      "Step 4A: Operator confirms the last saved step. <mark class='added'>Step 4B: System attempts automated retry only after operator confirmation.</mark> Step 5: Supervisor reviews failure if retry is unsuccessful.",
    removed:
      "Step 4: Operator retries submission after reconnect. Step 5: Supervisor reviews failure if retry is unsuccessful.",
  },
  interface: {
    title: "Interface Diff",
    summary: ["Customer dependency changed", "Claims mapping clarified", "Signoff blocker remains"],
    previous:
      "Identity provider must supply operator role and organization attributes for access decisions.",
    current:
      "Identity provider must supply operator role, organization, <mark class='added'>mission assignment</mark>, and <mark class='added'>temporary access reason</mark> attributes for access decisions.",
    removed:
      "Identity provider must supply operator role and organization attributes for access decisions.",
  },
};

const milestones = [
  ["Intake", "Source package received", "complete"],
  ["AI Draft", "Workflows and requirements generated", "complete"],
  ["Validation", "Stakeholder decisions in progress", "current"],
  ["Certification", "Ready-to-Build package locked", "next"],
  ["Jira Export", "Execution handoff opened", "next"],
];

const viewTitles = {
  dashboard: "Document Readiness Dashboard",
  approvals: "Requirement Approval Workflow",
  diff: "Version Diff Viewer",
  milestones: "Milestone Tracker",
  gate: "Project Readiness Gate",
};

function renderReadiness() {
  const list = document.querySelector("#readinessList");
  list.innerHTML = readinessRows
    .map(
      ([label, percent, note]) => `
        <div class="readiness-row">
          <div>
            <strong>${label}</strong>
            <div>${note}</div>
          </div>
          <strong>${percent}%</strong>
          <div class="progress-line"><span style="width: ${percent}%"></span></div>
        </div>
      `,
    )
    .join("");
}

function renderApprovals() {
  const queue = document.querySelector("#approvalQueue");
  queue.innerHTML = state.approvals
    .map(
      (item) => `
        <button class="approval-item ${item.id === state.selectedApproval ? "active" : ""}" data-approval-id="${item.id}">
          <strong>${item.title}</strong>
          <span>${item.status} - ${item.owner} - ${item.version}</span>
        </button>
      `,
    )
    .join("");

  const selected = state.approvals.find((item) => item.id === state.selectedApproval) || state.approvals[0];
  document.querySelector("#approvalKicker").textContent = selected.type;
  document.querySelector("#approvalTitle").textContent = selected.title;
  document.querySelector("#approvalBody").textContent = selected.body;
  document.querySelector("#approvalOwner").textContent = selected.owner;
  document.querySelector("#approvalVersion").textContent = selected.version;
  document.querySelector("#approvalTrace").textContent = selected.trace;
  document.querySelector("#queueCount").textContent = `${state.approvals.length} pending`;
  document.querySelector("#pendingCount").textContent = state.approvals.length;
}

function renderDiff() {
  const data = diffData[state.selectedDiff];
  document.querySelector("#diffTitle").textContent = data.title;
  document.querySelector("#diffPrevious").innerHTML = `<p><mark class="removed">${data.removed}</mark></p>`;
  document.querySelector("#diffCurrent").innerHTML = `<p>${data.current}</p>`;
  document.querySelector("#diffSummary").innerHTML = data.summary
    .map((item) => `<div>${item}</div>`)
    .join("");

  document.querySelectorAll("[data-diff-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.diffTab === state.selectedDiff);
  });
}

function renderMilestones() {
  const track = document.querySelector("#milestoneTrack");
  track.innerHTML = milestones
    .map((milestone, index) => {
      const status = index < state.milestoneIndex ? "complete" : index === state.milestoneIndex ? "current" : "next";
      return `
        <article class="milestone ${status}">
          <strong>${milestone[0]}</strong>
          <small>${milestone[1]}</small>
          <span class="status-pill ${status === "complete" ? "ready" : status === "current" ? "review" : ""}">
            ${status === "complete" ? "Complete" : status === "current" ? "Current" : "Next"}
          </span>
        </article>
      `;
    })
    .join("");
}

function renderGate() {
  const checks = [
    ["Workflow approvals", state.blockers < 3 ? "Passed" : "Blocked", "CONOPS-08 needs operator decision"],
    ["Requirement baseline", state.blockers < 2 ? "Passed" : "Blocked", "REQ-114 needs acceptance criteria"],
    ["Customer dependencies", state.blockers === 0 || state.overrideSubmitted ? "Accepted" : "Blocked", "INT-07 needs customer signoff"],
    ["Traceability matrix", "Passed", "Required links are complete enough for export"],
  ];

  document.querySelector("#gateChecks").innerHTML = checks
    .map((check) => {
      const passed = check[1] === "Passed" || check[1] === "Accepted";
      return `
        <div class="gate-check">
          <strong>${check[0]} <span>${check[1]}</span></strong>
          <span>${check[2]}</span>
        </div>
      `;
    })
    .join("");

  const open = state.blockers === 0 || state.overrideSubmitted;
  document.querySelector("#gateStatus").textContent = open ? "Gate Open" : "Gate Closed";
  document.querySelector("#gateStatus").className = `status-pill ${open ? "ready" : "blocked"}`;
  document.querySelector("#readinessState").textContent = open ? "Ready" : "Not Ready";
  document.querySelector("#readinessState").className = `status-pill ${open ? "ready" : "blocked"}`;
  document.querySelector("#gateCount").textContent = open ? "0 active blockers" : `${state.blockers} blockers`;
  document.querySelector("#exportBadge").textContent = open ? "Export open" : "Export blocked";
  document.querySelector("#exportBadge").className = `status-pill ${open ? "ready" : "blocked"}`;
  document.querySelector("#sidebarExportState").textContent = open ? "Open" : "Blocked";
  document.querySelector("#overrideState").textContent = state.overrideSubmitted ? "Accepted" : "None";
  document.querySelector("#jiraExport").classList.toggle("disabled", !open);
  document.querySelector("#scoreValue").textContent = state.score;
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === view);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelector("#pageTitle").textContent = viewTitles[view];
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-view]");
    if (nav) {
      setView(nav.dataset.view);
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      const actions = {
        "open-diff": "diff",
        "open-gate": "gate",
        "open-approvals": "approvals",
        "open-milestones": "milestones",
      };
      setView(actions[action.dataset.action]);
      return;
    }

    const approval = event.target.closest("[data-approval-id]");
    if (approval) {
      state.selectedApproval = approval.dataset.approvalId;
      renderApprovals();
      return;
    }

    const diffTab = event.target.closest("[data-diff-tab]");
    if (diffTab) {
      state.selectedDiff = diffTab.dataset.diffTab;
      renderDiff();
      return;
    }

    if (event.target.closest("[data-approval-action='approve']")) {
      const selected = state.selectedApproval;
      state.approvals = state.approvals.filter((item) => item.id !== selected);
      state.selectedApproval = state.approvals[0]?.id || "";
      state.score = Math.min(96, state.score + 3);
      renderApprovals();
      renderGate();
      showToast(`${selected} approved for this version.`);
      return;
    }

    if (event.target.closest("[data-approval-action='changes']")) {
      showToast("Change request captured and approval remains pending.");
      return;
    }

    if (event.target.closest("#advanceMilestone")) {
      state.milestoneIndex = Math.min(milestones.length - 1, state.milestoneIndex + 1);
      renderMilestones();
      showToast("Milestone advanced.");
      return;
    }

    if (event.target.closest("#resolveBlocker")) {
      state.blockers = Math.max(0, state.blockers - 1);
      state.score = Math.min(100, state.score + 6);
      renderGate();
      showToast("One hard blocker marked resolved.");
      return;
    }

    if (event.target.closest("#submitOverride")) {
      state.overrideSubmitted = true;
      renderGate();
      showToast("Risk override submitted and shown in the gate record.");
      return;
    }

    if (event.target.closest("#jiraExport")) {
      if (state.blockers > 0 && !state.overrideSubmitted) {
        showToast("Jira export is blocked by readiness gate checks.");
      } else {
        showToast("Jira export preview opened for 47 approved requirements.");
      }
    }

    const blocker = event.target.closest("[data-blocker]");
    if (blocker) {
      state.selectedApproval = blocker.dataset.blocker;
      setView("approvals");
      renderApprovals();
    }
  });
}

renderReadiness();
renderApprovals();
renderDiff();
renderMilestones();
renderGate();
bindEvents();
