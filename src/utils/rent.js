export function getCurrentRentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatRentMonth(monthKey) {
    const [year, month] = monthKey.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
    });
}

export function hasRentPaidForMonth(rentPayments, dealId, monthKey) {
    return rentPayments.some(
        (payment) =>
            payment.dealId === dealId &&
            payment.paidForMonth === monthKey &&
            payment.status === "Paid"
    );
}

export function getRentPaymentsForDeal(rentPayments, dealId) {
    return rentPayments
        .filter((payment) => payment.dealId === dealId && payment.status === "Paid")
        .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
}
