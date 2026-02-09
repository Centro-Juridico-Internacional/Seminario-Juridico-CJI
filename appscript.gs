/**
 * PayU WebCheckout - Confirmation URL (POST) + Response URL (GET)
 * - Guarda en Google Sheets (SIN duplicar) por unique_key (reference_pol/transaction_id/reference_sale)
 * - Envía email SOLO cuando está APROBADO (state_pol=4) y la firma es válida
 * - Captura nombre desde extra3
 * - Captura teléfono/empresa/vendedor/ubicación desde:
 *      1) extra4/extra5 (si llegan)
 *      2) extra2 "u=...|v=...|tel=...|emp=..." (fallback garantizado)
 * - Vendedor en doPost: solo por extra2 (NO querystring)
 *
 * EXTRA: Endpoint seguro para firmar WebCheckout:
 *   GET .../exec?signcheckout=1&merchantId=...&referenceCode=...&amount=...&currency=COP
 *   -> { "signature": "..." }
 */

const CONFIG = {
  ADMIN_EMAIL:
    "desarrollo@centrojuridicointernacional.com,coordinacion2@centrojuridicointernacional.com",
  SHEET_ID: "1ElkQNY9smNg1GJ-51qK0gfFB5FnjyM1UjYffWWIlkPg",
  SHEET_NAME: "PagosPayU",
  API_KEY_PROP: "PAYU_API_KEY",
};

/** ===================== HELPERS ===================== */

function getApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty(
    CONFIG.API_KEY_PROP,
  );
  if (!key) throw new Error(`Falta Script Property ${CONFIG.API_KEY_PROP}`);
  return key.trim();
}

function md5Hex_(str) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    str,
    Utilities.Charset.UTF_8,
  );
  return raw
    .map((b) => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))
    .join("");
}

/**
 * new_value para CONFIRMATION (POST) según PayU:
 * - Si el segundo decimal es 0 => 1 decimal (150.00 -> 150.0)
 * - Si el segundo decimal no es 0 => 2 decimales (150.25 -> 150.25)
 */
function formatNewValueConfirmation_(valueStr) {
  const n = Number(valueStr);
  if (!isFinite(n)) return String(valueStr);

  const fixed2 = n.toFixed(2);
  const parts = fixed2.split(".");
  const dec2 = parts[1] || "00";

  if (dec2.length >= 2 && dec2[1] === "0")
    return Number(parts[0] + "." + dec2[0]).toFixed(1);
  return fixed2;
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);
  ensureHeader_(sh);
  return sh;
}

function ensureHeader_(sh) {
  const header = [
    "timestamp",
    "unique_key",
    "reference_sale",
    "state_pol",
    "response_message_pol",
    "value",
    "currency",
    "email_buyer",
    "phone",
    "extra1",
    "extra2",
    "extra3",
    "extra4",
    "extra5",
    "transaction_id",
    "reference_pol",
    "sign_ok",
    "expected_sign",
    "received_sign",
    "nombre",
    "telefono",
    "empresa",
    "tipo",
    "ubicacion",
    "vendedor",
    "correo_final",
  ];

  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
    return;
  }

  const a1 = String(sh.getRange(1, 1).getValue() || "")
    .trim()
    .toLowerCase();
  if (a1 !== "timestamp") {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
}

