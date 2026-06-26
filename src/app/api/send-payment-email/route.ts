import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email, planName, amount, mins } = await req.json();

    if (!email || !planName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from: 'Storio <noreply@storybit.tech>',
      to: email,
      subject: `Your Storio ${planName} plan is active!`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #e5e5e5;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:36px 40px 28px;border-bottom:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#1d1d1f;letter-spacing:-0.5px;">storio</p>
              <p style="margin:0;font-size:13px;color:#6e6e73;font-weight:400;">AI Script Writing Platform</p>
            </td>
          </tr>

          <!-- Success icon + message -->
          <tr>
            <td style="padding:36px 40px 24px;text-align:center;">
              <div style="width:60px;height:60px;background:#d1fae5;border:1px solid #a7f3d0;border-radius:50%;margin:0 auto 20px;display:inline-flex;align-items:center;justify-content:center;">
                <span style="font-size:28px;line-height:1;">✓</span>
              </div>
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#1d1d1f;">Payment confirmed!</h1>
              <p style="margin:0;font-size:14px;color:#6e6e73;line-height:1.6;">
                Your <strong style="color:#1d1d1f;">storio ${planName}</strong> plan is now active.<br/>
                Start creating your next script right away.
              </p>
            </td>
          </tr>

          <!-- Order summary -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e5e5e5;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#6e6e73;">Plan</td>
                        <td align="right" style="font-size:12px;font-weight:600;color:#1d1d1f;">storio ${planName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #e5e5e5;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#6e6e73;">Script generation</td>
                        <td align="right" style="font-size:12px;font-weight:600;color:#1d1d1f;">${mins} minutes</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#6e6e73;">Amount paid</td>
                        <td align="right" style="font-size:14px;font-weight:700;color:#1d1d1f;">₹${amount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <a href="https://www.storio.tech" style="display:inline-block;background:#1d1d1f;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">
                Start writing scripts →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a1a1a6;line-height:1.6;">
                If you have any questions, contact us at Support@storio.tech<br/>
                © ${new Date().getFullYear()} Morpho Technologies Pvt Ltd
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error('[send-payment-email]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[send-payment-email]', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
