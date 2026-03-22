import { Hono } from 'hono'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')

export const paymentRouter = new Hono()

// POST /api/v1/payment/checkout
// Stripe Checkout セッションを作成して URL を返す
paymentRouter.post('/checkout', async (c) => {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001'

  try {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          unit_amount: 500,
          product_data: {
            name: 'Orbit サポート',
            description: 'Orbit の開発を応援する',
          },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${frontendUrl}/support/success`,
    cancel_url: `${frontendUrl}/`,
  })

  return c.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    console.error('[payment] Stripe error:', msg)
    return c.json({ error: msg }, 500)
  }
})
