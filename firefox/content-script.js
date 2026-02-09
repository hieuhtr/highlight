// content-script.js - Highlight tạm thời, chính xác phần được chọn (không search toàn trang)

// ========== Highlight rendering logic ==========

let highlightCounter = 0; // Để tạo ID unique cho mỗi highlight group

/**
 * Highlight chính xác phần text đang được chọn (selection ranges)
 * - Không tìm kiếm toàn trang → tránh highlight thừa
 * - Hỗ trợ selection cross nhiều text node
 * - Trả về groupId để quản lý (đổi màu / xoá)
 * @param {string} defaultColor - màu mặc định
 * @returns {string} groupId - ID unique của highlight vừa tạo
 */
function highlightCurrentSelection(defaultColor = "#ffff99") {
  const selection = window.getSelection();
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;

  highlightCounter++;
  const groupId = `hl-group-${Date.now()}-${highlightCounter}`; // unique ID

  const ranges = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    ranges.push(selection.getRangeAt(i));
  }

  // Áp dụng từ cuối về đầu để tránh lệch offset
  ranges.reverse().forEach(range => {
    try {
      const span = document.createElement("span");
      span.className = "simple-highlight";
      span.style.backgroundColor = defaultColor;
      span.style.cursor = "pointer";
      span.dataset.groupId = groupId;           // Dùng groupId thay vì text gốc

      range.surroundContents(span);

      // Click để hiện menu
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        showHighlightMenu(span, groupId, defaultColor);
      });
    } catch (err) {
      console.warn("Không highlight được range này:", err);
    }
  });

  // Clear selection sau khi highlight
  selection.removeAllRanges();

  return groupId;
}

/**
 * Hiển thị menu khi click vào highlight
 * - Dùng groupId để quản lý toàn bộ spans thuộc cùng group
 * @param {HTMLElement} span - span được click
 * @param {string} groupId - ID của group highlight
 * @param {string} currentColor - màu hiện tại
 */
function showHighlightMenu(span, groupId, currentColor) {
  document.querySelectorAll('.highlight-context-menu').forEach(el => el.remove());

  const menu = document.createElement("div");
  menu.className = "highlight-context-menu";
  Object.assign(menu.style, {
    position: "absolute",
    background: "#ffffff",
    border: "1px solid #d0d0d0",
    borderRadius: "6px",
    padding: "8px",
    zIndex: "10001",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
    minWidth: "160px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    lineHeight: "1.3"
  });

  const rect = span.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;

  // Color row (giữ nguyên như cũ, bạn có thể chỉnh)
  const colorRow = document.createElement("div");
  Object.assign(colorRow.style, {
    display: "flex",
    alignItems: "center",
    marginBottom: "8px"
  });

  const label = document.createElement("span");
  label.textContent = "Color:";
  label.style.marginRight = "6px";
  colorRow.appendChild(label);

  const colors = ["#ffff99", "#ccffcc", "#b9e2f5", "#ffa29f", "#c0c0c0"];

  colors.forEach(color => {
    const btn = document.createElement("button");
    Object.assign(btn.style, {
      width: "22px",
      height: "22px",
      margin: "0 3px",
      backgroundColor: color,
      border: currentColor === color ? "2px solid #555" : "1px solid #ccc",
      borderRadius: "4px",
      cursor: "pointer",
    });

    btn.onclick = () => {
      document.querySelectorAll(`span.simple-highlight[data-group-id="${groupId}"]`)
        .forEach(el => el.style.backgroundColor = color);
      menu.remove();
    };
    colorRow.appendChild(btn);
  });

  menu.appendChild(colorRow);

  // Delete button (căn giữa)
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  Object.assign(deleteBtn.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "6px 0",
    backgroundColor: "#ff4d4d",
    color: "#ffffff",
    border: "none",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer"
  });

  deleteBtn.onmouseover = () => { deleteBtn.style.backgroundColor = "#ff3333"; };
  deleteBtn.onmouseout = () => { deleteBtn.style.backgroundColor = "#ff4d4d"; };

  deleteBtn.onclick = () => {
    document.querySelectorAll(`span.simple-highlight[data-group-id="${groupId}"]`)
      .forEach(el => {
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      });
    menu.remove();
  };

  menu.appendChild(deleteBtn);

  document.body.appendChild(menu);

  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

// ========== Nhận lệnh từ background ==========
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "highlight-selection") {
    highlightCurrentSelection("#ffff99");
  }
});