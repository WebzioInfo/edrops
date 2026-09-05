import { OrderStatus } from '@prisma/client';
import {
  isValidTransition,
  isPartnerAllowedTransition,
  VALID_ORDER_TRANSITIONS,
  PARTNER_ALLOWED_TRANSITIONS,
} from './order-state-machine';

describe('OrderStateMachine', () => {
  describe('isValidTransition', () => {
    it('should allow valid transitions from NEW', () => {
      expect(isValidTransition(OrderStatus.NEW, OrderStatus.ASSIGNED)).toBe(true);
      expect(isValidTransition(OrderStatus.NEW, OrderStatus.ACCEPTED_BY_PARTNER)).toBe(true);
      expect(isValidTransition(OrderStatus.NEW, OrderStatus.CANCELLED)).toBe(true);
    });

    it('should disallow same-to-same transitions in transition map', () => {
      expect(isValidTransition(OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.ACCEPTED_BY_PARTNER)).toBe(false);
      expect(isValidTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
      expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.DELIVERED)).toBe(false);
    });

    it('should allow transitions from ACCEPTED_BY_PARTNER to OUT_FOR_DELIVERY', () => {
      expect(isValidTransition(OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
    });

    it('should allow transitions from OUT_FOR_DELIVERY to DELIVERED', () => {
      expect(isValidTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
    });

    it('should disallow invalid backwards transitions', () => {
      expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.NEW)).toBe(false);
      expect(isValidTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.NEW)).toBe(false);
      expect(isValidTransition(OrderStatus.CANCELLED, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
    });
  });

  describe('isPartnerAllowedTransition', () => {
    it('should allow delivery partners to accept assigned orders', () => {
      expect(isPartnerAllowedTransition(OrderStatus.ASSIGNED, OrderStatus.ACCEPTED_BY_PARTNER)).toBe(true);
      expect(isPartnerAllowedTransition(OrderStatus.NEW, OrderStatus.ACCEPTED_BY_PARTNER)).toBe(true);
    });

    it('should allow delivery partners to move to OUT_FOR_DELIVERY', () => {
      expect(isPartnerAllowedTransition(OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
      expect(isPartnerAllowedTransition(OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
    });

    it('should allow delivery partners to mark DELIVERED', () => {
      expect(isPartnerAllowedTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
    });

    it('should disallow delivery partners from cancelling orders', () => {
      expect(isPartnerAllowedTransition(OrderStatus.NEW, OrderStatus.CANCELLED)).toBe(false);
      expect(isPartnerAllowedTransition(OrderStatus.ASSIGNED, OrderStatus.CANCELLED)).toBe(false);
      expect(isPartnerAllowedTransition(OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.CANCELLED)).toBe(false);
      expect(isPartnerAllowedTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED)).toBe(false);
    });
  });
});
