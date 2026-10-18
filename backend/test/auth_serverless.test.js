const assert = require("assert");
const http = require("http");

process.env.VERCEL = "1";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "1";
process.env.SMTP_SECURE = "false";
process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SECRET_KEY = "test-only";

const auth = require("../authService");
let storedUsers = null;
let storedTokens = null;
let storedRoles = [];

function jsonResponse(value, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

global.fetch = async (input, options = {}) => {
    const url = new URL(input);

    if (url.pathname.startsWith("/storage/v1/bucket/")) {
        return jsonResponse({ id: "tms-database" });
    }

    if (url.pathname.endsWith("/users.json")) {
        if (options.method === "PUT" || options.method === "POST") {
            storedUsers = JSON.parse(options.body);
            return jsonResponse({ Key: "users.json" });
        }
        return storedUsers === null
            ? jsonResponse({ message: "Object not found" }, 404)
            : jsonResponse(storedUsers);
    }

    if (url.pathname.endsWith("/password-reset-tokens.json")) {
        if (options.method === "PUT" || options.method === "POST") {
            storedTokens = JSON.parse(options.body);
            return jsonResponse({ Key: "password-reset-tokens.json" });
        }
        return storedTokens === null
            ? jsonResponse({ message: "Object not found" }, 404)
            : jsonResponse(storedTokens);
    }

    if (url.pathname.endsWith("/user_roles.json")) {
        if (options.method === "PUT" || options.method === "POST") {
            storedRoles = JSON.parse(options.body);
            return jsonResponse({ Key: "user_roles.json" });
        }
        return jsonResponse(storedRoles);
    }

    throw new Error(`Unexpected Supabase request: ${options.method || "GET"} ${url.pathname}`);
};

const { sentEmails, sendActivationEmail } = require("../emailService");
const app = require("../server");
const server = http.createServer(app);

function request(path, method, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : "";
        const options = {
            host: "127.0.0.1",
            port: server.address().port,
            path,
            method,
            headers: payload
                ? {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload)
                }
                : {}
        };
        const req = http.request(options, response => {
            let text = "";
            response.setEncoding("utf8");
            response.on("data", chunk => { text += chunk; });
            response.on("end", () => {
                resolve({
                    status: response.statusCode,
                    body: JSON.parse(text)
                });
            });
        });

        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function run() {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

    try {
        const login = await request("/api/auth/login", "POST", {
            email: "admin@tms.edu.vn",
            password: "admin123"
        });
        assert.strictEqual(login.status, 200);

        const invalidRegistration = await request("/api/auth/register", "POST", {
            name: "Test Student",
            email: "short-password@example.test",
            password: "123"
        });
        assert.strictEqual(invalidRegistration.status, 400);

        const email = `serverless_${Date.now()}@example.test`;
        const registration = await request("/api/auth/register", "POST", {
            name: "Serverless Student",
            email,
            phone: "",
            password: "Student123"
        });
        assert.strictEqual(registration.status, 201);
        assert.strictEqual(registration.body.user.email, email);
        assert.ok(storedUsers.some(user => user.email === email));
        assert.strictEqual(sentEmails.length, 0, "Self registration must not email the password back.");

        const duplicate = await request("/api/auth/register", "POST", {
            name: "Serverless Student",
            email,
            password: "Student123"
        });
        assert.strictEqual(duplicate.status, 409);

        const registeredLogin = await request("/api/auth/login", "POST", {
            email,
            password: "Student123"
        });
        assert.strictEqual(registeredLogin.status, 200);
        assert.ok(registeredLogin.body.roles.some(role => role.id === "student"));
        assert.ok(storedRoles.some(role => role.userId === registration.body.user.id));

        const activationEmail = sendActivationEmail({
            to: "mail-test@example.test",
            name: "Mail Test",
            temporaryPassword: "Temporary123",
            role: "student"
        });
        const delivery = await activationEmail.delivery;
        assert.strictEqual(delivery.status, "FAILED");
        assert.strictEqual(
            Object.prototype.hasOwnProperty.call(delivery, "temporaryPassword"),
            false
        );

        console.log("PASS: Vercel login/register persist users, reject duplicates, and report email delivery status.");
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
