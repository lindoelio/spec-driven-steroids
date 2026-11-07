# Functionality Calibration Example

## Score: 4 (Full Implementation with Minor Gaps)

### Excerpt

```typescript
async function checkout(
  cartId: string,
  paymentMethod: string,
  shippingAddress: Address,
  options: CheckoutOptions = { idempotencyKey: '' }
): Promise<CheckoutResult> {
  // Idempotency check for retry safety
  if (options.idempotencyKey) {
    const existing = await idempotencyStore.get(options.idempotencyKey);
    if (existing) return existing.result;
  }

  const cart = await getCart(cartId);
  if (!cart.items.length) {
    throw new EmptyCartError();
  }

  // Reserve inventory first
  const reservation = await inventoryService.reserve(cart.items, {
    timeout: 600,
    customerId: cart.customerId
  });
  if (!reservation.success) {
    throw new InsufficientInventoryError(reservation.unavailableItems);
  }

  // Process payment
  const charged = await paymentProvider.charge(paymentMethod, cart.total, {
    idempotencyKey: options.idempotencyKey
  });
  if (!charged.success) {
    await inventoryService.release(reservation.reservationId);
    throw new PaymentFailedError(charged.declineCode, charged.declineMessage);
  }

  // Create order
  const order = await orderRepository.create({
    customerId: cart.customerId,
    items: reservation.items,
    total: cart.total,
    shippingAddress,
    paymentId: charged.chargeId,
    reservationId: reservation.reservationId
  });

  // Async: send confirmation email
  emailService.sendOrderConfirmation(order.id, cart.customerId);

  // Async: clear cart after short delay to allow any last-minute changes
  await delay(100);
  await cartService.clearIfUnchanged(cartId, cart.version);

  return { orderId: order.id, total: order.total, status: 'confirmed' };
}
```

### Justification

- Complete checkout flow with all major features
- Idempotency for safe retries
- Inventory reservation before payment (avoids charging for unavailable items)
- Proper rollback on payment failure (release inventory)
- Async email notification (non-blocking)
- Cart clearing with optimistic concurrency check
- Clear error types for different failure modes

- Minor gap: no support for split shipping (items from different warehouses)
- Would be score 5 if split shipping was supported

### Score: 4
