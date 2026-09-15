// the api works in paise (integers), the ui shows rupees

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export const formatINR = (paise) => inr.format(Number(paise ?? 0) / 100);

// "12.5" -> 1250. parsed from the string so 19.99 does not turn into 1998.9999
export const toPaise = (rupees) => {
    const match = String(rupees).trim().match(/^(\d+)(?:\.(\d{0,2}))?$/);
    if (!match) return NaN;
    const [, whole, fraction = ""] = match;
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
};
