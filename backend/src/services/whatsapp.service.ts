import { env } from '../config/env';
import { ApiError } from '../shared/api-error';

export interface SendWhatsAppOtpOptions {
  phoneE164: string;
  otp: string;
}

export interface SendWhatsAppBookingRewardOptions {
  phoneE164: string;
  customerName: string;
  pointsEarned: number;
  totalBalance: number;
  bookingType?: 'FLIGHTS' | 'HOTELS' | 'HOLIDAYS';
  imageUrl?: string;
}

interface MetaApiResponse {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string; message_status?: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    error_data?: unknown;
    fbtrace_id?: string;
  };
}

const BOOKING_HEADER_IMAGES: Record<'FLIGHTS' | 'HOTELS' | 'HOLIDAYS', string> = {
  FLIGHTS: 'https://gac-dawebco.vercel.app/images/flight.png',
  HOTELS: 'https://gac-dawebco.vercel.app/images/hotel.png',
  HOLIDAYS: 'https://gac-dawebco.vercel.app/images/holiday.png',
};

/**
 * Sends a WhatsApp OTP authentication message via Meta Cloud API using the configured template.
 */
export async function sendWhatsAppOtpMessage(options: SendWhatsAppOtpOptions): Promise<{ messageId: string }> {
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_CLOUD_API_TOKEN) {
    throw new ApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'WhatsApp Cloud API credentials are not configured.');
  }

  const recipient = options.phoneE164.replace(/[^0-9]/g, '');
  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME_OTP,
      language: {
        code: env.WHATSAPP_TEMPLATE_LANGUAGE,
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: options.otp,
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: options.otp,
            },
          ],
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_CLOUD_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as MetaApiResponse;

  if (!response.ok || result.error) {
    const errorMsg = result.error?.message || `Meta WhatsApp API failed with status ${response.status}`;
    console.error('WhatsApp OTP API error:', result.error || result);
    throw new ApiError(502, 'WHATSAPP_SEND_FAILED', errorMsg, result.error);
  }

  const messageId = result.messages?.[0]?.id || 'unknown';
  return { messageId };
}

/**
 * Sends a WhatsApp booking reward notification message via Meta Cloud API.
 */
export async function sendWhatsAppBookingRewardMessage(
  options: SendWhatsAppBookingRewardOptions,
): Promise<{ messageId: string }> {
  if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_CLOUD_API_TOKEN) {
    throw new ApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'WhatsApp Cloud API credentials are not configured.');
  }

  const recipient = options.phoneE164.replace(/[^0-9]/g, '');
  const url = `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const typeImageUrl = options.bookingType ? BOOKING_HEADER_IMAGES[options.bookingType] : undefined;
  const defaultImageUrl = 'https://gac-dawebco.vercel.app/images/holiday.png';
  const headerImageUrl = options.imageUrl || typeImageUrl || defaultImageUrl;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME_REWARDS,
      language: {
        code: env.WHATSAPP_TEMPLATE_LANGUAGE,
      },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: {
                link: headerImageUrl,
              },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: options.customerName,
            },
            {
              type: 'text',
              text: String(options.pointsEarned.toLocaleString('en-IN')),
            },
            {
              type: 'text',
              text: String(options.totalBalance.toLocaleString('en-IN')),
            },
          ],
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_CLOUD_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as MetaApiResponse;

  if (!response.ok || result.error) {
    const errorMsg = result.error?.message || `Meta WhatsApp API failed with status ${response.status}`;
    console.error('WhatsApp Reward API error:', result.error || result);
    throw new ApiError(502, 'WHATSAPP_SEND_FAILED', errorMsg, result.error);
  }

  const messageId = result.messages?.[0]?.id || 'unknown';
  return { messageId };
}
