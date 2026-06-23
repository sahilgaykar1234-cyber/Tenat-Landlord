import express from "express";
import cors from "cors";
import twilio from "twilio";
import dotenv from "dotenv";
import crypto from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import Razorpay from "razorpay";
import { askAdminAi, verifyAdminUser } from "./server/adminAi.js";

dotenv.config();

const app = express();
const JSON_SERVER = process.env.JSON_SERVER_URL || "http://localhost:3001";

app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function fetchDeal(dealId) {
    const response = await fetch(`${JSON_SERVER}/deals/${dealId}`);
    if (!response.ok) {
        throw new Error("Deal not found");
    }
    return response.json();
}

async function patchDeal(dealId, data) {
    const response = await fetch(`${JSON_SERVER}/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error("Failed to update deal");
    }
    return response.json();
}

function getCurrentRentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isDealActive(deal) {
    return deal && deal.occupancyStatus !== "Left";
}

async function fetchRentPayments(query = "") {
    const response = await fetch(`${JSON_SERVER}/rentPayments${query}`);
    if (!response.ok) {
        throw new Error("Failed to fetch rent payments");
    }
    return response.json();
}

async function createRentPayment(data) {
    const response = await fetch(`${JSON_SERVER}/rentPayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        throw new Error("Failed to save rent payment");
    }
    return response.json();
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    return expectedSignature === signature;
}

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

function normalizePhone(phone) {
    if (!phone) return "";

    let cleaned = String(phone).replace(/[\s-]/g, "");

    if (cleaned.startsWith("+")) {
        return cleaned;
    }

    if (cleaned.startsWith("91") && cleaned.length === 12) {
        return `+${cleaned}`;
    }

    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }

    return `+${cleaned}`;
}

app.post("/send-otp", async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);

        if (!phone || phone.length < 12) {
            return res.status(400).json({
                success: false,
                error: "Invalid phone number. Use +91XXXXXXXXXX"
            });
        }

        const verification = await client.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verifications.create({
                to: phone,
                channel: "sms"
            });

        console.log(`SMS OTP sent to ${phone}`);

        res.json({
            success: true,
            status: verification.status,
            phone
        });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({
            success: false,
            error: error.message
        });
    }
});

app.post("/verify-otp", async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phone);
        const { otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                error: "Phone and OTP are required"
            });
        }

        const verificationCheck = await client.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verificationChecks.create({
                to: phone,
                code: otp
            });

        res.json({
            success: true,
            status: verificationCheck.status
        });
    } catch (error) {
        console.log(error);
        res.status(error.status || 500).json({
            success: false,
            error: error.message
        });
    }
});

app.post("/api/payments/create-order", async (req, res) => {
    try {
        const { dealId } = req.body;

        if (!dealId) {
            return res.status(400).json({ success: false, error: "dealId is required" });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                error: "Razorpay keys are not configured in .env"
            });
        }

        const deal = await fetchDeal(dealId);

        if (deal.paymentStatus === "Paid") {
            return res.status(400).json({ success: false, error: "Commission already paid" });
        }

        const amountPaise = Math.round(Number(deal.commissionAmount) * 100);

        if (!Number.isFinite(amountPaise) || amountPaise < 100) {
            return res.status(400).json({
                success: false,
                error: "Invalid commission amount"
            });
        }

        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `deal_${dealId}`,
            notes: {
                dealId,
                propertyName: deal.propertyName || ""
            }
        });

        await patchDeal(dealId, {
            razorpayOrderId: order.id,
            paymentStatus: "Pending"
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("create-order error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to create payment order"
        });
    }
});

app.post("/api/payments/verify", async (req, res) => {
    try {
        const {
            dealId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!dealId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: "Missing payment verification fields"
            });
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: "Payment verification failed"
            });
        }

        const updatedDeal = await patchDeal(dealId, {
            paymentStatus: "Paid",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            paidAt: new Date().toISOString()
        });

        io.emit("deals:changed");

        res.json({
            success: true,
            deal: updatedDeal
        });
    } catch (error) {
        console.error("verify payment error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to verify payment"
        });
    }
});

