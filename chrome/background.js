// background.js

/**
 * Inject content script vào tab active HIỆN TẠI nếu tab đó là trang web hợp lệ
 * - Tránh inject vào chrome://, chrome-extension://, about:, file://, v.v.
 * - Chỉ inject vào http/https để tránh lỗi "Cannot access a chrome:// URL"
 */
async function injectContentScriptToActiveTab() {
  try {
    // Lấy tab active trong cửa sổ hiện tại
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Kiểm tra tab tồn tại và là URL web bình thường
    if (!tab?.id || !tab.url) {
      console.log("[Background] No active tab or no URL");
      return;
    }

    // Chỉ inject nếu URL bắt đầu bằng http hoặc https
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      console.log(`[Background] Skip injection - not a web page: ${tab.url}`);
      return;
    }

    // Thực hiện inject (dùng đúng đường dẫn file từ manifest)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scripts/content.js"]   // sửa nếu tên file khác, ví dụ: "content-script.js"
    });

    console.log(`[Background] Successfully injected into tab ${tab.id} (${tab.url})`);
  } catch (err) {
    console.error("[Background] Injection failed:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "highlight-censor",
    title: "Highlight + Censor",
    contexts: ["selection"]
  });

  injectContentScriptToActiveTab();
});

chrome.runtime.onStartup.addListener(injectContentScriptToActiveTab);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "highlight-censor" && info.selectionText?.trim()) {
    const text = info.selectionText.trim();

    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: "highlight-selection",
        text: text
      });
    } catch (err) {
      if (err.message.includes("Receiving end does not exist")) {
        await injectContentScriptToActiveTab();
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: "highlight-selection",
            text: text
          }).catch(console.error);
        }, 150);
      }
    }
  }
});