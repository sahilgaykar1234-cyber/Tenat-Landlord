function getCurrentRentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isDealActive(deal) {
    return deal && deal.occupancyStatus !== "Left";
}

function hasRentPaidForMonth(rentPayments, dealId, month) {
    return rentPayments.some(
        (payment) =>
            payment.dealId === dealId &&
            payment.paidForMonth === month &&
            payment.status === "Paid"
    );
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}`);
    }
    return response.json();
}

export async function verifyAdminUser(jsonServerUrl, userId) {
    if (!userId) return false;

    try {
        const response = await fetch(`${jsonServerUrl}/users/${userId}`);
        if (!response.ok) return false;
        const user = await response.json();
        return user.role === "Admin";
    } catch {
        return false;
    }
}

export async function buildAdminContext(jsonServerUrl) {
    const [users, properties, inquiries, deals, rentPayments] = await Promise.all([
        fetchJson(`${jsonServerUrl}/users`),
        fetchJson(`${jsonServerUrl}/properties`),
        fetchJson(`${jsonServerUrl}/inquiries`),
        fetchJson(`${jsonServerUrl}/deals`),
        fetchJson(`${jsonServerUrl}/rentPayments`)
    ]);

    const rentMonth = getCurrentRentMonth();
    const listedProperties = properties.filter((property) => property.propertyName);

    const landlords = users
        .filter((user) => user.role === "Landlord")
        .map((landlord) => {
            const landlordProperties = listedProperties.filter(
                (property) => property.landlordId === landlord.id
            );
            const totalRent = landlordProperties.reduce(
                (sum, property) => sum + Number(property.rent || 0),
                0
            );

            return {
                id: landlord.id,
                name: landlord.name,
                email: landlord.email,
                phone: landlord.phone,
                propertyCount: landlordProperties.length,
                totalMonthlyRent: totalRent,
                inquiryCount: inquiries.filter(
                    (inquiry) => inquiry.landlordId === landlord.id
                ).length
            };
        });

    const tenants = users
        .filter((user) => user.role === "Tenant")
        .map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone
        }));

    const closableInquiries = inquiries
        .filter(
            (inquiry) =>
                !deals.some((deal) => deal.inquiryId === inquiry.id) &&
                ["Meeting Requested", "Pending"].includes(inquiry.status)
        )
        .map((inquiry) => {
            const property = listedProperties.find(
                (item) => item.id === inquiry.propertyId
            );
            const landlord = users.find((user) => user.id === inquiry.landlordId);

            return {
                id: inquiry.id,
                propertyName: inquiry.propertyName,
                tenantName: inquiry.tenantName,
                landlordName: landlord?.name || inquiry.landlordName || "Landlord",
                status: inquiry.status,
                monthlyRent: Number(property?.rent || 0)
            };
        });

    const occupancies = deals.map((deal) => {
        const active = isDealActive(deal);
        const platformDue =
            deal.paymentStatus !== "Paid" ? Number(deal.commissionAmount || 0) : 0;
        const rentPaid = hasRentPaidForMonth(rentPayments, deal.id, rentMonth);
        const rentDue = active && !rentPaid ? Number(deal.monthlyRent || 0) : 0;

        return {
            dealId: deal.id,
            tenantName: deal.tenantName,
            landlordName: deal.landlordName,
            propertyName: deal.propertyName,
            monthlyRent: Number(deal.monthlyRent || 0),
            occupancyStatus: active ? "Living" : "Left",
            platformFeeStatus: deal.paymentStatus || "Pending",
            platformDue,
            rentMonth,
            rentStatus: active ? (rentPaid ? "Paid" : "Due") : "N/A",
            rentDue,
            totalDue: platformDue + rentDue
        };
    });

    const revenue = deals
        .filter((deal) => deal.paymentStatus === "Paid")
        .reduce((sum, deal) => sum + Number(deal.commissionAmount || 0), 0);

    const pendingCommission = deals
        .filter((deal) => deal.paymentStatus !== "Paid")
        .reduce((sum, deal) => sum + Number(deal.commissionAmount || 0), 0);

    const activeTenancies = occupancies.filter((row) => row.occupancyStatus === "Living");
    const totalRentDue = occupancies.reduce((sum, row) => sum + row.rentDue, 0);
    const totalPaymentDue = occupancies.reduce((sum, row) => sum + row.totalDue, 0);

    const propertyList = listedProperties.map((property) => {
        const landlord = users.find((user) => user.id === property.landlordId);
        const activeDeal = deals.find(
            (deal) => deal.propertyId === property.id && isDealActive(deal)
        );

        return {
            id: property.id,
            name: property.propertyName,
            address: property.address,
            type: property.propertyType,
            monthlyRent: Number(property.rent || 0),
            landlordName: landlord?.name || "Landlord",
            occupied: Boolean(activeDeal),
            currentTenant: activeDeal?.tenantName || null
        };
    });

    const inquiryList = inquiries.map((inquiry) => ({
        id: inquiry.id,
        propertyName: inquiry.propertyName,
        tenantName: inquiry.tenantName,
        status: inquiry.status,
        landlordId: inquiry.landlordId
    }));

    return {
        generatedAt: new Date().toISOString(),
        currentRentMonth: rentMonth,
        stats: {
            landlordCount: landlords.length,
            tenantCount: tenants.length,
            propertyCount: listedProperties.length,
            inquiryCount: inquiries.length,
            dealCount: deals.length,
            activeTenancyCount: activeTenancies.length,
            adminRevenuePaid: revenue,
            platformFeePending: pendingCommission,
            totalRentDueThisMonth: totalRentDue,
            totalPaymentDue
        },
        landlords,
        tenants,
        properties: propertyList,
        inquiries: inquiryList,
        closableInquiries,
        occupancies,
        recentRentPayments: rentPayments
            .slice(-10)
            .map((payment) => ({
                tenantName: payment.tenantName,
                propertyName: payment.propertyName,
                amount: payment.amount,
                paidForMonth: payment.paidForMonth,
                paidAt: payment.paidAt
            }))
    };
}

function buildSystemPrompt(context) {
    return `You are PropManager Admin AI — a friendly, general-purpose assistant inside the PropManager admin dashboard.

