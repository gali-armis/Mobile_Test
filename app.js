const PASSCODE = "Aa12345!";
const GATE_KEY = "armis-proto-unlocked";
const FOLLOWED_POLICIES_KEY = "armis-proto-followed-policies";

let alerts = [];
let activities = [];
let policies = [];

async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  const data = await res.json();
  alerts = data.alerts || [];
  activities = data.activities || [];
  policies = data.policies || [];
  render();
}

function getFollowedPolicies() {
  try {
    return JSON.parse(localStorage.getItem(FOLLOWED_POLICIES_KEY) || "[]");
  } catch {
    return [];
  }
}

function setFollowedPolicies(names) {
  localStorage.setItem(FOLLOWED_POLICIES_KEY, JSON.stringify(names));
}

function togglePolicyFollow(policyId) {
  const followed = getFollowedPolicies();
  const idx = followed.indexOf(policyId);
  if (idx >= 0) {
    followed.splice(idx, 1);
  } else {
    followed.push(policyId);
  }
  setFollowedPolicies(followed);
}

function severityBadge(severity) {
  return `<span class="badge ${(severity || "").toLowerCase()}">${severity || "Unknown"}</span>`;
}

function formatTime(t) {
  const d = /^\d+$/.test(String(t)) ? new Date(Number(t)) : new Date(t);
  return isNaN(d) ? "" : d.toLocaleString();
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function setNavActive(route) {
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === route);
  });
}

function setHeader(title, showBack) {
  document.getElementById("title").textContent = title;
  document.getElementById("back-button").classList.toggle("hidden", !showBack);
}

function render() {
  const route = location.hash || "#/home";
  const parts = route.slice(2).split("/"); // strip "#/"
  const [section, id] = parts;

  if (section === "item" && id) return renderAlertDetail(id);
  if (section === "activity" && id) return renderActivityDetail(id);
  if (section === "policies") return renderPolicies();
  if (section === "activities") return renderActivitiesList();
  if (section === "notifications") return renderNotifications();
  if (section === "alerts") return renderAlertsList();
  return renderHome();
}

function renderHome() {
  setNavActive("#/home");
  setHeader("Home", false);
  showScreen("screen-home");
}

function renderAlertsList() {
  setNavActive("#/alerts");
  setHeader("Alerts", false);
  showScreen("screen-alerts");

  const list = document.getElementById("alerts-list");
  list.innerHTML = "";
  for (const alert of alerts) {
    const li = document.createElement("li");
    li.innerHTML = `
      ${severityBadge(alert.severity)}
      <div class="device">${alert.title}</div>
      <div class="summary">${alert.policyTitle || alert.classification}${alert.type ? " · " + alert.type : ""}</div>
    `;
    li.addEventListener("click", () => {
      location.hash = `#/item/${alert.id}`;
    });
    list.appendChild(li);
  }
}

function renderAlertDetail(id) {
  const alert = alerts.find((a) => a.id === id);
  if (!alert) {
    location.hash = "#/alerts";
    return;
  }

  setHeader(alert.title, true);
  showScreen("screen-alert-detail");

  document.getElementById("alert-detail").innerHTML = `
    ${severityBadge(alert.severity)}
    <div class="meta">${formatTime(alert.time)}</div>
    <p>${alert.description || alert.title}</p>
    <div class="recommended-action">
      ${alert.policyTitle ? "Policy: " + alert.policyTitle : (alert.classification || "Uncategorized")}${alert.type ? " · " + alert.type : ""}
    </div>
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

function renderActivitiesList() {
  setNavActive("#/activities");
  setHeader("Activities", false);
  showScreen("screen-activities");

  const list = document.getElementById("activities-list");
  list.innerHTML = "";
  for (const activity of activities) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="device">${activity.title || activity.type || "Activity"}</div>
      <div class="summary">${formatTime(activity.time)}${activity.site ? " · " + activity.site : ""}</div>
    `;
    li.addEventListener("click", () => {
      location.hash = `#/activity/${activity.id}`;
    });
    list.appendChild(li);
  }
}

function renderActivityDetail(id) {
  const activity = activities.find((a) => a.id === id);
  if (!activity) {
    location.hash = "#/activities";
    return;
  }

  setHeader(activity.title || "Activity", true);
  showScreen("screen-activity-detail");

  document.getElementById("activity-detail").innerHTML = `
    <div class="meta">${formatTime(activity.time)}</div>
    <p>${activity.content || activity.title || ""}</p>
    <div class="recommended-action">
      ${activity.type || ""}${activity.protocol ? " · " + activity.protocol : ""}
      ${activity.sourceIp ? `<br>${activity.sourceIp} &rarr; ${activity.destinationIp || "?"}` : ""}
    </div>
  `;
}

function renderNotifications() {
  setNavActive("#/notifications");
  setHeader("Notifications", false);
  showScreen("screen-notifications");

  const followed = getFollowedPolicies();
  const emptyState = document.getElementById("notifications-empty");
  const list = document.getElementById("notifications-list");

  if (!followed.length) {
    emptyState.classList.remove("hidden");
    list.classList.add("hidden");
    return;
  }

  const triggered = alerts.filter((a) => followed.includes(a.policyId));

  if (!triggered.length) {
    emptyState.classList.remove("hidden");
    list.classList.add("hidden");
    document.querySelector("#notifications-empty p").textContent =
      "No alerts yet for the policies you follow.";
    return;
  }

  emptyState.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = "";
  for (const alert of triggered) {
    const li = document.createElement("li");
    li.innerHTML = `
      ${severityBadge(alert.severity)}
      <div class="device">${alert.title}</div>
      <div class="summary">Matched policy: ${alert.policyTitle || alert.policyId}</div>
    `;
    li.addEventListener("click", () => {
      location.hash = `#/item/${alert.id}`;
    });
    list.appendChild(li);
  }
}

function renderPolicies() {
  setHeader("Policies", true);
  showScreen("screen-policies");

  const followed = getFollowedPolicies();
  const list = document.getElementById("policies-list");
  list.innerHTML = "";
  for (const policy of policies) {
    const isFollowing = followed.includes(policy.id);
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="device">${policy.name}</div>
      ${policy.description ? `<div class="summary">${policy.description}</div>` : ""}
      <button class="follow-button ${isFollowing ? "following" : ""}">${isFollowing ? "Following" : "Follow"}</button>
    `;
    li.querySelector(".follow-button").addEventListener("click", (e) => {
      e.stopPropagation();
      togglePolicyFollow(policy.id);
      renderPolicies();
    });
    list.appendChild(li);
  }
}

document.getElementById("back-button").addEventListener("click", () => {
  history.back();
});

document.getElementById("browse-policies-button").addEventListener("click", () => {
  location.hash = "#/policies";
});

document.querySelectorAll(".nav-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    location.hash = btn.dataset.route;
  });
});

window.addEventListener("hashchange", render);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

function unlockApp() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  loadData();
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
