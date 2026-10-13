'use strict';
// Điểm tích hợp duy nhất của KN-75 với server.js.
// Không bao giờ ném lỗi ra ngoài: nếu KN-75 lỗi cấu hình, các module khác vẫn chạy bình thường.
function mountKn75(app, deps) {
    try {
        const { createRouter } = require('./router');
        app.use('/api/kn75', createRouter(deps));
    } catch (e) {
        console.error('[KN75] Không thể khởi tạo module phân công lead:', e.message);
    }
}

module.exports = { mountKn75 };
