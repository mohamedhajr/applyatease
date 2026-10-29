import { APIError } from "better-auth/api";

export async function sendSignInCode(
  apiKey: string,
  from: string,
  email: string,
  code: string,
) {
  if (!apiKey || !from)
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "Email sign-in is not configured yet.",
    });
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Apply at Ease sign-in code",
        text: `Your sign-in code is ${code}. It expires in 5 minutes.\n\nIf you didn't request this code, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "Your code could not be sent. Please try again.",
    });
  }
  if (!response.ok)
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "Your code could not be sent. Please try again.",
    });
}
