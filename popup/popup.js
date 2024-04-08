const DEFAULT_FAVICON_URL = "stub.png";

document.addEventListener("DOMContentLoaded", renderAll);
browser.tabs.onRemoved.addListener(renderAll);

async function renderAll() {
  const tabs = await getAllTabs();

  renderOldestTab(tabs);
  UI.updateTabsCountValue(tabs);
  UI.updateTop3Tabs(tabs);
}

async function goToTab(tabId) {
  return browser.tabs.update(tabId, { active: true });
}

function renderOldestTab(tabs) {
  const oldestTab = getOldestTab(tabs);
  UI.updateOldestTab(oldestTab);
}

async function getAllTabs() {
  return await browser.tabs.query({ windowId: browser.windows.WINDOW_ID_CURRENT });
}

function groupByHost(tabs) {
  const freqMap = {};

  for (const tab of tabs) {
    const url = new URL(tab.url);
    if (!freqMap[url.host]) {
      freqMap[url.host] = [];
    }

    freqMap[url.host].push(tab);
  }

  const groups = Object.entries(freqMap).sort((a, b) => b[1].length - a[1].length);
  return groups;
}

function getOldestTab(tabs) {
  if (tabs.length === 0) {
    return null;
  }

  let oldestTab = tabs[0];

  for (const tab of tabs) {
    if (tab.lastAccessed < oldestTab.lastAccessed) {
      oldestTab = tab;
    }
  }

  return oldestTab;
}

/* Action handlers */
async function closeAllTabs() {
  const tabs = await getAllTabs();
  await browser.tabs.remove(tabs.map(tab => tab.id));
  await renderAll();
}

async function closeTheOldestTab() {
  const tabs = await getAllTabs();
  const oldestTab = getOldestTab(tabs);

  if (oldestTab) {
    await browser.tabs.remove(oldestTab.id);
    await renderAll();
  }
}

async function bringTheOldestTab() {
  const tabs = await getAllTabs();
  const oldestTab = getOldestTab(tabs);

  if (oldestTab) {
    await browser.tabs.move(oldestTab.id, { index: -1 });
    await goToTab(oldestTab.id);
    await renderAll();
  }
}

async function groupTabs() {
  const tabs = await getAllTabs();
  const unpinnedTabs = tabs.filter(tab => !tab.pinned);
  const groups = groupByHost(unpinnedTabs);

  let index = tabs.length - unpinnedTabs.length; // Ignore pinned tabs

  for (const [_, groupedTabs] of groups) {
    await browser.tabs.move(groupedTabs.map(tab => tab.id), {
      index,
      windowId: browser.windows.WINDOW_ID_CURRENT,
    });
    index += groupedTabs.length;
  }
}

async function shuffleTabs() {
  const tabs = await getAllTabs();
  const unpinnedTabs = tabs.filter(tab => !tab.pinned);

  await browser.tabs.move(
    unpinnedTabs
      .map(tab => tab.id)
      .sort(() => Math.random() - 0.5),
    {
      index: tabs.length - unpinnedTabs.length,
      windowId: browser.windows.WINDOW_ID_CURRENT,
    },
  );
}

/* UI syncs */
class UI {
  static tabsCountEl = document.getElementById("tabs-count");
  static oldestTabIconEl = document.getElementById("oldest-tab-icon");
  static oldestTabTitleEl = document.getElementById("oldest-tab-title");
  static tabsPopularEl = document.getElementById("tabs-popular");

  static updateTabsCountValue(tabs) {
    UI.tabsCountEl.innerText = tabs.length;
  }

  static updateOldestTab(tab) {
    UI.oldestTabIconEl.src = tab.favIconUrl ?? DEFAULT_FAVICON_URL;
    UI.oldestTabTitleEl.innerHTML = `
      <b class="lh-1.25" style="overflow-wrap: anywhere;">${tab.title}</b><br>
      <span class="lh-1.25 text-regular">from ${extractHost(tab.url)}</span><br>
      <span class="lh-1.25 text-regular">accessed at ${formatTabDate(tab)}</span>
    `;

    document.getElementById("oldest-tab-button").onclick = async () => {
      await Promise.all([
        browser.tabs.update(tab.id, { active: true }),
        browser.tabs.query({}).then(renderOldestTab),
      ]);
    };
  }

  static updateTop3Tabs(tabs) {
    const groups = groupByHost(tabs);

    UI.tabsPopularEl.innerHTML = "";

    for (let i = 0; i < 3; ++i) {
      const tab = groups[i][1][0];

      if (tab) {
        UI.tabsPopularEl.innerHTML += (
          `<div title="${groups[i][0]}">
            <img width="32" height="32" src="${tab.favIconUrl ?? DEFAULT_FAVICON_URL}">
            <b class="text-m">${groups[i][1].length}</b>
          </div>`
        );
      }
    }
  }
}

document.getElementById('btn-close-oldest').onclick = closeTheOldestTab;
document.getElementById('btn-bring-oldest').onclick = bringTheOldestTab;

document.getElementById('btn-group').onclick = groupTabs;
document.getElementById('btn-randomize').onclick = shuffleTabs;
document.getElementById('btn-close-all').onclick = closeAllTabs;

/* Utils */
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatTabDate(tab) {
  const date = new Date(tab.lastAccessed);
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function extractHost(url) {
  return new URL(url).origin;
}
