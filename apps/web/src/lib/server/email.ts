import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

export interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
	from?: string;
}

export async function sendEmail(options: SendEmailOptions) {
	const resendApiKey = env?.RESEND_API_KEY;
	const resend = resendApiKey ? new Resend(resendApiKey) : null;
	const defaultFrom = env?.RESEND_FROM_EMAIL || 'IsItFun <noreply@frstudios.co.ke>';

	const from = options.from || defaultFrom;
	const to = options.to;
	const subject = options.subject;
	const html = options.html;
	const text = options.text || html.replace(/<[^>]*>?/gm, '');

	if (!resend) {
		console.log(`\n================= [EMAIL MOCK / LOG] =================`);
		console.log(`From: ${from}`);
		console.log(`To: ${to}`);
		console.log(`Subject: ${subject}`);
		console.log(`HTML Payload:\n${html}`);
		console.log(`======================================================\n`);
		return { success: true, id: 'mock-email-id' };
	}

	try {
		const { data, error } = await resend.emails.send({
			from,
			to,
			subject,
			html,
			text
		});

		if (error) {
			console.error(`[Resend Error] Failed to send email to ${to}:`, error);
			throw new Error(error.message || 'Failed to send email via Resend');
		}

		console.log(`[Resend Success] Email sent to ${to}. Message ID: ${data?.id}`);
		return { success: true, id: data?.id };
	} catch (err) {
		console.error(`[Resend Exception] Error sending email to ${to}:`, err);
		throw err;
	}
}

// -------------------------------------------------------------------
// HTML Email Templates
// -------------------------------------------------------------------

function baseEmailTemplate(contentHtml: string): string {
	return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IsItFun</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background-color: #1e293b;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #334155;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .header-bar {
      height: 6px;
      background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
    }
    .content {
      padding: 32px;
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      color: #818cf8;
      margin-bottom: 24px;
      display: inline-block;
      text-decoration: none;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #cbd5e1;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      background-color: #6366f1;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      border-radius: 8px;
      margin-top: 10px;
      margin-bottom: 24px;
      text-align: center;
    }
    .btn:hover {
      background-color: #4f46e5;
    }
    .footer {
      background-color: #0f172a;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #334155;
    }
    .footer a {
      color: #818cf8;
      text-decoration: none;
    }
    .code-box {
      background-color: #0f172a;
      border: 1px dashed #475569;
      padding: 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 18px;
      color: #a855f7;
      text-align: center;
      letter-spacing: 2px;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header-bar"></div>
    <div class="content">
      <a href="https://isitfun.frstudios.co.ke" class="logo">🎮 IsItFun</a>
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} IsItFun Platform. Powered by FRStudios.</p>
    </div>
  </div>
</body>
</html>
`;
}

export async function sendVerificationEmail({
	to,
	url,
	token: _token
}: {
	to: string;
	url: string;
	token?: string;
}) {
	const contentHtml = `
		<h1>Verify your email address</h1>
		<p>Welcome to IsItFun! Please verify your email address to unlock full platform capabilities and start playtesting games.</p>
		<a href="${url}" class="btn">Verify Email Address</a>
		<p>If you didn't create an account on IsItFun, you can safely ignore this email.</p>
		<p style="font-size: 12px; color: #64748b;">Or copy & paste this link into your browser: <br><span style="color: #818cf8;">${url}</span></p>
	`;

	return sendEmail({
		to,
		subject: 'Verify your email address | IsItFun',
		html: baseEmailTemplate(contentHtml)
	});
}

export async function sendPasswordResetEmail({
	to,
	url,
	token: _token
}: {
	to: string;
	url: string;
	token?: string;
}) {
	const contentHtml = `
		<h1>Reset your password</h1>
		<p>We received a request to reset your password for your IsItFun account.</p>
		<a href="${url}" class="btn">Reset Password</a>
		<p>This password reset link will expire shortly. If you did not request a password reset, please ignore this email or contact support if you suspect unauthorized access.</p>
		<p style="font-size: 12px; color: #64748b;">Link: <br><span style="color: #818cf8;">${url}</span></p>
	`;

	return sendEmail({
		to,
		subject: 'Reset your password | IsItFun',
		html: baseEmailTemplate(contentHtml)
	});
}

export async function sendOrganizationInviteEmail({
	to,
	inviterName,
	orgName,
	inviteUrl
}: {
	to: string;
	inviterName: string;
	orgName: string;
	inviteUrl: string;
}) {
	const contentHtml = `
		<h1>You've been invited to join ${orgName}</h1>
		<p><strong>${inviterName}</strong> has invited you to collaborate in the organization <strong>${orgName}</strong> on the IsItFun playtesting platform.</p>
		<a href="${inviteUrl}" class="btn">Accept Invitation</a>
		<p>This invitation will expire in 7 days.</p>
		<p style="font-size: 12px; color: #64748b;">Or visit: <br><span style="color: #818cf8;">${inviteUrl}</span></p>
	`;

	return sendEmail({
		to,
		subject: `Invitation to join ${orgName} on IsItFun`,
		html: baseEmailTemplate(contentHtml)
	});
}

export async function sendAlertEmail({
	to,
	subject,
	title,
	bodyMessage,
	actionUrl,
	actionText
}: {
	to: string;
	subject: string;
	title: string;
	bodyMessage: string;
	actionUrl?: string;
	actionText?: string;
}) {
	const actionBtnHtml =
		actionUrl && actionText ? `<a href="${actionUrl}" class="btn">${actionText}</a>` : '';

	const contentHtml = `
		<h1>${title}</h1>
		<p>${bodyMessage}</p>
		${actionBtnHtml}
	`;

	return sendEmail({
		to,
		subject,
		html: baseEmailTemplate(contentHtml)
	});
}
