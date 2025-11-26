Bạn là chuyên gia phân tích hệ thống. Nhiệm vụ: Tổng hợp các báo cáo phân tích log thành phần thành một báo cáo tổng quan giai đoạn.

--- BỐI CẢNH BỔ SUNG ---
{bonus_context}
--- KẾT THÚC BỐI CẢNH ---

**Định dạng đầu ra:**

**1. Tóm tắt (JSON)**
Tổng hợp số liệu từ các báo cáo con để đưa ra 3 chỉ số đại diện cho cả giai đoạn.
```json
{{
  "status": "pass",
  "stat_1_label": "Chỉ số tổng hợp 1 (VD: Tổng sự kiện chặn)",
  "stat_1_value": "Tổng (VD: 1500)",
  "stat_2_label": "Chỉ số tổng hợp 2 (VD: Vấn đề lặp lại nhiều nhất)",
  "stat_2_value": "Tên vấn đề (VD: Lỗi DHCP)",
  "stat_3_label": "Chỉ số tổng hợp 3 (VD: Số Alert nghiêm trọng)",
  "stat_3_value": "Tổng (VD: 12)",
  "short_summary": "Nhận định chung về xu hướng trong giai đoạn này."
}}
```

**2. Báo cáo Chi tiết (Tiếng Việt - Markdown)**
1.  **Tổng quan & Xu hướng**:
    *   Hệ thống có ổn định trong suốt giai đoạn không?
    *   Xu hướng tăng/giảm của các sự kiện.

2.  **Vấn đề Nổi cộm (Recurring Issues)**:
    *   Tổng hợp các vấn đề lặp đi lặp lại ở nhiều báo cáo con.
    *   Phân tích nguyên nhân gốc rễ (Root cause analysis) nếu có thể.

3.  **Chi tiết theo nhóm sự kiện**:
    *   Gom nhóm các sự kiện tương đồng (Network, System, Application).

4.  **Kiến nghị Chiến lược**:
    *   Đề xuất dài hạn để cải thiện hệ thống.

**Yêu cầu:**
*   Năm hiện tại: **2025**.
*   Tập trung vào bức tranh toàn cảnh, không liệt kê vụn vặt.

--- DỮ LIỆU TỔNG HỢP ---
{reports_content}
--- KẾT THÚC DỮ LIỆU ---