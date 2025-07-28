'use client'

import { useCart } from '@/app/context/CartContext'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)


const CheckoutPage = () => {
  const { items } = useCart()

  const handleCheckout = async () => {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })

    const { sessionId } = await res.json()
    const stripe = await stripePromise
    if (!stripe) {
      console.error('Stripe failed to load')
      return
    }
    await stripe.redirectToCheckout({ sessionId })
  }

  return (
    <div className="p-10 bg-white rounded-lg shadow-md">
      <h1 className="text-xl font-bold mb-4">Order summary</h1>
      {items.map(item => (
        <div key={item.id}>
          <p>{item.title} - {item.price} x {item.quantity}</p>
        </div>
      ))}
      <button onClick={handleCheckout} className="mt-4 bg-black text-white p-2 rounded">
        Proceed to Payment
      </button>
    </div>
  )
}


// const CheckoutPage = () => {
//   return (
//     <div className="flex flex-row justify-center min-h-screen bg-gray-100">
//       <div className="checkout-page p-10 bg-white rounded-lg shadow-md">
//         <h1>Checkout</h1>
//         <form className="checkout-form">
//           <div className="form-group">
//             <label htmlFor="name">Name</label>
//             <input type="text" id="name" name="name" placeholder="Enter your name" required />
//           </div>
//           <div className="form-group">
//             <label htmlFor="email">Email</label>
//             <input type="email" id="email" name="email" placeholder="Enter your email" required />
//           </div>
//           <div className="form-group">
//             <label htmlFor="address">Address</label>
//             <input type="text" id="address" name="address" placeholder="Enter your address" required />
//           </div>
//           <div className="form-group">
//             <label htmlFor="card">Card Details</label>
//             <input type="text" id="card" name="card" placeholder="Enter your card details" required />
//           </div>
//           <button type="submit" className="checkout-button">Complete Purchase</button>
//         </form>
//       </div>
//       <div className='item-details bg-gray-50 p-10 rounded-lg shadow-md'>
//         <h2>Item Details</h2>
//         <p>Item Name: Awesome Product</p>
//         <p>Price: $99.99</p>
//         <p>Quantity: 1</p>
//         <p>Total: $99.99</p>
//         <p>Shipping: Free</p>
//         <p>Estimated Delivery: 3-5 business days</p>
//         {/* <p>Payment Method: Credit Card</p>
//         <p>Billing Address: 123 Main St, City, State, Zip</p>
//         <p>Shipping Address: 123 Main St, City, State, Zip</p>
//         <p>Order Summary: You are purchasing an awesome product.</p>
//         <p>Order Confirmation: Your order has been confirmed.</p>
//         <p>Order Status: Processing</p>
//         <p>Order Tracking: You can track your order using the tracking number provided in your email.</p>
//         <p>Order History: You can view your order history in your account.</p>
//         <p>Order Cancellation: You can cancel your order within 24 hours of purchase.</p>
//         <p>Order Return: You can return your order within 30 days of purchase.</p> */}
//         {/* <p>Order Exchange: You can exchange your order within 30 days of purchase.</p>
//         <p>Order Support: If you have any questions or concerns, please contact our support team.</p>
//         <p>Order Feedback: We value your feedback. Please let us know how we can improve.</p>
//         <p>Order Review: Please leave a review for your purchase.</p>
//         <p>Order Rating: Please rate your purchase.</p>
//         <p>Order Recommendation: Would you recommend this product to a friend?</p>
//         <p>Order Referral: Refer a friend and get a discount on your next purchase.</p>
//         <p>Order Loyalty: Join our loyalty program and earn points for every purchase.</p>
//         <p>Order Rewards: Redeem your points for discounts and rewards.</p>
//         <p>Order Promotions: Check out our latest promotions and discounts.</p>
//         <p>Order Coupons: Use promo code for a discount on your next purchase.</p>
//         <p>Order Discounts: Get a discount on your next purchase.</p>
//         <p>Order Offers: Check out our latest offers and deals.</p>
//         <p>Order Deals: Get the best deals on your favorite products.</p>
//         <p>Order Sales: Don't miss our latest sales and discounts.</p>
//         <p>Order Clearance: Check out our clearance section for the best deals.</p>
//         <p>Order Specials: Don't miss our special offers and discounts.</p>
//         <p>Order Bundles: Check out our bundle deals for the best savings.</p>
//         <p>Order Packages: Get the best value with our package deals.</p>
//         <p>Order Subscriptions: Subscribe and save on your favorite products.</p>
//         <p>Order Membership: Join our membership program for exclusive discounts.</p>
//         <div>this is the item that you are going to buy</div> */}
//       </div>
//     </div>
//   )
// }

export default CheckoutPage