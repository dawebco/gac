from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "GAC_Holidays_WhatsApp_OTP_Setup_Guide.pdf"

NAVY = colors.HexColor("#001735")
NAVY_2 = colors.HexColor("#08284F")
GOLD = colors.HexColor("#FFBF00")
TEXT = colors.HexColor("#17253B")
MUTED = colors.HexColor("#63738A")
LIGHT = colors.HexColor("#F3F6FA")
BORDER = colors.HexColor("#D9E1EB")
GREEN = colors.HexColor("#0C8B4B")
RED = colors.HexColor("#B7352D")


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=28,
    leading=33,
    textColor=colors.white,
    alignment=TA_LEFT,
    spaceAfter=12,
))
styles.add(ParagraphStyle(
    name="CoverSub",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=12,
    leading=18,
    textColor=colors.HexColor("#D9E5F3"),
))
styles.add(ParagraphStyle(
    name="H1x",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=18,
    leading=22,
    textColor=NAVY,
    spaceBefore=8,
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="H2x",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=12.5,
    leading=16,
    textColor=NAVY_2,
    spaceBefore=8,
    spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="Bodyx",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9.5,
    leading=14,
    textColor=TEXT,
    spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="Smallx",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8,
    leading=11,
    textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="Calloutx",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9,
    leading=13,
    textColor=TEXT,
))
styles.add(ParagraphStyle(
    name="Codex",
    fontName="Courier",
    fontSize=7.4,
    leading=10.2,
    textColor=colors.HexColor("#EAF2FC"),
    leftIndent=0,
    rightIndent=0,
))
styles.add(ParagraphStyle(
    name="StepBadge",
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=NAVY,
    alignment=TA_CENTER,
))


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    if doc.page > 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, height - 14 * mm, width, 14 * mm, fill=1, stroke=0)
        canvas.setFillColor(GOLD)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(17 * mm, height - 9 * mm, "GAC")
        canvas.setFillColor(colors.white)
        canvas.drawString(29 * mm, height - 9 * mm, "Holidays")
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#AFC0D6"))
        canvas.drawRightString(width - 17 * mm, height - 9 * mm, "WhatsApp OTP Setup Guide")
    canvas.setStrokeColor(BORDER)
    canvas.line(17 * mm, 13 * mm, width - 17 * mm, 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(17 * mm, 8.5 * mm, "Production setup guide - Meta Cloud API + Upstash Redis + Vercel")
    canvas.drawRightString(width - 17 * mm, 8.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def h1(text):
    return Paragraph(text, styles["H1x"])


def h2(text):
    return Paragraph(text, styles["H2x"])


def bullets(items, level=0):
    return ListFlowable(
        [ListItem(p(item), leftIndent=7 * mm) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=(5 + level * 5) * mm,
        bulletFontName="Helvetica",
        bulletFontSize=6,
        bulletColor=GOLD,
        spaceAfter=6,
    )


def numbered(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=8 * mm) for item in items],
        bulletType="1",
        leftIndent=6 * mm,
        bulletFontName="Helvetica-Bold",
        bulletFontSize=8,
        bulletColor=NAVY,
        spaceAfter=7,
    )


def code(text):
    box = Table([[XPreformatted(text.strip(), styles["Codex"]) ]], colWidths=[172 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.7, NAVY_2),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return box


def callout(title, text, tone="gold"):
    color = GOLD if tone == "gold" else (GREEN if tone == "green" else RED)
    content = Paragraph(f"<b>{title}</b><br/>{text}", styles["Calloutx"])
    table = Table([["", content]], colWidths=[3 * mm, 169 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF9E8") if tone == "gold" else LIGHT),
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (1, 0), (1, 0), 10),
        ("RIGHTPADDING", (1, 0), (1, 0), 10),
    ]))
    return table


