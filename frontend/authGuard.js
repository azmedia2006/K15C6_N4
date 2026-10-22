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

    // Xóa sạch bộ nhớ đệm, session và cache web khi xác thực không hợp lệ hoặc đăng xuất
    function purgeAllAuthData() {
        try {
            localStorage.removeItem("tms_token");
            localStorage.removeItem("token");
            localStorage.removeItem("tms_current_user");
            localStorage.removeItem("tms_user");
            localStorage.removeItem("tms_current_role");
            sessionStorage.clear();
            if (typeof window !== "undefined" && 'caches' in window) {
                caches.keys().then(function(names) {
                    names.forEach(function(name) { caches.delete(name); });
                });
            }
        } catch (e) {}
    }

    // Cung cấp hàm logout toàn cục xóa sạch cache và thu hồi phiên trên Server
    window.tmsLogout = function() {
        var tok = localStorage.getItem("tms_token") || localStorage.getItem("token");
        if (tok && tok !== "tms_demo_admin_token") {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "/api/auth/logout", true);
                xhr.setRequestHeader("Authorization", "Bearer " + tok);
                xhr.send();
            } catch (e) {}
        }
        purgeAllAuthData();
        window.location.replace("/Login.html");
    };
    window.logout = window.tmsLogout;

    // Ngăn chặn phục hồi dữ liệu từ Back/Forward Cache (bfcache) của trình duyệt
    window.addEventListener("pageshow", function(event) {
        if (event.persisted) {
            window.location.reload();
        }
    });

    // Global 401 Interceptor: Bắt mọi phản hồi HTTP 401 trên toàn trang để tự động thu hồi phiên
    if (window.fetch) {
        var _originalFetch = window.fetch;
        window.fetch = function() {
            return _originalFetch.apply(this, arguments).then(function(response) {
                if (response && response.status === 401) {
                    purgeAllAuthData();
                    window.location.replace("/Login.html?error=session_expired");
                }
                return response;
            });
        };
    }

    try {
        var currentScript = document.currentScript;
        var requiredRole = (currentScript && currentScript.getAttribute("data-required")) || "administrator";

        var token = localStorage.getItem("tms_token") || localStorage.getItem("token");
        var currentRole = (localStorage.getItem("tms_current_role") || "").toLowerCase().trim();

        function getRedirectQuery() {
            var path = window.location.pathname || "";
            if (!path || path === "/" || path === "/Login.html" || path === "/login") return "";
            return "?redirect=" + encodeURIComponent(path + (window.location.search || "") + (window.location.hash || ""));
        }

        // 1. Chặn ngay lập tức nếu không có Token
        if (!token) {
            purgeAllAuthData();
            window.location.replace("/Login.html" + getRedirectQuery());
            return;
        }

        // 2. Kiểm tra tính toàn vẹn và thời hạn của JWT Token
        if (token !== "tms_demo_admin_token") {
            try {
                var parts = token.split(".");
                if (parts.length === 3) {
                    var base64Url = parts[1];
                    var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                    var payloadJson = decodeURIComponent(atob(base64).split("").map(function(c) {
                        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(""));
                    var payload = JSON.parse(payloadJson);
                    if (payload && payload.exp && (payload.exp * 1000) < Date.now()) {
                        // Token đã quá hạn
                        purgeAllAuthData();
                        var q = getRedirectQuery();
                        window.location.replace("/Login.html" + (q ? q + "&error=session_expired" : "?error=session_expired"));
                        return;
                    }
                }
            } catch (errToken) {
                // Token định dạng sai lệch
                purgeAllAuthData();
                var q = getRedirectQuery();
                window.location.replace("/Login.html" + (q ? q + "&error=unauthorized" : "?error=unauthorized"));
                return;
            }
        }

        // 3. Xác minh Token trực tiếp với Backend API /api/auth/me qua Synchronous XHR
        var currentUser = null;
        if (token !== "tms_demo_admin_token") {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "/api/auth/me", false); // Chạy đồng bộ trong <head> để bảo vệ tuyệt đối
                xhr.setRequestHeader("Authorization", "Bearer " + token);
                xhr.send();
                if (xhr.status === 200) {
                    var authData = JSON.parse(xhr.responseText || "{}");
                    if (authData && authData.success && authData.user) {
                        currentUser = authData.user;
                        localStorage.setItem("tms_current_user", JSON.stringify(currentUser));
                        localStorage.setItem("tms_user", JSON.stringify(currentUser));
                    } else {
                        purgeAllAuthData();
                        var q = getRedirectQuery();
                        window.location.replace("/Login.html" + (q ? q + "&error=unauthorized" : "?error=unauthorized"));
                        return;
                    }
                } else if (xhr.status === 401 || xhr.status === 403) {
                    // Máy chủ từ chối token: không bao giờ được phép dùng cache cũ!
                    purgeAllAuthData();
                    var q = getRedirectQuery();
                    window.location.replace("/Login.html" + (q ? q + "&error=unauthorized" : "?error=unauthorized"));
                    return;
                }
            } catch (netErr) {
                console.warn("TMS Access Guard: Kết nối máy chủ kiểm tra phiên gặp sự cố:", netErr);
            }
        }

        // Nếu máy chủ ngoại tuyến / token demo, đọc lại hồ sơ được lưu
        if (!currentUser) {
            try {
                var rawUser = localStorage.getItem("tms_current_user") || localStorage.getItem("tms_user");
                if (rawUser) currentUser = JSON.parse(rawUser);
            } catch (e) {}
        }

        var isUnauthenticated = !token || !currentUser || !currentUser.id;
        if (isUnauthenticated) {
            purgeAllAuthData();
            window.location.replace("/Login.html" + getRedirectQuery());
            return;
        }

        // 4. Kiểm tra phân quyền vai trò người dùng (RBAC)
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

        var requiredRoles = requiredRole.split(",").map(function(item) { return item.trim().toLowerCase(); });
        var hasPermission = userRoles.some(function(r) {
            if (r === "administrator" || r === "admin") return true;
            return requiredRoles.indexOf(r) !== -1;
        });

        if (!hasPermission) {
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
