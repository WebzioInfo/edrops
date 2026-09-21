import { OrderStatus } from '@prisma/client';
import {
  isValidTransition,
  isPartnerAllowedTransition,
  VALID_ORDER_TRANSITIONS,
  PARTNER_ALLOWED_TRANSITIONS,
} from './order-state-machine';

describe('OrderStateMachine', () => {
  describe('isValidTransition', () => {
    it('should allow linear canonical transitions: ORDER_PLACED -> CONFIRMED -> OUT_FOR_DELIVERY -> DELIVERED', () => {
      expect(isValidTransition(OrderStatus.ORDER_PLACED, OrderStatus.CONFIRMED)).toBe(true);
      expect(isValidTransition(OrderStatus.CONFIRMED, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
      expect(isValidTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
    });

    it('should disallow invalid transitions or backwards transitions', () => {
      expect(isValidTransition(OrderStatus.ORDER_PLACED, OrderStatus.DELIVERED)).toBe(false);
      expect(isValidTransition(OrderStatus.CONFIRMED, OrderStatus.ORDER_PLACED)).toBe(false);
      expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
      expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.ORDER_PLACED)).toBe(false);
    });

    it('should disallow same-to-same transitions in transition map', () => {
      expect(isValidTransition(OrderStatus.CONFIRMED, OrderStatus.CONFIRMED)).toBe(false);
      expect(isValidTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.OUT_FOR_DELIVERY)).toBe(false);
      expect(isValidTransition(OrderStatus.DELIVERED, OrderStatus.DELIVERED)).toBe(false);
    });
  });

  describe('isPartnerAllowedTransition', () => {
    it('should allow delivery partners to move to OUT_FOR_DELIVERY and mark DELIVERED', () => {
      expect(isPartnerAllowedTransition(OrderStatus.ACCEPTED_BY_PARTNER, OrderStatus.OUT_FOR_DELIVERY)).toBe(true);
      expect(isPartnerAllowedTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED)).toBe(true);
    });
  });
});