def step_title(number, title):
    badge = Table([[p(f"STEP {number}", "StepBadge")]], colWidths=[19 * mm], rowHeights=[7 * mm])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0, GOLD),
    ]))
    title_p = Paragraph(title, styles["H1x"])
    table = Table([[badge, title_p]], colWidths=[23 * mm, 149 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=19 * mm,
    rightMargin=19 * mm,
    topMargin=20 * mm,
    bottomMargin=18 * mm,
    title="GAC Holidays WhatsApp OTP Setup Guide",
    author="GAC Holidays Engineering",
    subject="Meta WhatsApp Cloud API OTP authentication setup",
)

frame = Frame(
    doc.leftMargin,
    doc.bottomMargin,
    doc.width,
    doc.height,
    leftPadding=0,
    rightPadding=0,
    topPadding=0,
    bottomPadding=0,
)
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])

story = []

# Cover
cover = Table([
    [Paragraph("GAC<span color='#FFFFFF'>Holidays</span>", ParagraphStyle(
        "Brand", fontName="Helvetica-Bold", fontSize=22, leading=24,
        textColor=GOLD))],
    [Spacer(1, 31 * mm)],
    [p("CUSTOMER AUTHENTICATION", "Smallx")],
    [Paragraph("WhatsApp OTP<br/>Setup Guide", styles["CoverTitle"])],
    [Paragraph(
        "A production-focused, step-by-step guide for connecting the existing GAC Holidays React application to Meta WhatsApp Cloud API, Upstash Redis and Vercel serverless functions.",
        styles["CoverSub"],
    )],
    [Spacer(1, 18 * mm)],
    [Paragraph("Meta Cloud API  |  Six-digit OTP  |  Five-minute expiry  |  Secure sessions", ParagraphStyle(
        "CoverMeta", fontName="Helvetica-Bold", fontSize=8.5, leading=12,
        textColor=GOLD))],
    [Spacer(1, 30 * mm)],
    [Paragraph("Version 1.0  |  11 August 2026", ParagraphStyle(
        "CoverDate", fontName="Helvetica", fontSize=8.5,
        textColor=colors.HexColor("#AFC0D6")))],
], colWidths=[172 * mm], rowHeights=[None] * 9)
cover.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), NAVY),
    ("LEFTPADDING", (0, 0), (-1, -1), 17 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 17 * mm),
    ("TOPPADDING", (0, 0), (0, 0), 15 * mm),
    ("BOTTOMPADDING", (0, -1), (0, -1), 15 * mm),
]))
story.append(cover)
story.append(PageBreak())

story.extend([
    h1("How to use this guide"),
    p("This guide intentionally isolates WhatsApp OTP login from the rest of the approved backend roadmap. Complete the steps in order. Do not connect the production business number until the Meta test number, Redis expiry and verification flow all work end to end."),
    callout(
        "Current limitation",
        "Until customer registration is persisted in PostgreSQL, OTP proves possession of a phone number but cannot prove that the number belongs to an existing GAC customer. The temporary implementation authenticates the number and opens the current prototype dashboard.",
        "gold",
    ),
    Spacer(1, 5 * mm),
    h2("Target architecture"),
    code("""
React customer login
        |
        v
POST /api/auth/otp/request
        |-- normalize phone to E.164
        |-- rate-limit IP and phone
        |-- generate six-digit OTP
        |-- store HMAC hash in Redis (TTL 300 seconds)
        `-- send approved Meta authentication template
        |
        v
POST /api/auth/otp/verify
        |-- verify hash and attempt count
        |-- delete OTP after success
        `-- issue HttpOnly customer session cookie
"""),
    Spacer(1, 5 * mm),
    h2("Contents"),
    bullets([
        "Meta business and developer application setup",
        "Official WhatsApp number and authentication template",
        "Permanent Meta access token",
        "Upstash Redis, rate limits and environment variables",
        "OTP request, Meta delivery and verification workflows",
        "Secure customer sessions and React integration",
        "Vercel deployment, rollout and acceptance checks",
        "Troubleshooting and official references",
    ]),
    PageBreak(),
])

