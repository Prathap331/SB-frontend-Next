import { NextRequest, NextResponse } from 'next/server';

// This endpoint receives webhooks from Razorpay
// Note: In production, you should verify the webhook signature using Razorpay's webhook secret

export async function POST(request: NextRequest) {
  try {
    const webhookPayload = await request.json();
    
    // Log webhook for debugging (remove in production or use proper logging)
    console.log('[Webhook] Received from Razorpay:', JSON.stringify(webhookPayload, null, 2));
    
    // TODO: Verify webhook signature using Razorpay webhook secret
    // const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    // const signature = request.headers.get('X-Razorpay-Signature');
    // Verify signature before processing
    
    const eventType = webhookPayload.event;
    
    // Handle different webhook events
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentData = webhookPayload.payload?.payment?.entity || webhookPayload.payload?.order?.entity;
      const orderId = paymentData?.order_id;
      const paymentId = paymentData?.id;
      const amount = paymentData?.amount;
      
      console.log(`[Webhook] Payment successful - Order: ${orderId}, Payment: ${paymentId}, Amount: ${amount}`);
      
      // Forward to your backend for processing
      // The backend should verify the payment and update user's subscription
      try {
        const backendUrl = 'https://storybit-backend.onrender.com/payments/webhook';
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add any backend auth headers if needed
          },
          body: JSON.stringify(webhookPayload),
        });
        
        if (response.ok) {
          return NextResponse.json({ 
            success: true, 
            message: 'Webhook processed successfully' 
          });
        } else {
          console.error('[Webhook] Backend processing failed:', await response.text());
          return NextResponse.json(
            { success: false, message: 'Backend processing failed' },
            { status: 500 }
          );
        }
      } catch (error) {
        console.error('[Webhook] Error forwarding to backend:', error);
        return NextResponse.json(
          { success: false, message: 'Error forwarding webhook' },
          { status: 500 }
        );
      }
    } else {
      // Log other events but don't process them
      console.log(`[Webhook] Unhandled event type: ${eventType}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Event received but not processed' 
      });
    }
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { success: false, message: 'Invalid webhook payload' },
      { status: 400 }
    );
  }
}

// Handle GET requests (for webhook verification/testing)
export async function GET() {
  return NextResponse.json({ 
    message: 'Razorpay webhook endpoint is active',
    note: 'This endpoint should only receive POST requests from Razorpay'
  });
}

