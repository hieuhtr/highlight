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
    padding: "6px",
    zIndex: "10001",
    boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
    minWidth: "100px",
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
    marginBottom: "6px"
  });

  const label = document.createElement("span");
  label.textContent = "Color:";
  label.style.marginRight = "1px";
  colorRow.appendChild(label);

  const colors = ["#ffff99", "#ccffcc", "#b9e2f5", "#ffa29f", "#c0c0c0"];

  colors.forEach(color => {
    const btn = document.createElement("button");
    Object.assign(btn.style, {
      width: "24px",
      height: "24px",
      margin: "0 2px",
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
    padding: "7px 0",
    marginBottom: "5px",
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
    padding: "7px 0",
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

// ========== Censor image logic (cải tiến - chính xác hơn) ==========

/**
 * Censor đúng một hình ảnh mà người dùng right-click
 * Ưu tiên: targetElementId → currentSrc khớp → fallback filename
 * @param {string} srcUrl - URL từ context menu (thường là absolute)
 * @param {string|null} targetElementId - ID của target element (nếu browser hỗ trợ, Chrome MV3 tốt)
 */
function censorCurrentImage(srcUrl, targetElementId = null) {
  if (!srcUrl) return;

  let targetImg = null;

  // Cách 1: Ưu tiên cao nhất - dùng targetElementId (Chrome hỗ trợ tốt từ MV3)
  if (targetElementId) {
    try {
      targetImg = browser.menus.getTargetElement(targetElementId);
      if (targetImg && targetImg.tagName === 'IMG') {
        // Xác nhận đây là <img>
        applyCensorToImage(targetImg);
        return; // xong sớm nếu match
      }
    } catch (err) {
      console.warn("[Censor Image] targetElementId không hợp lệ:", err);
    }
  }

  // Cách 2: So sánh currentSrc (absolute URL thực tế browser load)
  // Đây là cách đáng tin cậy nhất khi không có targetElementId
  const images = document.querySelectorAll('img');
  for (const img of images) {
    // currentSrc là URL đầy đủ mà browser thực sự dùng
    if (img.currentSrc && img.currentSrc === srcUrl) {
      targetImg = img;
      break;
    }
  }

  if (targetImg) {
    applyCensorToImage(targetImg);
    return;
  }

  // Cách 3: Fallback cũ (filename) - chỉ dùng khi 2 cách trên fail
  // (ít xảy ra hơn sau khi có currentSrc)
  const filename = srcUrl.split('/').pop().split('?')[0].split('#')[0];
  if (!filename) return;

  const fallbackImages = document.querySelectorAll(`img[src$="${CSS.escape(filename)}"]`);
  if (fallbackImages.length === 1) {
    // Chỉ có 1 ảnh khớp filename → an toàn để censor
    targetImg = fallbackImages[0];
    applyCensorToImage(targetImg);
  } else if (fallbackImages.length > 1) {
    console.warn(`[Censor Image] Tìm thấy ${fallbackImages.length} ảnh cùng filename "${filename}". Không censor để tránh nhầm.`);
  } else {
    console.warn(`[Censor Image] Không tìm thấy ảnh nào khớp srcUrl: ${srcUrl}`);
  }
}

/**
 * Áp dụng overlay censor lên một <img> cụ thể
 * @param {HTMLImageElement} img - phần tử img cần censor
 */
function applyCensorToImage(img) {
  if (img.dataset.censored) return; // đã censor rồi

  // Tạo wrapper relative nếu parent chưa có position
  let wrapper = img.parentNode;
  if (getComputedStyle(wrapper).position === 'static') {
    const tempWrapper = document.createElement('div');
    tempWrapper.style.position = 'relative';
    tempWrapper.style.display = getComputedStyle(img).display;
    tempWrapper.style.width = img.width ? `${img.width}px` : 'fit-content';
    tempWrapper.style.height = img.height ? `${img.height}px` : 'fit-content';

    img.parentNode.insertBefore(tempWrapper, img);
    tempWrapper.appendChild(img);
    wrapper = tempWrapper;
  }

  // Tạo overlay đen
  const overlay = document.createElement('div');
  overlay.className = 'highlight-image-censor-overlay';
  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    backgroundColor: '#000000',
    borderRadius: img.style.borderRadius || '5px',
    opacity: '1',
    zIndex: '9999',
    pointerEvents: 'auto',
    transition: 'opacity 0.2s ease',
  });

  wrapper.appendChild(overlay);
  img.dataset.censored = 'true';

  // Hover → hiện menu Un-censor
  overlay.addEventListener('mouseenter', () => {
    showImageCensorMenu(overlay, img);
  });
}

/**
 * Menu đơn giản cho hình censored: chỉ có nút Un-censor
 * @param {HTMLElement} overlay - div censor đang click
 * @param {HTMLElement} img - hình gốc
 */
function showImageCensorMenu(overlay, img) {
  // Xóa menu cũ
  document.querySelectorAll('.highlight-censor-context-menu').forEach(el => el.remove());

  const menu = document.createElement("div");
  menu.className = "highlight-censor-context-menu";
  Object.assign(menu.style, {
    position: 'absolute',
    background: '#ffffff',
    border: '1px solid #d0d0d0',
    borderRadius: '6px',
    padding: '6px',
    zIndex: '10002',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
    minWidth: '100px',
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    lineHeight: "1.3"
  });

  const rect = overlay.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;

  const unCensorBtn = document.createElement("button");
  unCensorBtn.textContent = "Un-censor";
  Object.assign(unCensorBtn.style, {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    backgroundColor: '#4caf50',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: "13px",
    fontWeight: '500',
    cursor: 'pointer',
  });

  unCensorBtn.onmouseover = () => { unCensorBtn.style.backgroundColor = "#43a047"; };
  unCensorBtn.onmouseout = () => { unCensorBtn.style.backgroundColor = "#4caf50"; };

  unCensorBtn.onclick = () => {
    // Xoá overlay
    overlay.remove();
    delete img.dataset.censored;
    menu.remove();
  };

  menu.appendChild(unCensorBtn);
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

// Nhận lệnh highlight từ background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "highlight-selection") {
    highlightCurrentSelection("#ffff99");
  }

  if (message.action === "censor-image") {
    // Bây giờ nhận cả srcUrl và targetElementId (nếu có)
    if (message.srcUrl) {
      censorCurrentImage(message.srcUrl);
    }
  }
});