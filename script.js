/**
 * PayU WebCheckout - Confirmation URL (POST) + Response URL (GET)
 * - Guarda SIEMPRE en Google Sheets (diagnóstico)
 * - Envía email SOLO cuando está APROBADO (state_pol=4) y la firma es válida
 * - Incluye TEST visible (testSheetAndMail) y ping (?ping=1)
 */

const CONFIG = {
  ADMIN_EMAIL: "desarrollo@centrojuridicointernacional.com",
  SHEET_ID: "1EIkQNY9smNg1GJ-51qK0gfFB5FnjyM1UyjfFWWIlkPg",
  SHEET_NAME: "PagosPayU",
  // Script property: PAYU_API_KEY
};

/** ===================== HELPERS ===================== */

function getApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty("PAYU_API_KEY");
  if (!key) throw new Error("Falta Script Property PAYU_API_KEY (Project Settings > Script properties).");
  return key;
}

function md5Hex_(str) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str, Utilities.Charset.UTF_8);
  return raw.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

/**
 * new_value para CONFIRMATION (POST):
 * - Si el segundo decimal es 0 => 1 decimal
 * - Si no, 2 decimales
 */
function formatNewValueConfirmation_(valueStr) {
  const n = Number(valueStr);
  if (!isFinite(n)) return String(valueStr);

  const fixed2 = n.toFixed(2);
  const parts = fixed2.split(".");
  const dec2 = parts[1] || "00";

  if (dec2.length >= 2 && dec2[1] === "0") {
    return (Number(parts[0] + "." + dec2[0])).toFixed(1);
  }
  return fixed2;
}

function safeJsonParse_(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

/**
 * extra3 ahora puede venir:
 * 1) JSON (viejo)
 * 2) COMPACTO: "ref=...|v=...|t=...|u=...|c=..."
 */
function parseExtra3_(raw) {
  const j = safeJsonParse_(raw);
  if (j) return j;

  const out = {};
  String(raw || "").split("|").forEach(part => {
    const i = part.indexOf("=");
    if (i > -1) {
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      out[k] = v;
    }
  });

  return {
    referenceCode: out.ref || "",
    vendedor: out.v || "",
    tipo: out.t || "",
    ubicacion: out.u || "",
    correo: out.c || ""
  };
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
    "timestamp", "reference_sale", "state_pol", "response_message_pol",
    "value", "currency", "email_buyer", "phone",
    "extra1", "extra2", "extra3_raw", "extra4", "extra5",
    "transaction_id", "reference_pol", "sign_ok",
    "expected_sign", "received_sign",
    "nombre", "empresa", "telefono", "tipo", "ubicacion", "vendedor", "valor_form", "correo_final"
  ];

  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(header);
    return;
  }

  const a1 = String(sh.getRange(1, 1).getValue() || "").trim().toLowerCase();
  if (!a1 || a1 !== "timestamp") {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
}

function alreadyProcessedApproved_(referenceSale) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty("APPROVED_" + referenceSale) === "1";
}