You can answer ANY question the admin asks:
- General knowledge (programming, PHP, JavaScript, science, definitions, how-to, etc.)
- Casual chat (hello, thanks, jokes, advice)
- PropManager rental platform questions (tenants, landlords, properties, rent, deals, payments)

Rules for platform / rental questions:
- Use ONLY the platform data below for facts about tenants, landlords, properties, deals, and payments.
- Never invent platform names, amounts, tenants, or properties.
- Use Indian Rupees (₹) for money.
- Platform fee = 50% of monthly rent (tenant pays admin). Monthly rent goes to landlord.

Rules for general questions:
- Answer fully and helpfully using your general knowledge.
- Do NOT refuse questions just because they are unrelated to PropManager.
- Do NOT say you only know PropManager data when asked about general topics.

If a question mixes both (e.g. "explain PHP arrays" or "how does rent work here"), answer both parts clearly.

PLATFORM DATA (JSON):
${JSON.stringify(context, null, 2)}`;
}

function formatHistoryForGemini(history = []) {
    return history
        .filter((message) => message?.content?.trim())
        .slice(-8)
        .map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }]
        }));
}

async function callGemini({ apiKey, systemPrompt, question, history }) {
    const contents = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I will answer using only the PropManager platform data you provide." }] },
        ...formatHistoryForGemini(history),
        { role: "user", parts: [{ text: question }] }
    ];

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 1024
                }
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        const message = data?.error?.message || "Gemini API request failed";
        throw new Error(formatAiError(message, data?.error?.code));
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) {
        throw new Error("No response from AI");
    }

    return answer.trim();
}

function formatAiError(message = "", code = "") {
    const text = `${message} ${code}`.toLowerCase();

    if (text.includes("insufficient_quota") || text.includes("billing")) {
        return "AI credits exhausted. Use the built-in assistant or add a free GROQ_API_KEY from console.groq.com";
    }

    if (text.includes("invalid api key") || text.includes("incorrect api key") || text.includes("401")) {
        return "Invalid API key. Check GROQ_API_KEY in .env and restart the server.";
    }

    if (text.includes("quota") || text.includes("rate limit") || text.includes("429")) {
        return "AI rate limit reached. Wait a minute, or use the built-in assistant (no key needed).";
    }

    if (text.includes("not configured")) {
        return message;
    }

    if (message.length > 180) {
        return "Could not get AI response. Built-in assistant still works without any API key.";
    }

    return message;
}

function formatCurrency(amount) {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function extractKeywords(question) {
    const stopWords = new Set([
        "the", "a", "an", "is", "are", "was", "were", "what", "which", "who", "how",
        "many", "much", "does", "do", "did", "can", "could", "would", "should", "tell",
        "me", "about", "give", "show", "list", "all", "any", "there", "this", "that",
        "for", "and", "or", "at", "in", "on", "of", "to", "from", "with", "have", "has",
        "kya", "kaun", "kitne", "kitna", "batao", "mujhe", "mera", "mere"
    ]);

    return question
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((word) => word.length > 2 && !stopWords.has(word));
}

function scoreRecord(record, keywords) {
    const text = JSON.stringify(record).toLowerCase();
    return keywords.reduce((score, word) => (text.includes(word) ? score + 1 : score), 0);
}

function isGreeting(question) {
    const q = question.toLowerCase().trim();
    return /^(hi|hello|hey|hola|namaste|good morning|good afternoon|good evening|how are you)\b/.test(q);
}

function searchContextAndAnswer(question, context) {
    const keywords = extractKeywords(question);
    const { stats, occupancies, closableInquiries, landlords, tenants, properties, inquiries, recentRentPayments, currentRentMonth } = context;

    if (isGreeting(question)) {
        return `Hello! I'm your PropManager admin assistant. Ask me anything — platform data, coding, general questions, whatever you need.

