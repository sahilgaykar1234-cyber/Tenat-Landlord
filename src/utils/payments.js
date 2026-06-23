const PAYMENT_API = "http://localhost:5000";

async function startCheckout({ createPath, verifyPath, verifyBody, description, deal, user, themeColor }) {
    if (!window.Razorpay) {
        throw new Error("Razorpay checkout script is not loaded");
    }

    const createResponse = await fetch(`${PAYMENT_API}${createPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyBody.create || {})
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
        throw new Error(createData.error || "Could not start payment");
    }

    return new Promise((resolve, reject) => {
        const options = {
            key: createData.keyId,
            amount: createData.amount,
            currency: createData.currency,
            name: "PropManager",
            description,
            order_id: createData.orderId,
            handler: async (response) => {
                try {
                    const verifyResponse = await fetch(`${PAYMENT_API}${verifyPath}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ...verifyBody.verify,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    const verifyData = await verifyResponse.json();

                    if (!verifyResponse.ok) {
                        throw new Error(verifyData.error || "Payment verification failed");
                    }

                    resolve(verifyData);
                } catch (error) {
                    reject(error);
                }
            },
            prefill: {
                name: user?.name || "",
                email: user?.email || "",
                contact: user?.phone || ""
            },
            theme: {
                color: themeColor
            }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on("payment.failed", (response) => {
            reject(
                new Error(response.error?.description || "Payment failed. Please try again.")
            );
        });
        razorpay.open();
    });
}

export async function openRazorpayCheckout({ dealId, deal, user }) {
    const result = await startCheckout({
        createPath: "/api/payments/create-order",
        verifyPath: "/api/payments/verify",
        verifyBody: {
            create: { dealId },
            verify: { dealId }
        },
        description: `Platform fee — ${deal.propertyName}`,
        deal,
        user,
        themeColor: "#3B82F6"
    });
    return result.deal;
}

export async function openRazorpayRentCheckout({ dealId, deal, user, paidForMonth }) {
    const result = await startCheckout({
        createPath: "/api/payments/rent/create-order",
        verifyPath: "/api/payments/rent/verify",
        verifyBody: {
            create: { dealId, paidForMonth },
            verify: { dealId, paidForMonth }
        },
        description: `Monthly rent — ${deal.propertyName}`,
        deal,
        user,
        themeColor: "#059669"
    });
    return result.rentPayment;
}