app.post("/api/payments/rent/create-order", async (req, res) => {
    try {
        const { dealId, paidForMonth = getCurrentRentMonth() } = req.body;

        if (!dealId) {
            return res.status(400).json({ success: false, error: "dealId is required" });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                error: "Razorpay keys are not configured in .env"
            });
        }

        const deal = await fetchDeal(dealId);

        if (!isDealActive(deal)) {
            return res.status(400).json({
                success: false,
                error: "This tenancy is not active. Rent cannot be paid."
            });
        }

        const existingPayments = await fetchRentPayments(
            `?dealId=${dealId}&paidForMonth=${paidForMonth}&status=Paid`
        );

        if (existingPayments.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Rent for ${paidForMonth} is already paid`
            });
        }

        const amountPaise = Math.round(Number(deal.monthlyRent) * 100);

        if (!Number.isFinite(amountPaise) || amountPaise < 100) {
            return res.status(400).json({
                success: false,
                error: "Invalid rent amount"
            });
        }

        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: `rent_${dealId}_${paidForMonth.replace("-", "")}`,
            notes: {
                dealId,
                paidForMonth,
                propertyName: deal.propertyName || "",
                paymentType: "Rent"
            }
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            paidForMonth
        });
    } catch (error) {
        console.error("rent create-order error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to create rent payment order"
        });
    }
});

app.post("/api/payments/rent/verify", async (req, res) => {
    try {
        const {
            dealId,
            paidForMonth = getCurrentRentMonth(),
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!dealId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: "Missing rent payment verification fields"
            });
        }

        if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
            return res.status(400).json({
                success: false,
                error: "Payment verification failed"
            });
        }

        const deal = await fetchDeal(dealId);

        if (!isDealActive(deal)) {
            return res.status(400).json({
                success: false,
                error: "This tenancy is not active"
            });
        }

        const existingPayments = await fetchRentPayments(
            `?dealId=${dealId}&paidForMonth=${paidForMonth}&status=Paid`
        );

        if (existingPayments.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Rent for ${paidForMonth} is already paid`
            });
        }

        const rentPayment = await createRentPayment({
            dealId: deal.id,
            inquiryId: deal.inquiryId,
            propertyId: deal.propertyId,
            propertyName: deal.propertyName,
            landlordId: deal.landlordId,
            landlordName: deal.landlordName,
            tenantId: deal.tenantId,
            tenantName: deal.tenantName,
            amount: Number(deal.monthlyRent),
            paidForMonth,
            status: "Paid",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });

        io.emit("rentPayments:changed");

        res.json({
            success: true,
            rentPayment
        });
    } catch (error) {
        console.error("rent verify error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to verify rent payment"
        });
    }
});

app.post("/api/admin/ai/chat", async (req, res) => {
    try {
        const { userId, question, history = [] } = req.body;

        const isAdmin = await verifyAdminUser(JSON_SERVER, userId);
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: "Only admins can use the AI assistant"
            });
        }

        const { answer, provider } = await askAdminAi({
            question,
            history,
            jsonServerUrl: JSON_SERVER
        });

        res.json({
            success: true,
            answer,
            provider
        });
    } catch (error) {
        console.error("admin ai chat error:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to get AI response"
        });
    }
});

const PORT = 5000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("properties:changed", () => {
        io.emit("properties:changed");
    });

    socket.on("inquiries:changed", () => {
        io.emit("inquiries:changed");
    });

    socket.on("deals:changed", () => {
        io.emit("deals:changed");
    });

    socket.on("rentPayments:changed", () => {
        io.emit("rentPayments:changed");
    });

    socket.on("user:deleted", (userId) => {
        io.emit("user:deleted", userId);
    });

    socket.on("users:changed", () => {
        io.emit("users:changed");
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server Running On Port ${PORT}`);
    console.log("Socket.io ready for real-time updates");
    console.log("OTP delivery: SMS (Twilio Verify)");
});

httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`\nPort ${PORT} is already in use.`);
        console.error(`Run: kill -9 $(lsof -t -i:${PORT})\n`);
    } else {
        console.error("Server failed to start:", err.message);
    }
    process.exit(1);
});
