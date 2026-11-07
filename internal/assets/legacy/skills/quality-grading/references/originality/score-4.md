# Originality Calibration Example

## Score: 4 (Mostly Tailored)

### Excerpt

```typescript
// Order fulfillment service - domain-specific
class OrderFulfillmentService {
  constructor(
    private readonly inventory: InventoryClient,
    private readonly payments: PaymentGateway,
    private readonly shipping: ShippingEstimator
  ) {}

  async fulfillOrder(order: Order): Promise<FulfillmentResult> {
    const reserved = await this.inventory.reserveItems(
      order.items,
      { timeout: 300, priority: order.priority }
    );

    if (!reserved.success) {
      await this.handlePartialStock(order, reserved.availableItems);
      return { status: 'partial', reserved: reserved.availableItems };
    }

    const charged = await this.payments.charge(order.customerId, order.total);
    if (!charged.success) {
      await this.inventory.release(reserved.reservationId);
      throw new PaymentDeclinedError(charged.declineReason);
    }

    const shippingLabel = await shipping.createLabel({
      orderId: order.id,
      items: reserved.items,
      expedited: order.priority === 'express'
    });

    return {
      status: 'fulfilled',
      reservationId: reserved.reservationId,
      chargeId: charged.chargeId,
      trackingNumber: shippingLabel.trackingNumber
    };
  }
}
```

### Justification

- Domain-specific concepts: inventory reservation, payment charging, shipping labels
- Problem-specific error handling (partial stock, payment decline)
- Contextual parameter naming (expedited, priority)
- Unique fulfillment flow not found in generic templates
- Still uses some standard patterns (constructor DI, async/await)

### Score: 4