story.extend([
    step_title(1, "Create or select the Meta business portfolio"),
    p("Open Meta Business and create or select the business portfolio owned by GAC Holidays."),
    numbered([
        "Open <link href='https://business.facebook.com/' color='#0B64B4'>business.facebook.com</link> and sign in with the business administrator account.",
        "Create or select the GAC Holidays business portfolio.",
        "Open Business Settings and complete the legal name, address, website and business email.",
        "Open Security Center and complete business verification if Meta requests it.",
        "Use a business-controlled email address and domain wherever possible.",
    ]),
    callout("Ownership rule", "The Meta app, WhatsApp Business Account and official phone number should be owned by the client's business portfolio, not by an individual developer account.", "green"),
    Spacer(1, 7 * mm),
    step_title(2, "Create the Meta developer application"),
    numbered([
        "Open <link href='https://developers.facebook.com/' color='#0B64B4'>Meta for Developers</link>.",
        "Select My Apps, then Create App.",
        "Choose the Business app type.",
        "Name the app GAC Holidays Customer Authentication.",
        "Connect the app to the GAC Holidays business portfolio.",
        "Add the WhatsApp product and open WhatsApp -> API Setup.",
    ]),
    p("Record the temporary test credentials displayed by Meta: test number, temporary access token, Phone Number ID and WhatsApp Business Account ID. Use these only to validate the API with an approved test recipient."),
    callout("Do not start with the official number", "First send a successful template message using Meta's test number. This prevents accidental interruption of the company's active WhatsApp service.", "gold"),
    PageBreak(),
])

story.extend([
    step_title(3, "Connect the official GAC Holidays number"),
    numbered([
        "From WhatsApp -> API Setup, select Add phone number.",
        "Enter the approved GAC Holidays display name and business category.",
        "Enter the official phone number and verify it by SMS or voice.",
        "Wait for display-name approval if required.",
        "Add a payment method in WhatsApp Manager before production traffic.",
    ]),
    callout(
        "Existing WhatsApp app warning",
        "If the official number is already used in the WhatsApp or WhatsApp Business mobile app, review Meta's current migration or coexistence options before changing anything. Do not deregister an active business number without a rollback plan.",
        "red",
    ),
    Spacer(1, 7 * mm),
    step_title(4, "Create the authentication template"),
    p("Open WhatsApp Manager -> Account tools -> Message templates -> Create template."),
    code("""
Category: Authentication
Name: gac_login_otp
Language: English
OTP delivery: Copy code
Security recommendation: Enabled
Expiration warning: 5 minutes
"""),
    p("Meta controls most authentication-template wording. The approved message will normally state that the supplied value is a verification code, advise the user not to share it and show a Copy Code button."),
    bullets([
        "Submit the template for approval.",
        "Wait until its status is Approved.",
        "Record the exact template name and language code.",
        "Use the payload sample generated for that specific template as the final authority.",
    ]),
    PageBreak(),
])

story.extend([
    step_title(5, "Create the permanent Meta system-user token"),
    p("The temporary token on the API Setup page expires and must not be used for production."),
    numbered([
        "Open Meta Business Settings -> Users -> System users.",
        "Create a system user with an administrator role.",
        "Assign the Meta app, WhatsApp Business Account and phone-number assets.",
        "Generate an access token for the application.",
        "Grant whatsapp_business_messaging and whatsapp_business_management.",
        "Copy the token once and store it only in Vercel's encrypted environment settings.",
    ]),
    callout("Secret handling", "Never commit the access token, Redis token, OTP secret or session secret to Git. Never prefix them with REACT_APP_. CRA exposes every REACT_APP_ value in the browser bundle.", "red"),
    Spacer(1, 7 * mm),
    step_title(6, "Create the Upstash Redis database"),
    numbered([
        "Create an account at <link href='https://console.upstash.com/' color='#0B64B4'>console.upstash.com</link>.",
        "Create a Redis database named gac-holidays-otp.",
        "Select a primary region close to the Vercel functions and Indian users.",
        "Copy the REST URL and REST token from the database details page.",
    ]),
    p("Upstash's REST-based Redis client is connectionless and is designed for serverless functions such as Vercel. It is appropriate for short-lived OTP and rate-limit state."),
    PageBreak(),
])

