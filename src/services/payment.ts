// Payment service for Razorpay integration

export interface CreateOrderRequest {
  amount: number;
  currency: string;
  target_tier: string;
}

export interface CreateOrderResponse {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
}

// Declare Razorpay type for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}

// Load Razorpay script dynamically
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.body.appendChild(script);
  });
}

// Handle unauthorized errors - remove token and redirect to auth
function handleUnauthorized(): void {
  if (typeof window !== 'undefined') {
    // Clear authentication tokens from localStorage
    localStorage.removeItem('sb-xncfghdikiqknuruurfh-auth-token');
    
    // Redirect to the authentication page
    window.location.href = '/auth';
  }
}

// Get auth token from localStorage
function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const tokenData = localStorage.getItem('sb-xncfghdikiqknuruurfh-auth-token');
  if (tokenData) {
    try {
      const parsedToken = JSON.parse(tokenData);
      return parsedToken.access_token || null;
    } catch (error) {
      console.error('Failed to parse auth token:', error);
      return null;
    }
  }
  return null;
}

// Check if server is ready (returns 200)
// This is needed for Render.com services that spin down after inactivity
export async function checkServerHealth(
  maxRetries: number = 10,
  retryDelay: number = 2000,
  timeout: number = 600000 // 10 minutes
): Promise<void> {
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      throw new Error('Server health check timed out. Please try again in a moment.');
    }

    try {
      const response = await fetch('https://storybit-backend.onrender.com/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        // Server is ready
        return;
      }

      // If not 200, wait and retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    } catch {
      // Network error or server not responding
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw new Error('Server is not responding. Please try again in a moment.');
      }
    }
  }

  // If we've exhausted all retries without getting 200
  throw new Error('Server is taking longer than expected to start. Please try again in a moment.');
}

// Create order on backend
// Note: Backend expects amount in rupees (e.g., 500 for ₹500)
// Backend will convert to paise internally and return the paise amount in response
export async function createOrder(amount: number, targetTier: string): Promise<CreateOrderResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('User not authenticated. Please login first.');
  }

  const response = await fetch('https://storybit-backend.onrender.com/payments/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount: amount, // Amount in INR rupees (backend converts to paise)
      currency: 'INR',
      target_tier: targetTier,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      // Remove token and redirect to auth page
      handleUnauthorized();
      throw new Error('Unauthorized. Please login again.');
    }
    throw new Error(`Failed to create order: ${errorText}`);
  }

  return await response.json();
}

// Initialize Razorpay checkout
export async function initiatePayment(
  orderId: string,
  keyId: string,
  amount: number,
  onSuccess: (paymentId: string, orderId: string) => void,
  onFailure: (error: string) => void
): Promise<void> {
  try {
    await loadRazorpayScript();
  } catch {
    onFailure('Failed to load Razorpay. Please refresh and try again.');
    return;
  }

  const options = {
    key: keyId,
    amount: amount,
    currency: 'INR',
    name: 'StoryBit AI',
    description: 'Subscription Payment',
    order_id: orderId,
    handler: function (response: any) {
      // Note: This is just the frontend confirmation
      // The actual payment confirmation comes from webhook
      onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
    },
    prefill: {
      // You can prefill user details if available
    },
    theme: {
      color: '#000000',
    },
    modal: {
      ondismiss: function () {
        onFailure('Payment cancelled by user');
      },
    },
  };

  try {
    const razorpay = new window.Razorpay(options);
    razorpay.open();
  } catch (error) {
    console.error('Razorpay initialization error:', error);
    onFailure('Failed to initialize payment. Please try again.');
  }
}

// Complete payment flow
export async function processPayment(
  amount: number, // Amount in INR rupees (e.g., 1250 for ₹1250)
  targetTier: string,
  onSuccess: (paymentId: string, orderId: string) => void,
  onFailure: (error: string) => void
): Promise<void> {
  try {
    // Step 0: Check if server is ready (waits for status 200)
    await checkServerHealth();
    
    // Step 1: Create order on backend
    // Backend will convert rupees to paise and return order details
    const orderData = await createOrder(amount, targetTier);
    
    // Step 2: Open Razorpay checkout
    // Use amount from API response (already in paise as per Razorpay requirement)
    await initiatePayment(
      orderData.order_id,
      orderData.key_id,
      orderData.amount, // This is already in paise from the API response
      onSuccess,
      onFailure
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
    onFailure(errorMessage);
  }
}

