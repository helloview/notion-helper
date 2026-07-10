import nodemailer from "nodemailer";
import { getMongoDb } from "./mongodb";

export type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  const fromEmail = process.env.SMTP_FROM || "system@workflowstudio.local";
  
  // 1. Try to send via SMTP (e.g., local mock SMTP or Gmail)
  let sentViaSmtp = false;
  
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "1025", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

  // Only attempt SMTP connection if host is explicitly configured, or if we are in local development fallback
  const shouldAttemptSmtp = !!host || !isProduction;

  if (shouldAttemptSmtp) {
    const targetHost = host || "127.0.0.1";
    try {
      const transportConfig: any = {
        host: targetHost,
        port,
        secure,
        // Set connection timeouts to prevent Vercel function timeout
        connectionTimeout: 3000, 
        greetingTimeout: 3000,
        socketTimeout: 3000,
      };

      if (user && pass) {
        transportConfig.auth = { user, pass };
      }

      const transporter = nodemailer.createTransport(transportConfig);
      await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        text,
        html: html || text,
      });
      sentViaSmtp = true;
      console.log(`[Mailer] Email sent successfully via SMTP to ${to} (${targetHost})`);
    } catch (err: any) {
      console.warn(`[Mailer] SMTP delivery failed to ${to} (Host: ${targetHost}:${port}):`, err.message);
    }
  } else {
    console.log(`[Mailer] No SMTP_HOST configured in production/Vercel. Bypassing SMTP mail transport to prevent timeouts.`);
  }

  // 2. Save email in MongoDB collections 'emails' and 'sent_emails' 
  // so the /test-email mock client page can fetch and display it.
  try {
    const db = await getMongoDb();
    const emailDoc = {
      from: fromEmail,
      to,
      subject,
      text,
      html: html || text,
      createdAt: new Date().toISOString(),
      sentViaSmtp,
    };

    // Insert to both possible collection names for bulletproof compatibility
    await db.collection("emails").insertOne({ ...emailDoc });
    await db.collection("sent_emails").insertOne({ ...emailDoc });
    
    console.log(`[Mailer] Email saved in local db collections for '/test-email' viewer.`);
  } catch (dbErr: any) {
    console.error(`[Mailer] Failed to save email log to MongoDB:`, dbErr.message);
  }

  // Double fallback: Always print the verification details to the console log
  console.log(`\n======================================================`);
  console.log(`[MAIL BOX SIMULATOR]`);
  console.log(`FROM: ${fromEmail}`);
  console.log(`TO: ${to}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`CONTENT: ${text}`);
  console.log(`======================================================\n`);
}
