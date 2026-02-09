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

// ========== Hiển thị menu đơn giản khi click highlight ==========
// ========== Hiển thị menu nhỏ gọn khi click highlight ==========
/**
 * Hiển thị menu compact khi click vào vùng đã highlight
 * - Font nhỏ, border mỏng, khoảng cách giảm để gọn gàng
 * - Dòng 1: "Color:" + ô vuông màu nhỏ
 * - Dòng 2: Nút Delete đỏ compact
 * @param {HTMLElement} span - span highlight được click
 * @param {string} text - text gốc của nhóm highlight (dùng để group)
 * @param {string} currentColor - màu hiện tại của nhóm
 */
function showHighlightMenu(span, text, currentColor) {
  // Xóa menu cũ nếu tồn tại
  document.querySelectorAll('.highlight-context-menu').forEach(el => el.remove());

  const menu = document.createElement("div");
  menu.className = "highlight-context-menu";
  Object.assign(menu.style, {
    position: "absolute",
    background: "#ffffff",
    border: "1px solid #d0d0d0",         // border nhẹ hơn
    borderRadius: "6px",
    padding: "8px",                       // giảm padding
    zIndex: "10001",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
    minWidth: "160px",                    // gọn hơn
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",                     // font nhỏ hơn
    lineHeight: "1.3"
  });

  // Vị trí menu
  const rect = span.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;   // sát hơn
  menu.style.left = `${rect.left + window.scrollX}px`;

  // Dòng 1: Color + swatches nhỏ gọn
  const colorRow = document.createElement("div");
  Object.assign(colorRow.style, {
    display: "flex",
    alignItems: "center",
    marginBottom: "8px"                   // giảm khoảng cách
  });

  const label = document.createElement("span");
  label.textContent = "Color:";
  Object.assign(label.style, {
    marginRight: "6px",
    fontWeight: "500",
    color: "#444"
  });
  colorRow.appendChild(label);

  // Danh sách màu (giữ nguyên thứ tự bạn đang dùng)
  const colors = [
    "#ffff99",   // vàng
    "#ccffcc",   // xanh lá
    "#b9e2f5",   // xanh dương
    "#ffa29f",   // hồng
    "#c0c0c0"    // xám (censor?)
  ];

  colors.forEach(color => {
    const btn = document.createElement("button");
    Object.assign(btn.style, {
      width: "22px",                      // nhỏ hơn
      height: "22px",
      margin: "0 3px",                    // khoảng cách hẹp hơn
      backgroundColor: color,
      border: currentColor === color 
        ? "2px solid #555"                // active border mỏng & đậm vừa
        : "1px solid #ccc",               // border nhẹ
      borderRadius: "4px",
      cursor: "pointer",
      boxShadow: currentColor === color 
        ? "0 0 0 2px #fff inset" 
        : "inset 0 1px 2px rgba(0,0,0,0.08)",
      flexShrink: 0
    });

    btn.title = color;
    btn.onclick = () => {
      document.querySelectorAll(`span.simple-highlight[data-text="${CSS.escape(text)}"]`)
        .forEach(el => el.style.backgroundColor = color);
      menu.remove();
    };
    colorRow.appendChild(btn);
  });

  menu.appendChild(colorRow);

  // Dòng 2: Nút Delete compact
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete highlight";
  Object.assign(deleteBtn.style, {
    display: "flex",              // <-- Dùng flex
  alignItems: "center",         // Căn giữa theo chiều dọc
  justifyContent: "center",     // Căn giữa theo chiều ngang
  width: "100%",
  padding: "6px 0",
  backgroundColor: "#ff4d4d",
  color: "#ffffff",
  border: "none",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: "500",
  cursor: "pointer",
    cursor: "pointer"
  });

  deleteBtn.onmouseover = () => { deleteBtn.style.backgroundColor = "#ff3333"; };
  deleteBtn.onmouseout  = () => { deleteBtn.style.backgroundColor = "#ff4d4d"; };

  deleteBtn.onclick = () => {
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

  // Đóng menu khi click ngoài
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