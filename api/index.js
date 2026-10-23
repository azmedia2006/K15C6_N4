let app;
let initError = null;

try {
    app = require("../backend/server.js");
} catch (e) {
    initError = e;
    console.error("[Vercel Startup Error]:", e);
}

module.exports = (req, res) => {
    if (!app && !initError) {
        try {
            app = require("../backend/server.js");
        } catch (e) {
            initError = e;
            console.error("[Vercel Lazy Load Error]:", e);
        }
    }

    if (initError || !app) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({
            success: false,
            code: 500,
            message: "Lỗi khởi tạo hệ thống TMS Serverless",
            error: initError ? (initError.message + "\n" + (initError.stack || "")) : "App failed to load"
        }));
    }

    try {
        if (req.url === "/api/index.js" || req.url.startsWith("/api/index.js?")) {
            const matched = (req.headers && (req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"]));
            if (matched) {
                const queryIndex = req.url.indexOf("?");
                const qs = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
                req.url = matched.includes("?") ? matched : (matched + qs);
            }
        }
        return app(req, res);
    } catch (runtimeErr) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({
            success: false,
            code: 500,
            message: "Lỗi thực thi TMS Serverless",
            error: runtimeErr ? (runtimeErr.message + "\n" + (runtimeErr.stack || "")) : "Unknown runtime error"
        }));
    }
};
