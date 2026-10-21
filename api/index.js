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
        if (req.headers && req.headers["x-matched-path"] && req.url === "/api/index.js") {
            req.url = req.headers["x-matched-path"];
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