story.extend([
    step_title(7, "Install the minimal server dependencies"),
    code("""
npm install @upstash/redis @upstash/ratelimit libphonenumber-js
npm install --save-dev @vercel/node typescript
"""),
    h2("Minimal project structure"),
    code("""
gac/
|-- api/
|   `-- auth/
|       `-- otp/
|           |-- request.ts
|           `-- verify.ts
|-- server/
|   |-- config.ts
|   |-- phone.ts
|   |-- redis.ts
|   |-- otp.ts
|   |-- whatsapp.ts
|   `-- session.ts
|-- src/App.js
|-- .env
|-- .env.example
`-- package.json
"""),
    p("Files under api/ become Vercel serverless endpoints. Files under server/ contain shared server-only code."),
    Spacer(1, 7 * mm),
    step_title(8, "Configure server-only environment variables"),
    code("""
WHATSAPP_GRAPH_VERSION=v20.0
WHATSAPP_CLOUD_API_TOKEN=replace_with_permanent_meta_token
WHATSAPP_PHONE_NUMBER_ID=replace_with_phone_number_id
WHATSAPP_TEMPLATE_NAME=gac_login_otp
WHATSAPP_TEMPLATE_LANGUAGE=en

UPSTASH_REDIS_REST_URL=https://replace.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace_with_redis_token

OTP_HASH_SECRET=replace_with_at_least_32_random_bytes
CUSTOMER_SESSION_SECRET=replace_with_another_random_secret
CUSTOMER_SESSION_TTL_SECONDS=604800

APP_ORIGIN=http://localhost:3000
NODE_ENV=development
"""),
    PageBreak(),
])

story.extend([
    h2("Generate independent secrets in PowerShell"),
    code("""
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
"""),
    p("Run the command twice. Use one output for OTP_HASH_SECRET and the other for CUSTOMER_SESSION_SECRET."),
    callout("Graph API version", "Keep the Graph API version in configuration instead of hardcoding it. Review Meta's version lifecycle and update the value before the configured version is retired.", "gold"),
    Spacer(1, 7 * mm),
    step_title(9, "Normalize customer phone numbers"),
    p("The current React form accepts a 10-digit Indian number. The server must normalize it to E.164 and must not trust frontend normalization."),
    code("""
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeIndianPhone(input: string): string {
  const raw = input.trim();
  const phone = parsePhoneNumberFromString(raw, "IN");

  if (!phone?.isValid()) {
    throw new Error("Invalid mobile number");
  }

  return phone.number; // Example: +919876543210
}
"""),
    bullets([
        "Use the normalized value in every Redis key.",
        "Store phone numbers as text, never as numeric values.",
        "Remove the plus sign only when the Meta recipient field requires digits only.",
    ]),
    PageBreak(),
])

story.extend([
    step_title(10, "Generate and hash the OTP"),
    code("""
import crypto from "node:crypto";

const otp = crypto.randomInt(100000, 1000000).toString();

const otpHash = crypto
  .createHmac("sha256", process.env.OTP_HASH_SECRET!)
  .update(`${phoneE164}:${otp}`)
  .digest("hex");
"""),
    p("Store only the HMAC hash. Never log or persist the plaintext code."),
    code("""
await redis.set(
  `otp:login:${phoneE164}`,
  {
    hash: otpHash,
    attempts: 0,
    createdAt: Date.now()
  },
  { ex: 300 }
);
"""),
    h2("Required Redis controls"),
    data := Table([
        [p("Control", "Smallx"), p("Recommended limit", "Smallx")],
        [p("OTP expiry"), p("5 minutes")],
        [p("Resend cooldown"), p("1 request per phone every 30 seconds")],
        [p("Phone send limit"), p("5 requests per hour")],
        [p("IP send limit"), p("20 requests per hour")],
        [p("Attempts per OTP"), p("5 incorrect attempts")],
        [p("Verify limit"), p("10 requests per IP per 15 minutes")],
        [p("Abuse lock"), p("30 minutes")],
    ], colWidths=[66 * mm, 106 * mm]),
])
data.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.extend([data, PageBreak()])

