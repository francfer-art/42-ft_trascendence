import nodemailer from 'nodemailer';

// Without SMTP credentials no email is sent and new accounts are verified on
// signup (e.g. on Railway, where outbound SMTP is only allowed on the Pro plan).
export const isEmailEnabled = Boolean(
  process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD,
);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
  // Fail fast instead of hanging the request when SMTP is unreachable
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

async function sendMail(to: string, subject: string, content: string) {
  if (!isEmailEnabled) {
    console.warn(
      `[Email] SMTP is not configured, skipping "${subject}" to ${to}`,
    );
    return;
  }

  await transporter.sendMail({
    from: `"Villainous" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html: emailLayout(content),
  });
}

// ── Shared layout wrapper ────────────────────────────────────────────────────

function emailLayout(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin:0;padding:0;background:#05070a;font-family:Georgia,serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#05070a;padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

              <!-- Header -->
              <tr>
                <td style="padding:0 0 28px;">
                  <p style="margin:0;font-size:2rem;font-weight:700;color:#d4a52c;letter-spacing:0.08em;">
                    Villainous
                  </p>
                  <p style="margin:4px 0 0;font-size:0.85rem;font-style:italic;color:#4b5563;letter-spacing:0.05em;">
                    It's good to be bad
                  </p>
                </td>
              </tr>

              <!-- Card -->
              <tr>
                <td style="background:#07090e;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:40px 36px;">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 0 0;text-align:center;">
                  <p style="margin:0;font-size:0.75rem;color:#4b5563;">
                    If you didn't request this, you can safely ignore this email.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function ctaButton(href: string, label: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr>
        <td align="center">
          <a href="${href}"
             style="display:inline-block;padding:13px 36px;background:#d4a52c;color:#05070a;
                    text-decoration:none;border-radius:8px;font-family:Georgia,serif;
                    font-size:0.95rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;"/>`;
}

// ── Email functions ──────────────────────────────────────────────────────────

interface VerificationEmailParams {
  email: string;
  name: string;
  confirmationUrl: string;
}

export async function sendVerificationEmail({ email, name, confirmationUrl }: VerificationEmailParams) {
  const content = `
    <h1 style="margin:0 0 8px;font-size:1.5rem;font-weight:700;color:#e8dfc5;letter-spacing:0.06em;">
      Welcome, ${name}!
    </h1>
    <p style="margin:0 0 20px;font-size:0.9rem;color:#aaa69b;line-height:1.6;">
      Thanks for joining. Confirm your email address to activate your account.
    </p>
    ${divider()}
    <p style="margin:0;font-size:0.88rem;color:#e8dfc5;">
      Click the button below to verify your email:
    </p>
    ${ctaButton(confirmationUrl, 'Confirm my email')}
    ${divider()}
    <p style="margin:0;font-size:0.78rem;color:#4b5563;">
      This link expires in <strong style="color:#aaa69b;">24 hours</strong>.
      If you can't click the button, copy this URL:
    </p>
    <p style="margin:8px 0 0;font-size:0.75rem;color:#4b5563;word-break:break-all;">
      ${confirmationUrl}
    </p>
  `;

  await sendMail(email, 'Confirm your Villainous account', content);
}

interface SendPasswordResetEmailParams {
  email: string;
  name: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({ email, name, resetUrl }: SendPasswordResetEmailParams) {
  const content = `
    <h1 style="margin:0 0 8px;font-size:1.5rem;font-weight:700;color:#e8dfc5;letter-spacing:0.06em;">
      Reset your password
    </h1>
    <p style="margin:0 0 20px;font-size:0.9rem;color:#aaa69b;line-height:1.6;">
      Hello <strong style="color:#e8dfc5;">${name}</strong>,
      we received a request to reset your password.
    </p>
    ${divider()}
    <p style="margin:0;font-size:0.88rem;color:#e8dfc5;">
      Click the button below to choose a new password:
    </p>
    ${ctaButton(resetUrl, 'Reset my password')}
    ${divider()}
    <p style="margin:0;font-size:0.78rem;color:#4b5563;">
      This link expires in <strong style="color:#aaa69b;">1 hour</strong>.
      If you can't click the button, copy this URL:
    </p>
    <p style="margin:8px 0 0;font-size:0.75rem;color:#4b5563;word-break:break-all;">
      ${resetUrl}
    </p>
  `;

  await sendMail(email, 'Reset your Villainous password', content);
}
