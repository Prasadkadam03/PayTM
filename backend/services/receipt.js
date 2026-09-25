// backend/services/receipt.js
// pdf receipt for one transaction. pdfkit's built in fonts have no ₹ glyph, so amounts say INR
const PDFDocument = require("pdfkit");

const NAVY = "#002E6E";
const BLUE = "#00BAF2";
const MUTED = "#64748b";

const inr = (paise) => "INR " + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const personName = (user) => (user ? `${user.firstName} ${user.lastName}` : "PayTM wallet");

const TYPE_LABELS = {
    transfer: "Money transfer",
    request: "Payment request",
    topup: "Wallet top-up"
};

// streams the pdf straight into `out` (the http response)
const writeReceipt = (transaction, out) => {
    const doc = new PDFDocument({ size: "A5", margin: 40, info: { Title: `PayTM receipt ${transaction._id}` } });
    doc.pipe(out);

    doc.font("Helvetica-Bold").fontSize(22).fillColor(NAVY).text("Pay", { continued: true }).fillColor(BLUE).text("TM");
    doc.moveDown(0.3).font("Helvetica").fontSize(10).fillColor(MUTED).text("Payment receipt");

    doc.moveDown(1.5).font("Helvetica-Bold").fontSize(26).fillColor("#0f172a").text(inr(transaction.amount));
    doc.font("Helvetica").fontSize(11).fillColor(transaction.status === "success" ? "#059669" : "#dc2626")
        .text(transaction.status === "success" ? "Successful" : transaction.status);

    const rows = [
        ["Receipt no.", String(transaction._id).toUpperCase()],
        ["Type", TYPE_LABELS[transaction.type] || transaction.type],
        ["From", personName(transaction.from)],
        ["To", personName(transaction.to)],
        ["Date", new Date(transaction.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST"],
    ];
    if (transaction.note) rows.push(["Note", transaction.note]);

    doc.moveDown(1.5);
    for (const [label, value] of rows) {
        const y = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(label, 40, y, { width: 90 });
        doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(value, 140, y, { width: doc.page.width - 180 });
        doc.moveDown(0.8);
    }

    doc.moveDown(2).fontSize(8).fillColor(MUTED)
        .text("This is a computer generated receipt from a demo wallet and needs no signature.", 40, doc.y, { align: "center", width: doc.page.width - 80 });
    doc.end();
};

module.exports = { writeReceipt };
