(function (root, factory) {
    const errorHandler = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = errorHandler;
    }

    root.TmsErrorHandler = errorHandler;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const errors = {
        401: {
            title: "Bạn cần đăng nhập",
            message: "Phiên làm việc không hợp lệ hoặc đã hết hạn. Hãy đăng nhập để tiếp tục.",
            action: "Đăng nhập"
        },
        403: {
            title: "Bạn chưa được cấp quyền",
            message: "Tài khoản hiện tại không có quyền truy cập trang này. Hãy quay lại khu vực phù hợp với vai trò của bạn.",
            action: "Về bảng điều khiển"
        },
        404: {
            title: "Không tìm thấy trang",
            message: "Địa chỉ có thể đã thay đổi hoặc trang không còn tồn tại. Hãy quay lại luồng làm việc.",
            action: "Về bảng điều khiển"
        },
        500: {
            title: "Đã xảy ra lỗi",
            message: "Hệ thống chưa thể hoàn thành yêu cầu. Thông tin nội bộ đã được ẩn để bảo vệ dữ liệu.",
            action: "Về bảng điều khiển"
        },
        503: {
            title: "Dịch vụ tạm thời gián đoạn",
            message: "Không thể kết nối tới dịch vụ lúc này. Hãy thử lại sau hoặc quay về bảng điều khiển.",
            action: "Về bảng điều khiển"
        }
    };
    const validRoles = new Set([
        "visitor",
        "student",
        "instructor",
        "teaching_assistant",
        "admissions",
        "accountant",
        "training_manager",
        "administrator"
    ]);

    function normalizeStatus(status) {
        const value = Number(status);
        return Object.prototype.hasOwnProperty.call(errors, value) ? value : 500;
    }

    function normalizeRole(role) {
        const value = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
        const aliases = {
            admin: "administrator",
            system_administrator: "administrator",
            learner: "student",
            assistant: "teaching_assistant",
            admissions_counselor: "admissions",
            training_management: "training_manager"
        };
        return aliases[value] || value;
    }

    function getErrorDetails(status) {
        return errors[normalizeStatus(status)];
    }

    function getApiFailureMessage(status) {
        const messages = {
            400: "Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại các trường dữ liệu.",
            409: "Thông tin bị trùng hoặc đã thay đổi. Hãy tải lại danh sách rồi thử lại.",
            422: "Dữ liệu chưa đáp ứng yêu cầu. Vui lòng kiểm tra lại trước khi gửi.",
            423: "Tài khoản đang tạm khóa. Hãy chờ trước khi thử lại.",
            429: "Bạn thao tác quá nhanh. Hãy chờ một chút rồi thử lại."
        };
        return messages[Number(status)] || "Không thể hoàn thành yêu cầu. Vui lòng thử lại sau.";
    }

    function getErrorUrl(status) {
        return `./Error.html?code=${normalizeStatus(status)}`;
    }

    function getHomeUrl(role) {
        const normalizedRole = normalizeRole(role);
        if (!validRoles.has(normalizedRole)) {
            return "./Login.html";
        }
        return `./Index.html?role=${encodeURIComponent(normalizedRole)}`;
    }

    function canAccess(requiredRoles, role) {
        const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
        const normalizedRole = normalizeRole(role);
        return Boolean(normalizedRole) && allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === normalizedRole);
    }

    function shouldRedirectForStatus(status) {
        const value = Number(status);
        return value === 401 || value === 403 || value === 404 || value >= 500;
    }

    function redirect(status) {
        if (typeof window !== "undefined" && window.location) {
            window.location.replace(getErrorUrl(status));
        }
    }

    function guard(requiredRoles) {
        const role = window.localStorage.getItem("tms_current_role");
        if (!role) {
            redirect(401);
            return false;
        }
        if (!canAccess(requiredRoles, role)) {
            redirect(403);
            return false;
        }
        return true;
    }

    function handleResponse(response) {
        if (response.ok || !shouldRedirectForStatus(response.status)) {
            return false;
        }
        redirect(response.status >= 500 ? 500 : response.status);
        return true;
    }

    function initializePage() {
        const params = new URLSearchParams(window.location.search);
        const status = normalizeStatus(params.get("code"));
        const details = getErrorDetails(status);
        const role = window.localStorage.getItem("tms_current_role");
        document.getElementById("error-brand-home").href = status === 401 ? "./Login.html" : getHomeUrl(role);
        const homeLink = document.getElementById("error-home");
        const backButton = document.getElementById("error-back");

        document.getElementById("error-code").textContent = String(status);
        document.getElementById("error-title").textContent = details.title;
        document.getElementById("error-message").textContent = details.message;
        homeLink.textContent = details.action;
        homeLink.href = status === 401 ? "./Login.html" : getHomeUrl(role);
        backButton.addEventListener("click", function () {
            if (status === 401) {
                window.location.assign("./Login.html");
                return;
            }
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
            window.location.assign(getHomeUrl(role));
        });
    }

    return Object.freeze({
        canAccess,
        getApiFailureMessage,
        getErrorDetails,
        getErrorUrl,
        getHomeUrl,
        handleResponse,
        initializePage,
        normalizeRole,
        normalizeStatus,
        shouldRedirectForStatus,
        guard
    });
});