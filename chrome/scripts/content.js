// content-script.js

// ========== Highlight rendering logic ==========

let highlightCounter = 0;

/**
 * Highlight chính xác phần text đang được chọn
 * Lưu originalText ngay từ lúc tạo để dễ khôi phục sau
 */
function highlightCurrentSelection(defaultColor = "#ffff99") {
  const selection = window.getSelection();
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;

  highlightCounter++;
  const groupId = `hl-group-${Date.now()}-${highlightCounter}`;

  const ranges = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    ranges.push(selection.getRangeAt(i));
  }

  ranges.reverse().forEach(range => {
    try {
      const span = document.createElement("span");
      span.className = "highlight-censor";
      span.style.backgroundColor = defaultColor;
      span.style.cursor = "pointer";
      span.dataset.groupId = groupId;

      // Lưu text gốc ngay lúc wrap (để censor/un-censor/delete dùng lại)
      span.dataset.originalText = range.toString();

      range.surroundContents(span);

      span.addEventListener("click", (e) => {
        e.stopPropagation();
        showHighlightMenu(span, groupId, defaultColor);
      });
    } catch (err) {
      console.warn("Không highlight được range này:", err);
    }
  });

  selection.removeAllRanges();
  return groupId;
}

/**
 * Toggle censor / un-censor cho group
 * - Censor: ẩn text bằng nền đen + chữ đen
 * - Un-censor: khôi phục text gốc + XÓA HẾT style màu nền
 */
function toggleCensor(groupId) {
  const spans = document.querySelectorAll(`span.highlight-censor[data-group-id="${groupId}"]`);
  if (spans.length === 0) return;

  const isCurrentlyCensored = spans[0].classList.contains("censored");

  spans.forEach(span => {
    if (isCurrentlyCensored) {
      // Un-censor → xóa luôn highlight hoàn toàn (giống Delete)
    deleteHighlight(groupId);
    } else {
      // Censor: ẩn text
      span.classList.add("censored");
      span.style.backgroundColor = "#000";
      span.style.color = "#000";
      span.style.cursor = "default";
      // Không thay text → giữ nguyên cấu trúc DOM, chỉ ẩn bằng màu
    }
  });
}

/**
 * Xóa toàn bộ highlight group
 * - Unwrap text (khôi phục text gốc)
 * - Xóa span wrapper hoàn toàn
 * - Không để lại style nào
 */
function deleteHighlight(groupId) {
  const spans = document.querySelectorAll(`span.highlight-censor[data-group-id="${groupId}"]`);

  spans.forEach(span => {
    const parent = span.parentNode;
    // Khôi phục text gốc trước khi unwrap (đề phòng text đã bị thay đổi)
    //if (span.dataset.originalText) {
    //  span.textContent = span.dataset.originalText;
    //}
    // Unwrap: đưa text ra ngoài, xóa span
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  });
}

/**
 * Hiển thị menu context khi click vào highlight
 */
function showHighlightMenu(span, groupId, defaultColor) {
  document.querySelectorAll(".highlight-censor-context-menu").forEach(el => el.remove());

  const menu = document.createElement("div");
  menu.className = "highlight-censor-context-menu";
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

  // Color picker (chỉ hoạt động khi chưa censored)
  const colorRow = document.createElement("div");
  Object.assign(colorRow.style, {
    display: "flex",
    alignItems: "center",
    marginBottom: "10px"
  });

  const label = document.createElement("span");
  label.textContent = "Color:";
  label.style.marginRight = "8px";
  colorRow.appendChild(label);

  const colors = ["#ffff99", "#ccffcc", "#b9e2f5", "#ffa29f", "#c0c0c0"];

  colors.forEach(color => {
    const btn = document.createElement("button");
    Object.assign(btn.style, {
      width: "24px",
      height: "24px",
      margin: "0 4px",
      backgroundColor: color,
      border: span.style.backgroundColor === color ? "2px solid #444" : "1px solid #bbb",
      borderRadius: "5px",
      cursor: "pointer",
    });

    btn.onclick = () => {
      const spans = document.querySelectorAll(`span.highlight-censor[data-group-id="${groupId}"]`);
      if (spans.length > 0 && !spans[0].classList.contains("censored")) {
        spans.forEach(el => {
          el.style.backgroundColor = color;
        });
      }
      menu.remove();
    };
    colorRow.appendChild(btn);
  });

  menu.appendChild(colorRow);

  // Nút Censor / Un-censor
  const spans = document.querySelectorAll(`span.highlight-censor[data-group-id="${groupId}"]`);
  const isCensored = spans.length > 0 && spans[0].classList.contains("censored");

  const censorBtn = document.createElement("button");
  censorBtn.textContent = isCensored ? "Un-censor" : "Censor";
  Object.assign(censorBtn.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "8px 0",
    marginBottom: "8px",
    backgroundColor: isCensored ? "#4CAF50" : "#757575",
    color: "#ffffff",
    border: "none",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer"
  });

  censorBtn.onclick = () => {
    toggleCensor(groupId);
    menu.remove();
  };
  menu.appendChild(censorBtn);

  // Nút Delete
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  Object.assign(deleteBtn.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "8px 0",
    backgroundColor: "#ff4d4d",
    color: "#ffffff",
    border: "none",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer"
  });

  deleteBtn.onmouseover = () => { deleteBtn.style.backgroundColor = "#e63946"; };
  deleteBtn.onmouseout = () => { deleteBtn.style.backgroundColor = "#ff4d4d"; };

  deleteBtn.onclick = () => {
    deleteHighlight(groupId);
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

// Nhận lệnh highlight từ background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "highlight-selection") {
    highlightCurrentSelection("#ffff99");
  }
});