Quick snapshot: ${stats.activeTenancyCount} active tenancies, ${formatCurrency(stats.totalPaymentDue)} payment due, ${formatCurrency(stats.adminRevenuePaid)} admin revenue.`;
    }

    if (keywords.length === 0) {
        return `Platform overview (${currentRentMonth}):
• ${stats.landlordCount} landlords, ${stats.tenantCount} tenants, ${stats.propertyCount} properties
• ${stats.activeTenancyCount} active tenancies
• Admin revenue: ${formatCurrency(stats.adminRevenuePaid)} | Due: ${formatCurrency(stats.totalPaymentDue)}
• ${closableInquiries.length} inquiries ready to close

For general questions (PHP, coding, etc.), make sure GROQ_API_KEY is set in .env. For platform questions, mention a tenant, property, or landlord name.`;
    }

    const findings = [];

    for (const row of occupancies) {
        const score = scoreRecord(row, keywords);
        if (score > 0) {
            findings.push({
                score,
                text: `Deal: ${row.tenantName} at ${row.propertyName} (${row.occupancyStatus}). Rent ${formatCurrency(row.monthlyRent)}/mo. Platform fee: ${row.platformFeeStatus}. Rent (${currentRentMonth}): ${row.rentStatus}. Total due: ${formatCurrency(row.totalDue)}.`
            });
        }
    }

    for (const property of properties) {
        const score = scoreRecord(property, keywords);
        if (score > 0) {
            findings.push({
                score,
                text: `Property: ${property.name} at ${property.address || "—"} (${property.type || "Property"}). Rent ${formatCurrency(property.monthlyRent)}/mo. Landlord: ${property.landlordName}. ${property.occupied ? `Occupied by ${property.currentTenant}` : "Available"}.`
            });
        }
    }

    for (const landlord of landlords) {
        const score = scoreRecord(landlord, keywords);
        if (score > 0) {
            findings.push({
                score,
                text: `Landlord: ${landlord.name} (${landlord.email || "no email"}). ${landlord.propertyCount} properties, total rent ${formatCurrency(landlord.totalMonthlyRent)}/mo, ${landlord.inquiryCount} inquiries.`
            });
        }
    }

    for (const tenant of tenants) {
        const score = scoreRecord(tenant, keywords);
        if (score > 0) {
            const tenantDeals = occupancies.filter((row) =>
                row.tenantName.toLowerCase().includes(tenant.name.toLowerCase())
            );
            findings.push({
                score,
                text: `Tenant: ${tenant.name} (${tenant.phone || "—"}, ${tenant.email || "—"}). ${tenantDeals.length ? `Linked to: ${tenantDeals.map((d) => d.propertyName).join(", ")}` : "No closed deals yet."}`
            });
        }
    }

    for (const inquiry of inquiries) {
        const score = scoreRecord(inquiry, keywords);
        if (score > 0) {
            findings.push({
                score,
                text: `Inquiry: ${inquiry.tenantName} → ${inquiry.propertyName}. Status: ${inquiry.status}.`
            });
        }
    }

    for (const payment of recentRentPayments) {
        const score = scoreRecord(payment, keywords);
        if (score > 0) {
            findings.push({
                score,
                text: `Rent payment: ${payment.tenantName} paid ${formatCurrency(payment.amount)} for ${payment.paidForMonth} (${payment.propertyName}).`
            });
        }
    }

    if (findings.length === 0) {
        return `I couldn't find "${question}" in the platform data. Here's a quick snapshot:
