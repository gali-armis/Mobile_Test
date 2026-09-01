const PASSCODE = "Aa12345!";
const GATE_KEY = "armis-proto-unlocked";

let alerts = [];

const INCOMING_ALERTS = [
  {
    id: "sim-1",
    severity: "Critical",
    title: "New device enrolled outside business hours",
    classification: "Security - Risk",
    type: "Unauthorized Access",
    policyLabels: ["general"],
  },
  {
    id: "sim-2",
    severity: "High",
    title: "Device sending data to a newly-seen destination",
    classification: "Security - Other",
    type: "Suspicious Activity",
    policyLabels: ["Threat"],
  },
];
let simIndex = 0;

async function loadData() {
  const res = await fetch("mockdata.json", { cache: "no-store" });
  const data = await res.json();
  alerts = data.alerts;
  render();
}

function render() {
  const route = location.hash.slice(2); // strip "#/"
  const [view, id] = route.split("/");

  if (view === "item" && id) {
    renderDetail(id);
  } else {
    renderList();
  }
}

function severityBadge(severity) {
  return `<span class="badge ${(severity || "").toLowerCase()}">${severity || "Unknown"}</span>`;
}

function formatTime(t) {
  const d = /^\d+$/.test(String(t)) ? new Date(Number(t)) : new Date(t);
  return isNaN(d) ? "" : d.toLocaleString();
}

function policyLabelTags(labels) {
  if (!labels || !labels.length) return "";
  return `<div class="tags">${labels.map((l) => `<span class="tag">${l}</span>`).join("")}</div>`;
}

function renderList() {
  document.getElementById("list-screen").classList.remove("hidden");
  document.getElementById("detail-screen").classList.add("hidden");
  document.getElementById("title").textContent = "Alerts";
  document.getElementById("back-button").classList.add("hidden");

  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const alert of alerts) {
    const li = document.createElement("li");
    li.innerHTML = `
      ${severityBadge(alert.severity)}
      <div class="device">${alert.title}</div>
      <div class="summary">${alert.classification}${alert.type ? " · " + alert.type : ""}</div>
    `;
    li.addEventListener("click", () => {
      location.hash = `#/item/${alert.id}`;
    });
    list.appendChild(li);
  }
}

function renderDetail(id) {
  const alert = alerts.find((a) => a.id === id);
  if (!alert) {
    location.hash = "#/";
    return;
  }

  document.getElementById("list-screen").classList.add("hidden");
  document.getElementById("detail-screen").classList.remove("hidden");
  document.getElementById("title").textContent = alert.title;
  document.getElementById("back-button").classList.remove("hidden");

  document.getElementById("detail").innerHTML = `
    ${severityBadge(alert.severity)}
    <div class="meta">${formatTime(alert.time)}</div>
    <p>${alert.title}</p>
    <div class="recommended-action">${alert.classification || "Uncategorized"}${alert.type ? " · " + alert.type : ""}</div>
    ${policyLabelTags(alert.policyLabels)}
    <div class="actions">
      <button class="approve">Approve</button>
      <button class="reject">Reject</button>
      <button class="snooze">Snooze</button>
    </div>
    <div id="action-feedback"></div>
  `;

  document.querySelector(".approve").addEventListener("click", () => showFeedback("Approved"));
  document.querySelector(".reject").addEventListener("click", () => showFeedback("Rejected"));
  document.querySelector(".snooze").addEventListener("click", () => showFeedback("Snoozed"));
}

function showFeedback(action) {
  const el = document.getElementById("action-feedback");
  el.textContent = `${action} — recorded (demo only, nothing was actually sent).`;
  el.classList.add("action-feedback");
}

async function simulateNewAlert() {
  const template = INCOMING_ALERTS[simIndex % INCOMING_ALERTS.length];
  simIndex++;
  const alert = { ...template, time: new Date().toISOString() };
  alerts = [alert, ...alerts.filter((a) => a.id !== alert.id)];
  if (!(location.hash.startsWith("#/item"))) {
    renderList();
  }
  await notifyAlert(alert);
}

async function notifyAlert(alert) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;

  const reg = await navigator.serviceWorker.ready;
  reg.showNotification(`New ${alert.severity} alert`, {
    body: alert.title,
    icon: "icons/icon-192.png",
    data: { id: alert.id },
  });
}

document.getElementById("back-button").addEventListener("click", () => {
  location.hash = "#/";
});

document.getElementById("simulate-button").addEventListener("click", simulateNewAlert);

window.addEventListener("hashchange", render);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "navigate") {
      location.hash = event.data.hash;
    }
  });
}

function unlockApp() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  loadData();
  // Auto-fire one simulated push partway through a session, so it shows up
  // naturally during a moderated usability test rather than only on demand.
  setTimeout(simulateNewAlert, 25000);
}

function checkGate() {
  if (localStorage.getItem(GATE_KEY) === "true") {
    unlockApp();
    return;
  }

  document.getElementById("gate-submit").addEventListener("click", () => {
    const value = document.getElementById("gate-input").value;
    if (value === PASSCODE) {
      localStorage.setItem(GATE_KEY, "true");
      unlockApp();
    } else {
      document.getElementById("gate-error").classList.remove("hidden");
    }
  });
  document.getElementById("gate-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("gate-submit").click();
  });
}

checkGate();
