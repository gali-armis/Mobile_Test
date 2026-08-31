let items = [];
let updatedAt = "";

async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  const data = await res.json();
  items = data.items;
  updatedAt = data.updatedAt;
  render();
}

function render() {
  const route = location.hash.slice(2); // strip "#/"
  const [view, id] = route.split("/");

  document.getElementById("refreshed-at").textContent = updatedAt
    ? `Data refreshed: ${new Date(updatedAt).toLocaleString()}`
    : "";

  if (view === "item" && id) {
    renderDetail(id);
  } else {
    renderList();
  }
}

function renderList() {
  document.getElementById("list-screen").classList.remove("hidden");
  document.getElementById("detail-screen").classList.add("hidden");
  document.getElementById("title").textContent = "Items";
  document.getElementById("back-button").classList.add("hidden");

  const list = document.getElementById("list");
  list.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="title">${item.title}</div>
      <div class="subtitle">${item.subtitle}</div>
    `;
    li.addEventListener("click", () => {
      location.hash = `#/item/${item.id}`;
    });
    list.appendChild(li);
  }
}

function renderDetail(id) {
  const item = items.find((i) => i.id === id);
  if (!item) {
    location.hash = "#/";
    return;
  }

  document.getElementById("list-screen").classList.add("hidden");
  document.getElementById("detail-screen").classList.remove("hidden");
  document.getElementById("title").textContent = item.title;
  document.getElementById("back-button").classList.remove("hidden");

  document.getElementById("detail").innerHTML = `
    <h2>${item.title}</h2>
    <div class="meta">${item.subtitle} &middot; ${new Date(item.timestamp).toLocaleDateString()}</div>
    <p>${item.description}</p>
  `;
}

document.getElementById("back-button").addEventListener("click", () => {
  location.hash = "#/";
});

window.addEventListener("hashchange", render);
loadData();
