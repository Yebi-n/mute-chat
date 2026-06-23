import { Webhook } from 'npm:standardwebhooks@1.0.0';

type SendSmsHookPayload = {
  user?: { phone?: string };
  sms?: { otp?: string };
};

function requiredSecret(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function standardWebhookSecret() {
  return requiredSecret('SEND_SMS_HOOK_SECRET')
    .replace(/^v1,whsec_/i, '')
    .replace(/^whsec_/i, '');
}

function normalizeKoreanRecipient(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('82')) return `0${digits.slice(2)}`;
  if (digits.startsWith('0')) return digits;
  if (digits.length === 10 || digits.length === 11) return `0${digits}`;
  throw new Error(`Unsupported phone number format: ${phone}`);
}

function normalizeSenderNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (!/^\d{8,11}$/.test(digits)) {
    throw new Error('SOLAPI_SENDER_NUMBER is invalid');
  }
  return digits;
}

function errorResponse(status: number, message: string) {
  return Response.json(
    { error: { http_code: status, message } },
    { status },
  );
}

function randomSalt(length = 32) {
  const alphabet = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function solapiAuthorization() {
  const apiKey = requiredSecret('SOLAPI_API_KEY');
  const apiSecret = requiredSecret('SOLAPI_API_SECRET');
  const date = new Date().toISOString();
  const salt = randomSalt();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = toHex(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date + salt)),
  );
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function sendSolapiSms(to: string, from: string, text: string) {
  const response = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
    method: 'POST',
    headers: {
      authorization: await solapiAuthorization(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ to, from, text }],
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Solapi ${response.status}: ${detail}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'POST' },
    });
  }

  try {
    const payloadText = await request.text();

    try {
      new Webhook(standardWebhookSecret()).verify(payloadText, {
        'webhook-id': request.headers.get('webhook-id') ?? '',
        'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
        'webhook-signature': request.headers.get('webhook-signature') ?? '',
      });
    } catch {
      return errorResponse(401, 'Invalid webhook signature');
    }

    const payload = JSON.parse(payloadText) as SendSmsHookPayload;
    const phone = payload.user?.phone?.trim() ?? '';
    const otp = payload.sms?.otp?.trim() ?? '';

    if (!/^\d{6}$/.test(otp)) {
      return errorResponse(400, 'Invalid authentication code');
    }

    await sendSolapiSms(
      normalizeKoreanRecipient(phone),
      normalizeSenderNumber(requiredSecret('SOLAPI_SENDER_NUMBER')),
      `[\uBBA4\uD2B8] \uC778\uC99D\uBC88\uD638\uB294 ${otp}\uC785\uB2C8\uB2E4. \uD0C0\uC778\uC5D0\uAC8C \uACF5\uC720\uD558\uC9C0 \uB9C8\uC138\uC694.`,
    );

    return Response.json({ message: 'Message sent successfully.' });
  } catch (error) {
    console.error('send-auth-sms failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return errorResponse(500, '\uC778\uC99D\uBC88\uD638 \uBC1C\uC1A1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
  }
});
