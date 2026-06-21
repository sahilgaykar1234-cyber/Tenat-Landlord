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

        // const otp = Math.floor(
        //     100000 + Math.random() * 900000
        // );

        const message = await client.messages.create({
            body: `Sahil TEst Message`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });

        // const message = await client.messages.create({

        //     body: `Sahil ne OTP Bheja he ${otp}`,

        //     from: "whatsapp:+14155238886",

        //     to: `whatsapp:${phone}`

        // });

        res.json({
            success: true,
            sid: message.sid,
            // otp
        });

    } catch (error) {

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