function markProcessedApproved_(referenceSale) {
  PropertiesService.getScriptProperties().setProperty("APPROVED_" + referenceSale, "1");
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
      <p><b>Nombre:</b> ${data.persona || "-"}</p>
      <p><b>Correo:</b> ${client || "-"}</p>
      <p><b>Teléfono:</b> ${data.telefono || data.phone || "-"}</p>
      <p><b>Tipo:</b> ${data.tipo || "-"}</p>
      <p><b>Ubicación:</b> ${data.ubicacion || "-"}</p>
      <p><b>Empresa:</b> ${data.empresa || "-"}</p>
      <p><b>Vendedor:</b> ${data.vendedor || "-"}</p>
      <hr>
      <p>Generado automáticamente por Confirmation URL (PayU).</p>
    </div>
  `;

  MailApp.sendEmail({ to: admin, subject: subjectAdmin, htmlBody: html });

  if (client && String(client).includes("@")) {
    MailApp.sendEmail({ to: client, subject: subjectClient, htmlBody: html });
  }
}

/** ===================== TEST VISIBLE ===================== */
function testSheetAndMail() {
  const sh = getOrCreateSheet_();
  sh.appendRow([
    new Date(), "REF_TEST", "4", "OK",
    "0", "COP", "test@correo.com", "3000000000",
    "extra1", "extra2", "ref=REF_TEST|v=sin_vendedor|t=empresa|u=bogota|c=test@correo.com",
    "3000000000", "Cliente Prueba | Empresa Prueba",
    "TX_TEST", "RP_TEST", "YES",
    "expected", "received",
    "Cliente Prueba", "Empresa Prueba", "3000000000", "empresa", "bogota", "sin_vendedor", "0", "test@correo.com"
  ]);

  MailApp.sendEmail(CONFIG.ADMIN_EMAIL, "✅ Test OK", "✅ Se escribió REF_TEST en la hoja y se envió este correo.");
}

/** ===================== PAYU CONFIRMATION (POST) ===================== */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    const p = (e && e.parameter) ? e.parameter : {};

    const merchant_id = p.merchant_id || "";
    const reference_sale = p.reference_sale || "";
    const value = p.value || "";
    const currency = p.currency || "";
    const state_pol = p.state_pol || "";
    const receivedSign = (p.sign || "").toLowerCase();

    const sh = getOrCreateSheet_();

    const extra3raw = p.extra3 || "";
    const extra3 = parseExtra3_(extra3raw) || {};

    const extra4 = p.extra4 || "";
    const extra5 = p.extra5 || "";

    let signOk = false;
    let expectedSign = "";
    if (merchant_id && reference_sale && value && currency && state_pol && receivedSign) {
      const apiKey = getApiKey_();
      const newValue = formatNewValueConfirmation_(value);
      const raw = `${apiKey}~${merchant_id}~${reference_sale}~${newValue}~${currency}~${state_pol}`;
      expectedSign = md5Hex_(raw).toLowerCase();
      signOk = (expectedSign === receivedSign);
    }

    // Intentar reconstruir "nombre" y "empresa" desde extra5: "Nombre | Empresa"
    let persona = "";
    let empresa = "";
    if (extra5) {
      const parts = String(extra5).split("|").map(s => s.trim());
      persona = parts[0] || "";
      empresa = parts[1] || "";
    }

    const correoFinal =
      (extra3.correo || "").toString().trim() ||
      (p.email_buyer || "").toString().trim() ||
      "";

    const rowData = {
      timestamp: new Date(),
      reference_sale,
      state_pol,
      response_message_pol: p.response_message_pol || "",
      value,
      currency,
      email_buyer: p.email_buyer || "",
      phone: p.phone || "",
      extra1: p.extra1 || "",
      extra2: p.extra2 || "",
      extra3_raw: extra3raw,
      extra4,
      extra5,
      transaction_id: p.transaction_id || "",
      reference_pol: p.reference_pol || "",
      sign_ok: signOk ? "YES" : "NO",
      expected_sign: expectedSign,
      received_sign: receivedSign,

      persona,
      empresa,
      telefono: extra4 || (p.phone || ""),
      tipo: extra3.tipo || (p.extra1 || ""),
      ubicacion: extra3.ubicacion || (p.extra2 || ""),
      vendedor: extra3.vendedor || "",
      valor_form: value || "",
      correo_final: correoFinal,
    };

    sh.appendRow([
      rowData.timestamp,
      rowData.reference_sale,
      rowData.state_pol,
      rowData.response_message_pol,
      rowData.value,
      rowData.currency,
      rowData.email_buyer,
      rowData.phone,
      rowData.extra1,
      rowData.extra2,
      rowData.extra3_raw,
      rowData.extra4,
      rowData.extra5,
      rowData.transaction_id,
      rowData.reference_pol,
      rowData.sign_ok,
      rowData.expected_sign,
      rowData.received_sign,
      rowData.persona,
      rowData.empresa,
      rowData.telefono,
      rowData.tipo,
      rowData.ubicacion,
      rowData.vendedor,
      rowData.valor_form,
      rowData.correo_final
    ]);

    if (signOk && String(state_pol) === "4") {
      if (!alreadyProcessedApproved_(reference_sale)) {
        markProcessedApproved_(reference_sale);
        sendEmails_(rowData);
      }
    }

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput("ERROR: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}

/** ===================== RESPONSE URL (GET) ===================== */
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};

  if (p.ping === "1") {
    return ContentService.createTextOutput("PONG OK").setMimeType(ContentService.MimeType.TEXT);
  }

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