function isValidEmail_(email) {
  const s = (email || "").toString().trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** ====== ANTI-DUPLICADOS EN SHEET (upsert por unique_key en col B) ====== */
function upsertByUniqueKey_(sh, uniqueKey, valuesArray) {
  const lastRow = sh.getLastRow();

  if (lastRow < 2) {
    sh.appendRow(valuesArray);
    return { action: "insert", row: 2 };
  }

  const keyRange = sh.getRange(2, 2, lastRow - 1, 1).getValues(); // col B
  for (let i = 0; i < keyRange.length; i++) {
    if (String(keyRange[i][0]) === String(uniqueKey)) {
      const rowNumber = i + 2;
      sh.getRange(rowNumber, 1, 1, valuesArray.length).setValues([valuesArray]);
      return { action: "update", row: rowNumber };
    }
  }

  sh.appendRow(valuesArray);
  return { action: "insert", row: lastRow + 1 };
}

/** ====== Evitar correos duplicados (por reference_sale) ====== */
function alreadyProcessedApproved_(referenceSale) {
  return (
    PropertiesService.getScriptProperties().getProperty(
      "APPROVED_" + referenceSale,
    ) === "1"
  );
}
function markProcessedApproved_(referenceSale) {
  PropertiesService.getScriptProperties().setProperty(
    "APPROVED_" + referenceSale,
    "1",
  );
}

/**
 * ✅ PARSE extra2 PACK:
 * extra2 = "u=bogota|v=15|tel=3001234567|emp=Mi Empresa SAS"
 */
function parseExtra2Pack_(extra2raw) {
  const s = (extra2raw || "").toString().trim();
  const out = { ubicacion: "", vendedor: "", telefono: "", empresa: "" };
  if (!s) return out;

  const parts = s
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) {
      if (!out.ubicacion) out.ubicacion = part;
      continue;
    }
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();

    if (k === "u" || k === "ubi" || k === "ubicacion") out.ubicacion = v;
    else if (k === "v" || k === "vend" || k === "vendedor") out.vendedor = v;
    else if (k === "tel" || k === "telefono" || k === "phone") out.telefono = v;
    else if (k === "emp" || k === "empresa") out.empresa = v;
  }

  if (
    !out.ubicacion &&
    parts.length > 0 &&
    parts[0] &&
    parts[0].indexOf("=") === -1
  ) {
    out.ubicacion = parts[0];
  }

  return out;
}

function sendEmails_(data) {
  const admin = CONFIG.ADMIN_EMAIL;
  const client = data.correo_final;

  const subjectAdmin = `Pago aprobado - Ref: ${data.reference_sale}`;
  const subjectClient = `✅ Confirmación de tu pago - Ref: ${data.reference_sale}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>✅ Pago aprobado</h2>
      <p><b>Referencia:</b> ${data.reference_sale || "-"}</p>
      <p><b>Valor:</b> ${data.value || "-"} ${data.currency || ""}</p>
      <p><b>Estado (state_pol):</b> ${data.state_pol || "-"}</p>
      <hr>
      <h3>Datos del cliente</h3>
      <p><b>Nombre:</b> ${data.nombre || "-"}</p>
      <p><b>Correo:</b> ${client || "-"}</p>
      <p><b>Teléfono:</b> ${data.telefono || data.phone || "-"}</p>
      <p><b>Empresa:</b> ${data.empresa || "-"}</p>
      <p><b>Tipo:</b> ${data.tipo || "-"}</p>
      <p><b>Ubicación:</b> ${data.ubicacion || "-"}</p>
      <p><b>Vendedor:</b> ${data.vendedor || "-"}</p>
      <hr>
      <p>Generado automáticamente por Confirmation URL (PayU).</p>
    </div>
  `;

  MailApp.sendEmail({ to: admin, subject: subjectAdmin, htmlBody: html });

  if (isValidEmail_(client)) {
    MailApp.sendEmail({ to: client, subject: subjectClient, htmlBody: html });
  }
}

