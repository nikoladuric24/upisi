import {
  formatPhone,
  normalizeCountryCode,
  normalizeEmail,
  normalizePhoneNumber,
  resolvePinForSending,
  savePinForStudent,
  sendSms,
  verifyActivationToken
} from "./pin-utils";

function getPortalLabel(portalType: string): string {
  return portalType === "FACULTY_ADMISSIONS" ? "Postani student" : "e-Srednje";
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method Not Allowed", allowed: ["POST"] });
  }

  const activationToken = String(req.body?.activationToken || "");
  const activation = verifyActivationToken(activationToken);
  if (!activation?.email || !activation?.portalType) {
    return res.status(401).json({
      success: false,
      error: "Aktivacijski zahtjev je istekao. Ponovno unesite korisnicko ime i lozinku."
    });
  }

  const email = normalizeEmail(activation.email);
  const portalType = activation.portalType;
  const phoneCountry = normalizeCountryCode(req.body?.countryCode || req.body?.phoneCountry || "+385");
  const phoneNumber = normalizePhoneNumber(req.body?.phoneNumber || "");

  if (!phoneNumber || phoneNumber.length < 6) {
    return res.status(400).json({ success: false, error: "Unesite ispravan broj mobitela." });
  }

  try {
    const pin = await resolvePinForSending(email, portalType);
    await savePinForStudent({
      email,
      portalType,
      pin,
      phoneCountry,
      phoneNumber
    });

    const to = formatPhone(phoneCountry, phoneNumber);
    const portalLabel = getPortalLabel(portalType);
    const message = `${portalLabel}: vas PIN za prijavu je ${pin}. PIN je trajan i cuvajte ga za buduce prijave.`;
    const sms = await sendSms({ to, message });

    console.log("[ADMISSIONS_PIN] PIN sent", {
      email,
      portalType,
      to,
      provider: sms.provider,
      mocked: sms.mocked,
      sid: sms.sid
    });

    return res.status(200).json({
      success: true,
      message: "PIN je poslan SMS porukom. Vratite se na prijavu i unesite korisnicko ime, lozinku i PIN.",
      smsProvider: sms.provider,
      mocked: Boolean(sms.mocked)
    });
  } catch (error: any) {
    console.error("[ADMISSIONS_PIN] request failed", {
      email,
      portalType,
      message: error?.message,
      stack: error?.stack
    });
    return res.status(500).json({
      success: false,
      error: error?.message || "Slanje PIN-a nije uspjelo."
    });
  }
}
