# Functionality Calibration Example

## Score: 3 (Most Features Implemented)

### Excerpt

```typescript
// Cart checkout function
async function checkout(cartId: string, paymentMethod: string): Promise<CheckoutResult> {
  const cart = await getCart(cartId);
  
  if (!cart.items.length) {
    throw new Error('Cart is empty');
  }

  const total = calculateTotal(cart.items);
  const charged = await paymentProvider.charge(paymentMethod, total);

  if (!charged.success) {
    throw new Error('Payment failed');
  }

  await clearCart(cartId);
  
  return { orderId: generateOrderId(), total };
}
```

### Justification

- Core checkout flow works (get cart, charge, clear, return)
- Handles empty cart as an edge case
- Payment failure handled
- Missing edge cases:
  - No inventory check before charging
  - No handling of partial payment failures
  - No order confirmation email
  - No shipping address validation
  - No idempotency for retry safety

### Score: 3