/** ===================== PAYU CONFIRMATION (POST) ===================== */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    const p = e && e.parameter ? e.parameter : {};

    const merchant_id = (p.merchant_id || p.merchantId || "").toString().trim();
    const reference_sale = (p.reference_sale || "").toString().trim();
    const value = (p.value || "").toString().trim();
    const currency = (p.currency || "").toString().trim();
    const state_pol = (p.state_pol || "").toString().trim();
    const receivedSign = (p.sign || p.signature || "")
      .toString()
      .trim()
      .toLowerCase();

    const sh = getOrCreateSheet_();

    // RAW extras
    const extra1 = (p.extra1 || "").toString().trim();
    const extra2 = (p.extra2 || "").toString().trim();
    const extra3 = (p.extra3 || "").toString().trim();
    const extra4 = (p.extra4 || "").toString().trim();
    const extra5 = (p.extra5 || "").toString().trim();

    const pack = parseExtra2Pack_(extra2);

    const tipo = extra1;
    const nombre = extra3;

    const telefono = extra4 || pack.telefono || "";
    const empresa = extra5 || pack.empresa || "";

    const ubicacion = pack.ubicacion || extra2 || "";
    const vendedor = pack.vendedor || "";

    // Firma confirmation
    let signOk = false;
    let expectedSign = "";

    if (
      merchant_id &&
      reference_sale &&
      value &&
      currency &&
      state_pol &&
      receivedSign
    ) {
      const apiKey = getApiKey_();
      const newValue = formatNewValueConfirmation_(value);
      const rawSign = `${apiKey}~${merchant_id}~${reference_sale}~${newValue}~${currency}~${state_pol}`;
      expectedSign = md5Hex_(rawSign).toLowerCase();
      signOk = expectedSign === receivedSign;
    }

    const correoFinal =
      (p.email_buyer || "").toString().trim() ||
      (p.buyerEmail || "").toString().trim() ||
      "";

    const reference_pol = (p.reference_pol || "").toString().trim();
    const transaction_id = (p.transaction_id || "").toString().trim();
    const uniqueKey =
      reference_pol ||
      transaction_id ||
      reference_sale ||
      "NOREF_" + Date.now();

    const rowData = {
      timestamp: new Date(),
      unique_key: uniqueKey,

      reference_sale,
      state_pol,
      response_message_pol: (p.response_message_pol || "").toString(),

      value,
      currency,
      email_buyer: (p.email_buyer || "").toString(),
      phone: (p.phone || "").toString(),

      extra1,
      extra2,
      extra3,
      extra4,
      extra5,

      transaction_id,
      reference_pol,

      sign_ok: signOk ? "YES" : "NO",
      expected_sign: expectedSign,
      received_sign: receivedSign,

      nombre,
      telefono,
      empresa,

      tipo,
      ubicacion,
      vendedor,
      correo_final: correoFinal,
    };

    const row = [
      rowData.timestamp,
      rowData.unique_key,
      rowData.reference_sale,
      rowData.state_pol,
      rowData.response_message_pol,
      rowData.value,
      rowData.currency,
      rowData.email_buyer,
      rowData.phone,
      rowData.extra1,
      rowData.extra2,
      rowData.extra3,
      rowData.extra4,
      rowData.extra5,
      rowData.transaction_id,
      rowData.reference_pol,
      rowData.sign_ok,
      rowData.expected_sign,
      rowData.received_sign,
      rowData.nombre,
      rowData.telefono,
      rowData.empresa,
      rowData.tipo,
      rowData.ubicacion,
      rowData.vendedor,
      rowData.correo_final,
    ];

    upsertByUniqueKey_(sh, uniqueKey, row);

    if (signOk && state_pol === "4") {
      if (!alreadyProcessedApproved_(reference_sale)) {
        markProcessedApproved_(reference_sale);
        sendEmails_(rowData);
      }
    }

    return ContentService.createTextOutput("OK").setMimeType(
      ContentService.MimeType.TEXT,
    );
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput("ERROR: " + err.message).setMimeType(
      ContentService.MimeType.TEXT,
    );
  } finally {
    lock.releaseLock();
  }
}

/** ===================== RESPONSE URL (GET) + UTIL ENDPOINTS ===================== */
function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};

  // ✅ Ping rápido
  if (p.ping === "1") {
    return ContentService.createTextOutput("PONG OK").setMimeType(
      ContentService.MimeType.TEXT,
    );
  }

  /**
   * ✅ Endpoint seguro para firmar WebCheckout (NO expone API key)
   * Llamada:
   *  /exec?signcheckout=1&merchantId=...&referenceCode=...&amount=...&currency=COP
   * Respuesta:
   *  { "signature": "..." }
   */
  if (p.signcheckout === "1") {
    const apiKey = getApiKey_();
    const merchantId = String(p.merchantId || "").trim();
    const referenceCode = String(p.referenceCode || "").trim();
    const amount = String(p.amount || "").trim(); // debe venir tipo "320813.00"
    const currency = String(p.currency || "COP").trim();

    if (!merchantId || !referenceCode || !amount || !currency) {
      return ContentService.createTextOutput(
        JSON.stringify({
          error: "Missing params",
          need: ["merchantId", "referenceCode", "amount", "currency"],
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const raw = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;
    const signature = md5Hex_(raw);

    return ContentService.createTextOutput(
      JSON.stringify({ signature }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // Página de resultado (Response URL)
  const ref = p.referenceCode || p.reference_sale || p.ref || "";
  const state = p.transactionState || p.state_pol || "";

  return HtmlService.createHtmlOutput(`
    <html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="font-family:Arial,sans-serif;padding:24px;max-width:720px;margin:0 auto;">
        <h2>Resultado del pago</h2>
        <p><b>Referencia:</b> ${String(ref)}</p>
        <p><b>Estado:</b> ${String(state)}</p>
        <p>Si tu pago fue aprobado, recibirás un correo de confirmación.</p>
      </body>
    </html>
  `);
}