• Active tenancies: ${stats.activeTenancyCount}
• Payment due: ${formatCurrency(stats.totalPaymentDue)}
• Admin revenue: ${formatCurrency(stats.adminRevenuePaid)}
• Properties: ${stats.propertyCount}

Try asking with a tenant name, property name, or landlord name.`;
    }

    findings.sort((a, b) => b.score - a.score);
    const top = findings.slice(0, 5);

    return `Here's what I found for your question:\n\n${top.map((item) => `• ${item.text}`).join("\n")}`;
}

function answerWithRules(question, context) {
    const q = question.toLowerCase();
    const { stats, occupancies, closableInquiries, landlords, currentRentMonth } = context;

    const dueRows = occupancies.filter((row) => row.totalDue > 0);
    const livingRows = occupancies.filter((row) => row.occupancyStatus === "Living");

    if (
        q.includes("active") &&
        (q.includes("tenanc") || q.includes("tenant") || q.includes("living"))
    ) {
        if (livingRows.length === 0) {
            return "There are 0 active tenancies right now. No tenant is currently living on a closed deal.";
        }

        const list = livingRows
            .map(
                (row) =>
                    `• ${row.tenantName} at ${row.propertyName} (landlord: ${row.landlordName})`
            )
            .join("\n");

        return `There are ${stats.activeTenancyCount} active tenancies:\n${list}`;
    }

    if (
        (q.includes("due") || q.includes("pending") || q.includes("owe")) &&
        (q.includes("payment") || q.includes("rent") || q.includes("tenant") || q.includes("platform"))
    ) {
        if (dueRows.length === 0) {
            return `No pending payments right now for ${currentRentMonth}. All active tenants are up to date on platform fee and rent.`;
        }

        const list = dueRows
            .map((row) => {
                const parts = [];
                if (row.platformDue > 0) parts.push(`platform fee ${formatCurrency(row.platformDue)}`);
                if (row.rentDue > 0) parts.push(`rent ${formatCurrency(row.rentDue)}`);
                return `• ${row.tenantName} — ${row.propertyName}: ${parts.join(", ")} (total ${formatCurrency(row.totalDue)})`;
            })
            .join("\n");

        return `Tenants with payment due:\n${list}\n\nTotal due across platform: ${formatCurrency(stats.totalPaymentDue)}`;
    }

    if (q.includes("revenue") || q.includes("admin earn") || (q.includes("total") && q.includes("paid") && q.includes("platform"))) {
        return `Admin revenue (paid platform fees): ${formatCurrency(stats.adminRevenuePaid)}.\nPending platform fees: ${formatCurrency(stats.platformFeePending)}.\nTotal payment due (platform + rent this month): ${formatCurrency(stats.totalPaymentDue)}.`;
    }

    if (q.includes("close") && (q.includes("inquir") || q.includes("deal"))) {
        if (closableInquiries.length === 0) {
            return "No inquiries are ready to close as deals right now.";
        }

        const list = closableInquiries
            .map(
                (item) =>
                    `• ${item.propertyName} — tenant ${item.tenantName}, rent ${formatCurrency(item.monthlyRent)}, status: ${item.status}`
            )
            .join("\n");

        return `${closableInquiries.length} inquiries ready to close:\n${list}`;
    }

    if (q.includes("living") || q.includes("who is") || q.includes("who lives") || q.includes("staying")) {
        const propertyHint = question.replace(/who is living at|who lives at|staying at/gi, "").trim();
        const matches = livingRows.filter((row) => {
            if (!propertyHint || propertyHint.length < 3) return true;
            return row.propertyName.toLowerCase().includes(propertyHint.toLowerCase());
        });

        if (matches.length === 0) {
            return propertyHint
                ? `No active tenant found at "${propertyHint}".`
                : "No active tenants are living on any property right now.";
        }

        return matches
            .map(
                (row) =>
                    `• ${row.tenantName} lives at ${row.propertyName} (landlord: ${row.landlordName}, rent ${formatCurrency(row.monthlyRent)}/mo)`
            )
            .join("\n");
    }

    if (q.includes("landlord")) {
        if (landlords.length === 0) return "No landlords registered yet.";
        const list = landlords
            .map(
                (landlord) =>
                    `• ${landlord.name}: ${landlord.propertyCount} properties, ${landlord.inquiryCount} inquiries`
            )
            .join("\n");
        return `${stats.landlordCount} landlords:\n${list}`;
    }

    if (q.includes("summary") || q.includes("overview") || q.includes("status")) {
        return `Platform snapshot:
• Landlords: ${stats.landlordCount}
• Tenants: ${stats.tenantCount}
• Properties: ${stats.propertyCount}
• Active tenancies: ${stats.activeTenancyCount}
• Admin revenue: ${formatCurrency(stats.adminRevenuePaid)}
• Payment due: ${formatCurrency(stats.totalPaymentDue)}
• Inquiries ready to close: ${closableInquiries.length}`;
    }

    return searchContextAndAnswer(question, context);
}

