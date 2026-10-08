/**
 * TMS - Client-Side Access Guard (KN-48)
 * Tự động chặn truy cập màn hình chức năng khi người dùng không đủ quyền hoặc chưa đăng nhập.
 * Chạy ngay lập tức trong thẻ <head> trước khi bất kỳ thành phần giao diện hay dữ liệu nào được hiển thị.
 */
(function() {
    // Ẩn tạm thời body để ngăn chặn hiện tượng chớp nháy (Flash of Unauthorized Content)
    var style = document.createElement("style");
    style.id = "tms-guard-preload-mask";
    style.textContent = "body { display: none !important; }";
    document.head.appendChild(style);

    function releaseMask() {
        var mask = document.getElementById("tms-guard-preload-mask");
        if (mask) mask.remove();
    }

    try {
        var currentScript = document.currentScript;
        var requiredRole = (currentScript && currentScript.getAttribute("data-required")) || "administrator";

        var token = localStorage.getItem("tms_token") || localStorage.getItem("token");
        var currentRole = (localStorage.getItem("tms_current_role") || "").toLowerCase().trim();

        var currentUser = null;
        try {
            var rawUser = localStorage.getItem("tms_current_user") || localStorage.getItem("tms_user");
            if (rawUser) currentUser = JSON.parse(rawUser);
        } catch (e) {}

        var userRoles = [];
        if (currentUser && currentUser.role) {
            userRoles.push(currentUser.role.toLowerCase());
        }
        if (currentUser && Array.isArray(currentUser.roles)) {
            currentUser.roles.forEach(function(r) {
                var roleCode = (typeof r === "string" ? r : (r.code || r.name || "")).toLowerCase();
                if (roleCode && userRoles.indexOf(roleCode) === -1) {
                    userRoles.push(roleCode);
                }
            });
        }
        // Bảo mật: Chỉ công nhận quyền hạn thực tế trong hồ sơ, không bao giờ tin tưởng mù quáng vào currentRole
        if (userRoles.indexOf("administrator") !== -1 || userRoles.indexOf("admin") !== -1) {
            userRoles.push("administrator");
            userRoles.push("admin");
        } else if (currentRole && userRoles.indexOf(currentRole) !== -1) {
            // currentRole hợp lệ mà người dùng thực sự sở hữu
        }

        var isUnauthenticated = !token && (!currentUser || !currentUser.id);

        var hasPermission = userRoles.some(function(r) {
            if (requiredRole === "administrator") {
                return r === "administrator" || r === "admin";
            }
            return r === requiredRole.toLowerCase();
        });

        if (isUnauthenticated || !hasPermission) {
            // Chuyển hướng ngay tới trang Error 403 với ngữ cảnh chi tiết (KN-48, KN-50, KN-51)
            var target = "/Error.html?code=403"
                + "&from=" + encodeURIComponent(window.location.pathname)
                + "&required=" + encodeURIComponent(requiredRole);
            window.location.replace(target);
            return;
        }

        // Đủ thẩm quyền: Mở khóa hiển thị
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", releaseMask);
        } else {
            releaseMask();
        }
    } catch (err) {
        console.error("TMS Access Guard Error:", err);
        releaseMask();
    }
})();
