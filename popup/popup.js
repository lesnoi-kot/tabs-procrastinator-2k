document.addEventListener("DOMContentLoaded", render);

async function render() {
  const tabs = await browser.tabs.query({});
  const oldestTab = getOldestTab(tabs);

  UI.updateTabsCountValue(tabs);
  UI.updateOldestTab(oldestTab);
  UI.updateTop3Tabs(tabs);
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

class UI {
  static tabsCountEl = document.getElementById("tabs-count");
  static oldestTabIconEl = document.getElementById("oldest-tab-icon");
  static oldestTabTitleEl = document.getElementById("oldest-tab-title");
  static tabsPopularEl = document.getElementById("tabs-popular");

  static updateTabsCountValue(tabs) {
    UI.tabsCountEl.innerText = tabs.length;
  }

  static updateOldestTab(tab) {
    UI.oldestTabIconEl.src = tab.favIconUrl;
    UI.oldestTabTitleEl.innerHTML = `
      <b class="lh-1.25">${tab.title}</b><br>
      <span class="lh-1.25 text-regular">accessed at ${formatTabDate(tab)}</span>
    `;

    document.getElementById("oldest-tab-button").onclick = async () => {
      await browser.tabs.update(tab.id, { active: true });
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
            <img width="32" height="32" src="${tab.favIconUrl}">
            <span class="text-m">${groups[i][1].length}</span>
          </div>`
        );
      }
    }
  }
}

/* Utils */
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatTabDate(tab) {
  const date = new Date(tab.lastAccessed);
  return `${date.getDay()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}
