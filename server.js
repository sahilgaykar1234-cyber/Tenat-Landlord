import express from "express";
import cors from "cors";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

app.post("/send-otp", async (req, res) => {

    try {

        const { phone } = req.body;

        const verification =
            await client.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verifications
                .create({
                    to: phone,
                    channel: "sms"
                });

        res.json({
            success: true,
            status: verification.status
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

app.post("/verify-otp", async (req, res) => {

    try {

        const { phone, otp } = req.body;

        const verificationCheck =
            await client.verify.v2
                .services(process.env.TWILIO_VERIFY_SERVICE_SID)
                .verificationChecks
                .create({
                    to: phone,
                    code: otp
                });

        res.json({
            success: true,
            status: verificationCheck.status
        });

    }
    catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

app.listen(5000, () => {

    console.log(
        "Twilio Server Running On Port 5000"
    );

});