story.extend([
    step_title(11, "Send the authentication template through Meta"),
    p("Send an HTTPS POST request to the configured Graph endpoint:"),
    code("""
POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_CLOUD_API_TOKEN}
Content-Type: application/json
"""),
    p("A Copy Code authentication template generally uses the following structure. Use the payload example generated for the approved GAC template as the final authority."),
    code("""
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "gac_login_otp",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "123456" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [
          { "type": "text", "text": "123456" }
        ]
      }
    ]
  }
}
"""),
    p("A successful response contains a message ID beginning with wamid. If Meta returns a definite non-2xx response, delete the newly stored OTP, log the provider error code server-side and return a generic failure to the browser."),
    PageBreak(),
])

story.extend([
    step_title(12, "Implement POST /api/auth/otp/request"),
    p("Request body:"),
    code("""
{ "phone": "9876543210" }
"""),
    numbered([
        "Reject non-POST methods and oversized or malformed JSON.",
        "Normalize the phone to E.164.",
        "Extract the first IP from x-forwarded-for.",
        "Apply the IP limit, phone limit and 30-second resend cooldown.",
        "Generate the six-digit code and HMAC hash.",
        "Store the hash in Redis with a 300-second TTL.",
        "Send the approved authentication template through Meta.",
        "Return HTTP 202 with a generic response.",
    ]),
    code("""
{
  "ok": true,
  "message": "Verification code sent.",
  "expiresIn": 300
}
"""),
    callout("Account-enumeration protection", "Do not reveal whether the submitted number is registered. A registered-customer database check can be added later while preserving a generic response.", "gold"),
    Spacer(1, 7 * mm),
    step_title(13, "Implement POST /api/auth/otp/verify"),
    code("""
{
  "phone": "9876543210",
  "code": "123456"
}
"""),
    numbered([
        "Require exactly six digits.",
        "Normalize the phone and apply verification rate limits.",
        "Read otp:login:{phone} from Redis.",
        "Reject missing, expired, blocked or exhausted challenges.",
        "HMAC the submitted value and compare it using crypto.timingSafeEqual.",
        "Increment attempts atomically while preserving the remaining TTL after a failure.",
        "Delete the OTP immediately after a successful comparison.",
        "Create the customer session and return success.",
    ]),
    PageBreak(),
])

story.extend([
    step_title(14, "Issue a temporary secure customer session"),
    code("""
const sessionToken = crypto.randomBytes(32).toString("base64url");
"""),
    p("Store only a SHA-256 hash of the token in Redis with a seven-day TTL. The value should contain the verified E.164 phone and creation time."),
    code("""
Set-Cookie: gac_customer_session=<token>;
HttpOnly;
Secure;
SameSite=Lax;
Path=/;
Max-Age=604800
"""),
    bullets([
        "Do not store the session in localStorage.",
        "Disable Secure only for local HTTP development.",
        "Invalidate the Redis session during logout.",
        "Replace this temporary session with the full customer-auth implementation later.",
    ]),
    Spacer(1, 7 * mm),
    step_title(15, "Replace the current dummy React flow"),
    p("The existing UI uses four OTP inputs. Change it to six:"),
    code("""
const [otp, setOtp] = useState(["", "", "", "", "", ""]);
"""),
    h2("Send OTP"),
    code("""
const response = await fetch("/api/auth/otp/request", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ phone: loginPhone })
});
"""),
    h2("Verify OTP"),
    code("""
const response = await fetch("/api/auth/otp/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    phone: loginPhone,
    code: otp.join("")
  })
});
"""),
    p("Open the dashboard only after the verification endpoint succeeds. Remove every Dummy OTP message and the current any-four-digits behavior."),
    PageBreak(),
])

story.extend([
    step_title(16, "Configure and deploy on Vercel"),
    p("Open Vercel -> Project -> Settings -> Environment Variables and add:"),
    code("""
WHATSAPP_GRAPH_VERSION
WHATSAPP_CLOUD_API_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_TEMPLATE_NAME
WHATSAPP_TEMPLATE_LANGUAGE
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
OTP_HASH_SECRET
CUSTOMER_SESSION_SECRET
CUSTOMER_SESSION_TTL_SECONDS
APP_ORIGIN
NODE_ENV
"""),
    bullets([
        "Use test Meta credentials for Preview deployments.",
        "Use the official sender and permanent token only in Production.",
        "Do not prefix any secret with REACT_APP_.",
        "Redeploy after changing environment variables.",
    ]),
    h2("Safe rollout order"),
    numbered([
        "Create the Meta app and use the Meta test number.",
        "Add a controlled test recipient.",
        "Send a template manually through the official API collection.",
        "Create Upstash Redis and verify TTL behavior.",
        "Implement and test otp/request.",
        "Implement and test otp/verify, reuse rejection and expiry.",
        "Add the secure session cookie.",
        "Connect the React login in a Vercel Preview deployment.",
        "Connect the official business number and approved GAC template.",
        "Add production credentials and release.",
    ]),
    PageBreak(),
])

