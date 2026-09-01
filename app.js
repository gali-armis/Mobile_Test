const PASSCODE = "Aa12345!";
const GATE_KEY = "armis-proto-unlocked";

let alerts = [];

const INCOMING_ALERTS = [
  {
    id: "sim-1",
    device: "VPN-Gateway-East",
    risk: "Critical",
    summary: "New device enrolled outside business hours",
    description: "A new device enrolled on the VPN gateway at 2:47am, outside the org's normal enrollment window. The AI recommends verifying this enrollment with the device owner.",
    recommendedAction: "Verify enrollment with owner",
  },
  {
    id: "sim-2",
    device: "Camera-Loading-Dock-4",
    risk: "High",
    summary: "Device sending data to a newly-seen destination",
    description: "This device began sending traffic to a destination it has never contacted before. The AI recommends a closer look before allowing this to continue.",
    recommendedAction: "Review destination, then decide",
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

function riskBadge(risk) {
  return `<span class="badge ${risk.toLowerCase()}">${risk}</span>`;
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
      ${riskBadge(alert.risk)}
      <div class="device">${alert.device}</div>
      <div class="summary">${alert.summary}</div>
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
  document.getElementById("title").textContent = alert.device;
  document.getElementById("back-button").classList.remove("hidden");

  document.getElementById("detail").innerHTML = `
    ${riskBadge(alert.risk)}
    <div class="meta">${new Date(alert.timestamp || Date.now()).toLocaleString()}</div>
    <p>${alert.description}</p>
    <div class="recommended-action">AI recommends: <strong>${alert.recommendedAction}</strong></div>
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
  const alert = { ...template, timestamp: new Date().toISOString() };
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
  reg.showNotification(`New ${alert.risk} alert: ${alert.device}`, {
    body: alert.summary,
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
