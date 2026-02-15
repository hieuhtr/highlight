// background.js - Tạo menu context và inject content script khi cần (fix Firefox temporary)

async function injectContentScriptToActiveTab() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scripts/content.js"]
    });
  } catch (err) {
    console.error("[Background] Injection failed:", err);
  }
}

browser.runtime.onInstalled.addListener(() => {
  // Menu cho text selection
  browser.contextMenus.create({
    id: "highlight-censor",
    title: "Highlight + Censor",
    contexts: ["selection"]
  });

  // Menu cho image
  browser.contextMenus.create({
    id: "censor-image",
    title: "Highlight + Censor",
    contexts: ["image"]
  });

  injectContentScriptToActiveTab();
});

browser.runtime.onStartup.addListener(injectContentScriptToActiveTab);

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  // Xử lý menu cho text
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

  // Xử lý menu cho image
  if (info.menuItemId === "censor-image" && info.srcUrl) {
    try {
      await browser.tabs.sendMessage(tab.id, {
        action: "censor-image",
        srcUrl: info.srcUrl,           // để match hình chính xác
        targetElementId: info.targetElementId || null  // nếu Firefox hỗ trợ
      });
    } catch (err) {
      console.error("Send censor message failed:", err);
      // Inject lại nếu cần
      await injectContentScriptToActiveTab();
      setTimeout(() => {
        browser.tabs.sendMessage(tab.id, {
          action: "censor-image",
          srcUrl: info.srcUrl
        }).catch(console.error);
      }, 150);
    }
  }
});