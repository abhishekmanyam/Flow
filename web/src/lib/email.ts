import emailjs from "@emailjs/browser";

const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

export async function sendInviteEmail(params: {
  toEmail: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
}): Promise<boolean> {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    console.warn("[email] EmailJS not configured — skipping email send");
    return false;
  }
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: params.toEmail,
        workspace_name: params.workspaceName,
        inviter_name: params.inviterName,
        role: params.role,
        invite_link: params.inviteLink,
      },
      PUBLIC_KEY
    );
    return true;
  } catch (err) {
    console.warn("[email] Failed to send invite email:", err);
    return false;
  }
}