async function callGroq({ apiKey, systemPrompt, question, history }) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
            messages: buildChatMessages(systemPrompt, question, history),
            temperature: 0.2,
            max_tokens: 1024
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data?.error?.message || "Groq API request failed";
        throw new Error(formatAiError(message, data?.error?.code));
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) {
        throw new Error("No response from AI");
    }

    return answer.trim();
}

function buildChatMessages(systemPrompt, question, history) {
    return [
        { role: "system", content: systemPrompt },
        ...history
            .filter((message) => message?.content?.trim())
            .slice(-8)
            .map((message) => ({
                role: message.role === "assistant" ? "assistant" : "user",
                content: message.content
            })),
        { role: "user", content: question }
    ];
}

async function callOllama({ systemPrompt, question, history }) {
    const ollamaUrl = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
    const model = process.env.OLLAMA_MODEL || "llama3.2";

    const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages: buildChatMessages(systemPrompt, question, history),
            stream: false,
            options: { temperature: 0.2 }
        }),
        signal: AbortSignal.timeout(60000)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error || "Ollama request failed");
    }

    const answer = data?.message?.content;
    if (!answer) {
        throw new Error("No response from Ollama");
    }

    return answer.trim();
}

async function tryLlmAnswer({ systemPrompt, question, history, groqKey }) {
    if (groqKey) {
        try {
            const answer = await callGroq({
                apiKey: groqKey,
                systemPrompt,
                question,
                history
            });
            return { answer, provider: "groq" };
        } catch (error) {
            console.error("Groq failed:", error.message);
        }
    }

    try {
        const answer = await callOllama({ systemPrompt, question, history });
        return { answer, provider: "ollama" };
    } catch (error) {
        console.error("Ollama not available:", error.message);
    }

    return null;
}

async function callOpenAI({ apiKey, systemPrompt, question, history }) {
    const messages = [
        { role: "system", content: systemPrompt },
        ...history
            .filter((message) => message?.content?.trim())
            .slice(-8)
            .map((message) => ({
                role: message.role === "assistant" ? "assistant" : "user",
                content: message.content
            })),
        { role: "user", content: question }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.2,
            max_tokens: 1024
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const message = data?.error?.message || "OpenAI API request failed";
        throw new Error(formatAiError(message, data?.error?.code));
    }

    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) {
        throw new Error("No response from AI");
    }

    return answer.trim();
}

export async function askAdminAi({ question, history = [], jsonServerUrl }) {
    const trimmedQuestion = String(question || "").trim();
    if (!trimmedQuestion) {
        throw new Error("Question is required");
    }

    if (trimmedQuestion.length > 1000) {
        throw new Error("Question is too long (max 1000 characters)");
    }

    const context = await buildAdminContext(jsonServerUrl);
    const systemPrompt = buildSystemPrompt(context);

    const groqKey = process.env.GROQ_API_KEY?.trim();
    const preferredProvider = (process.env.AI_PROVIDER || "auto").toLowerCase();

    if (preferredProvider !== "rules") {
        const llmResult = await tryLlmAnswer({
            systemPrompt,
            question: trimmedQuestion,
            history,
            groqKey
        });

        if (llmResult) {
            return llmResult;
        }
    }

    return {
        answer: answerWithRules(trimmedQuestion, context),
        provider: "rules"
    };
}