story.extend([
    h1("Production acceptance checklist"),
    bullets([
        "The OTP contains exactly six digits.",
        "The OTP expires after five minutes.",
        "A successful OTP cannot be reused.",
        "Resending is blocked for 30 seconds.",
        "Phone and IP hourly limits are enforced.",
        "Five incorrect attempts invalidate the OTP.",
        "The Meta token does not appear in the browser bundle.",
        "The Redis token does not appear in the browser bundle.",
        "OTP values never appear in application logs.",
        "The session cookie is HttpOnly and Secure in production.",
        "API responses do not reveal whether a phone is registered.",
        "Login succeeds from two separate devices.",
        "Meta test credentials are absent from production.",
        "The Graph API version is configuration-driven.",
    ]),
    h1("Common troubleshooting"),
    h2("Meta returns template not found"),
    p("Confirm the exact approved template name, language code and WhatsApp Business Account. Template names are case-sensitive and the sender must belong to the same account."),
    h2("Meta accepts the request but no WhatsApp arrives"),
    p("Check that the recipient is a registered test recipient during development, inspect the returned wamid, confirm the number uses country code digits and review the message status in WhatsApp Manager."),
    h2("Authentication template is unavailable or rejected"),
    p("Verify business eligibility, payment configuration and template category. Use Meta's preset Authentication category with a supported OTP button rather than a custom utility message."),
    h2("OTP always appears expired"),
    p("Confirm the application is using the same Upstash database and normalized E.164 key in both endpoints. Check the key TTL immediately after request and verify that Preview and Production variables are not mixed."),
    h2("Works locally but fails on Vercel"),
    p("Check Vercel function logs, environment scope, APP_ORIGIN, Secure-cookie behavior and whether every secret was followed by a redeploy."),
    PageBreak(),
])

story.extend([
    h1("Official references"),
    p("Use these sources to confirm current dashboard labels, API payloads and platform behavior before production rollout."),
    bullets([
        "Meta WhatsApp Cloud API official Postman collection: <link href='https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api' color='#0B64B4'>postman.com/meta/whatsapp-business-platform</link>",
        "Meta for Developers: <link href='https://developers.facebook.com/' color='#0B64B4'>developers.facebook.com</link>",
        "Meta Business Manager: <link href='https://business.facebook.com/' color='#0B64B4'>business.facebook.com</link>",
        "Upstash Redis connection guide: <link href='https://upstash.com/docs/redis/howto/connect-with-upstash-redis' color='#0B64B4'>upstash.com/docs/redis/howto/connect-with-upstash-redis</link>",
        "Upstash TypeScript SDK: <link href='https://upstash.com/docs/redis/sdks/ts/getstarted' color='#0B64B4'>upstash.com/docs/redis/sdks/ts/getstarted</link>",
        "Upstash rate-limit SDK: <link href='https://upstash.com/docs/redis/sdks/ratelimit-ts/overview' color='#0B64B4'>upstash.com/docs/redis/sdks/ratelimit-ts/overview</link>",
        "Vercel environment variables: <link href='https://vercel.com/docs/projects/environment-variables' color='#0B64B4'>vercel.com/docs/projects/environment-variables</link>",
    ]),
    Spacer(1, 10 * mm),
    callout("Next implementation action", "After the Meta test sender, approved template, Phone Number ID and Upstash database are ready, implement the two Vercel endpoints and replace the current four-digit dummy flow with the six-digit API-backed flow.", "green"),
])

doc.build(story)
print(OUTPUT)
