import { serve } from 'std/http/server.ts'
import { Resend } from 'resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  try {
    const body = await req.json()

    const {
      email,
      planName,
      amount,
      mins,
    } = body

    const data = await resend.emails.send({
      from: 'StoryBit <noreply@storybit.tech>',
      to: [email],
      subject: 'Your StoryBit Subscription is Active 🎉',

      html: `
        <h2>Payment Successful</h2>

        <p>Your subscription is active.</p>

        <p><strong>Plan:</strong> ${planName}</p>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>Minutes:</strong> ${mins}</p>
      `,
    })

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
      }
    )
  }
})