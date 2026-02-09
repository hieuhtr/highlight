// content-script.js - Highlight tạm thời (mất khi refresh), hỗ trợ nhiều highlight cùng lúc

// ========== Highlight rendering logic ==========

/**
 * Tạo và bọc một span highlight cho một đoạn text cụ thể
 * @param {string} textToHighlight - đoạn text cần highlight
 * @param {string} color - màu nền (default vàng)
 */
function applyHighlight(textToHighlight, color = "#ffff99") {
  if (!textToHighlight?.trim()) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  textNodes.forEach(textNode => {
    let text = textNode.nodeValue;
    let start = text.indexOf(textToHighlight);

    while (start !== -1) {
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + textToHighlight.length);

      const span = document.createElement("span");
      span.className = "simple-highlight";
      span.style.backgroundColor = color;
      span.style.padding = "1px 2px";
      span.style.cursor = "pointer";
      // Lưu text gốc để dễ quản lý đổi màu / xoá nhóm
      span.dataset.text = textToHighlight;

      try {
        range.surroundContents(span);

        // Click để hiện menu đổi màu / xoá
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          showHighlightMenu(span, textToHighlight, color);
        });
      } catch (err) {
        console.warn("Cannot highlight this range (overlap?):", err);
      }

      // Tiếp tục tìm trong phần còn lại của node
      text = textNode.nodeValue;
      start = text.indexOf(textToHighlight, start + textToHighlight.length);
    }
  });
}

/**
 * Hiển thị menu nhỏ khi click vào vùng highlight
 * @param {HTMLElement} span - phần tử span được click
 * @param {string} text - text gốc của highlight group
 * @param {string} currentColor - màu hiện tại
 */
function showHighlightMenu(span, text, currentColor) {
  // Xóa menu cũ nếu tồn tại
  document.querySelectorAll('.highlight-context-menu').forEach(el => el.remove());

  const menu = document.createElement("div");
  menu.className = "highlight-context-menu";
  menu.style.position = "absolute";
  menu.style.background = "#fff";
  menu.style.border = "1px solid #ccc";
  menu.style.padding = "8px";
  menu.style.zIndex = "10000";
  menu.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.2)";
  menu.style.minWidth = "120px";

  const rect = span.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;

  // Danh sách màu lựa chọn
  const colors = [
    { name: "Vàng", value: "#ffff99" },
    { name: "Xanh lá", value: "#ccffcc" },
    { name: "Hồng", value: "#ffccff" },
    { name: "Xanh dương", value: "#cce5ff" },
    { name: "Cam", value: "#ffe5cc" }
  ];

  colors.forEach(c => {
    const btn = document.createElement("button");
    btn.textContent = c.name;
    btn.style.display = "block";
    btn.style.width = "100%";
    btn.style.margin = "4px 0";
    btn.style.background = c.value;
    btn.style.border = currentColor === c.value ? "2px solid #000" : "1px solid #aaa";
    btn.onclick = () => {
      // Đổi màu tất cả span thuộc cùng group text
      document.querySelectorAll(`span.simple-highlight[data-text="${CSS.escape(text)}"]`)
        .forEach(el => {
          el.style.backgroundColor = c.value;
        });
      menu.remove();
    };
    menu.appendChild(btn);
  });

  // Nút xoá group highlight
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Xoá highlight này";
  deleteBtn.style.display = "block";
  deleteBtn.style.width = "100%";
  deleteBtn.style.marginTop = "8px";
  deleteBtn.style.background = "#ffcccc";
  deleteBtn.onclick = () => {
    // Xoá tất cả span thuộc cùng group text
    document.querySelectorAll(`span.simple-highlight[data-text="${CSS.escape(text)}"]`)
      .forEach(el => {
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      });
    menu.remove();
  };
  menu.appendChild(deleteBtn);

  document.body.appendChild(menu);

  // Đóng menu khi click ra ngoài
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

// ========== Nhận lệnh highlight từ background ==========

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "highlight-selection" && message.text?.trim()) {
    const selectedText = message.text.trim();

    // KHÔNG xóa highlight cũ nữa → giữ tất cả
    // clearExistingHighlights();  // <-- Bỏ dòng này đi

    applyHighlight(selectedText, "#ffff99");

    // Clear selection trên trang
    window.getSelection().removeAllRanges();
  }
});