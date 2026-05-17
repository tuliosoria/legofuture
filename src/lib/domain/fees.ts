/**
 * BrickLink seller fees (simplified model).
 *
 * - BrickLink commission: flat 3% of the item sale price.
 * - Payment processor (PayPal / Stripe): 2.9% + $0.30 on the item sale price.
 * - Shipping: the cost the seller pays out of pocket. Optionally, the buyer
 *   may reimburse some or all of it via `shippingChargedToBuyer`.
 */

export interface FeeBreakdown {
  bricklinkFee: number;
  paymentProcessorFee: number;
  shippingCost: number;
  totalFees: number;
  netToSeller: number;
}

export interface CalculateBrickLinkFeesArgs {
  salePrice: number;
  shippingCost: number;
  shippingChargedToBuyer?: number;
}

const BRICKLINK_COMMISSION_RATE = 0.03;
const PAYMENT_PERCENT_RATE = 0.029;
const PAYMENT_FIXED_FEE = 0.3;

export function calculateBrickLinkFees({
  salePrice,
  shippingCost,
  shippingChargedToBuyer = 0,
}: CalculateBrickLinkFeesArgs): FeeBreakdown {
  const safeSale = Math.max(0, salePrice);
  const safeShipCost = Math.max(0, shippingCost);
  const safeShipCharged = Math.max(0, shippingChargedToBuyer);

  const bricklinkFee = safeSale * BRICKLINK_COMMISSION_RATE;
  const paymentProcessorFee =
    safeSale > 0 ? safeSale * PAYMENT_PERCENT_RATE + PAYMENT_FIXED_FEE : 0;

  const totalFees = bricklinkFee + paymentProcessorFee + safeShipCost;
  const netToSeller = safeSale - bricklinkFee - paymentProcessorFee - safeShipCost + safeShipCharged;

  return {
    bricklinkFee,
    paymentProcessorFee,
    shippingCost: safeShipCost,
    totalFees,
    netToSeller,
  };
}
