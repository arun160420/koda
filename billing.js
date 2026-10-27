const crypto = require('crypto');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const isStripeConfigured = Boolean(
  STRIPE_SECRET_KEY &&
  !STRIPE_SECRET_KEY.startsWith('replace') &&
  STRIPE_SECRET_KEY.startsWith('sk_')
);

let stripe = null;
if (isStripeConfigured) {
  const Stripe = require('stripe');
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  });
}

const TIERS = {
  free: {
    id: 'free',
    name: 'KODA Free',
    priceMonthly: 0,
    uploadLimit: 5,
    losslessStreaming: false,
    vanityRooms: false,
    badge: 'Listener'
  },
  plus: {
    id: 'plus',
    name: 'KODA Plus',
    priceMonthly: 4.99,
    priceId: process.env.STRIPE_PRICE_PLUS || 'price_koda_plus_monthly',
    uploadLimit: 50,
    losslessStreaming: false,
    vanityRooms: false,
    badge: 'Crew'
  },
  pro: {
    id: 'pro',
    name: 'KODA Pro Studio',
    priceMonthly: 9.99,
    priceId: process.env.STRIPE_PRICE_PRO || 'price_koda_pro_monthly',
    uploadLimit: Infinity,
    losslessStreaming: true,
    vanityRooms: true,
    badge: 'PRO'
  }
};

/**
 * Create Stripe Checkout Session for subscription upgrades
 */
async function createCheckoutSession({
  userId,
  userEmail,
  tier = 'pro',
  successUrl = 'http://localhost:3000/?billing=success',
  cancelUrl = 'http://localhost:3000/?billing=cancel'
}) {
  const selectedTier = TIERS[tier] || TIERS.pro;

  if (!isStripeConfigured || !stripe) {
    // Development / Sandbox Fallback
    const sessionId = `mock_cs_${crypto.randomBytes(12).toString('hex')}`;
    return {
      isMock: true,
      sessionId,
      url: `${successUrl}&session_id=${sessionId}&tier=${tier}`,
      tier: selectedTier
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: userEmail,
    client_reference_id: userId,
    line_items: [
      {
        price: selectedTier.priceId,
        quantity: 1
      }
    ],
    metadata: {
      userId,
      tier: selectedTier.id
    },
    success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}&tier=${selectedTier.id}`,
    cancel_url: cancelUrl
  });

  return {
    isMock: false,
    sessionId: session.id,
    url: session.url,
    tier: selectedTier
  };
}

/**
 * Handle incoming Stripe Webhook events
 */
async function handleStripeWebhook({ rawBody, signature, repository }) {
  let event;

  if (isStripeConfigured && stripe && STRIPE_WEBHOOK_SECRET) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      const error = new Error(`Stripe webhook signature verification failed: ${err.message}`);
      error.statusCode = 400;
      throw error;
    }
  } else {
    // Parse JSON payload in test/mock mode
    const str = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    event = typeof str === 'string' ? JSON.parse(str) : str;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.userId;
      const tier = session.metadata?.tier || 'pro';
      const proExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      if (userId && repository) {
        await repository.updateUserTier(userId, tier, proExpiresAt);
      }
      return { handled: true, event: event.type, userId, tier };
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      if (userId && repository) {
        await repository.updateUserTier(userId, 'free', null);
      }
      return { handled: true, event: event.type, userId, tier: 'free' };
    }

    default:
      return { handled: true, event: event.type, ignored: true };
  }
}

/**
 * Create Stripe Connect Express onboarding link for creator payouts
 */
async function createConnectAccountLink({
  userId,
  userEmail,
  returnUrl = 'http://localhost:3000/?connect=success',
  refreshUrl = 'http://localhost:3000/?connect=refresh'
}) {
  if (!isStripeConfigured || !stripe) {
    return {
      isMock: true,
      accountId: `mock_acct_${crypto.randomBytes(8).toString('hex')}`,
      url: `${returnUrl}&mock_onboarded=1`
    };
  }

  const account = await stripe.accounts.create({
    type: 'express',
    email: userEmail,
    metadata: { userId },
    capabilities: {
      transfers: { requested: true }
    }
  });

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });

  return {
    isMock: false,
    accountId: account.id,
    url: accountLink.url
  };
}

/**
 * Virtual Tipping in Creator Listening Rooms with 85/15 creator payout split
 */
async function processRoomTip({ roomId, senderName, senderUserId, amountCents, message, repository }) {
  if (!roomId) throw new Error('roomId is required.');
  const parsedCents = parseInt(amountCents, 10);
  if (!Number.isFinite(parsedCents) || parsedCents <= 0) {
    throw new Error('Valid tip amount in cents is required (minimum 100 cents / $1.00).');
  }

  const platformFeeCents = Math.round(parsedCents * 0.15); // 15% platform commission
  const creatorPayoutCents = parsedCents - platformFeeCents; // 85% creator disbursement

  const tip = {
    id: `tip_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    roomId,
    senderName: senderName || 'Anonymous Fan',
    senderUserId: senderUserId || null,
    amountCents: parsedCents,
    creatorPayoutCents,
    platformFeeCents,
    currency: 'usd',
    message: message || '',
    status: 'completed',
    createdAt: new Date().toISOString()
  };

  if (repository) {
    await repository.addTipTransaction(tip);
  }

  return tip;
}

module.exports = {
  TIERS,
  isStripeConfigured: () => isStripeConfigured,
  createCheckoutSession,
  handleStripeWebhook,
  createConnectAccountLink,
  processRoomTip
};
