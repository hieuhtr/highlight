// background.js - Tạo menu context và inject content script khi cần (fix Firefox temporary)

async function injectContentScriptToActiveTab() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-script.js"]
    });
  } catch (err) {
    console.error("[Background] Injection failed:", err);
  }
}

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "highlight-censor",
    title: "Highlight + Censor",
    contexts: ["selection"]
  });

  injectContentScriptToActiveTab();
});

browser.runtime.onStartup.addListener(injectContentScriptToActiveTab);

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "highlight-censor" && info.selectionText?.trim()) {
    const text = info.selectionText.trim();

    try {
      await browser.tabs.sendMessage(tab.id, {
        action: "highlight-selection",
        text: text
      });
    } catch (err) {
      if (err.message.includes("Receiving end does not exist")) {
        await injectContentScriptToActiveTab();
        setTimeout(() => {
          browser.tabs.sendMessage(tab.id, {
            action: "highlight-selection",
            text: text
          }).catch(console.error);
        }, 150);
      }
    }
  }
});