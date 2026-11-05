// Sales tax through Stripe Tax. Prices on the site are before tax; Stripe adds the right
// state/local tax at checkout from the shipping address. Turn off with STRIPE_TAX=off.
// Stripe Tax must also be switched on in the Stripe dashboard (Settings → Tax) with a head office address.
export const TAX_ENABLED = process.env.STRIPE_TAX !== "off";

// Stripe tax code for the product. General tangible goods by default; set STRIPE_TAX_CODE
// if the accountant picks a more specific code for art prints.
export const TAX_CODE = process.env.STRIPE_TAX_CODE || "txcd_99999999";
export const SHIPPING_TAX_CODE = "txcd_92010001";
