import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { RazorpayProvider } from '../payment/providers/razorpay.provider';
import { NotificationService } from '../notification/notification.service';
import { PromoService } from '../promo/promo.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../events/events.gateway';
import { AddressService } from '../address/address.service';
import { SettingsService } from '../settings/settings.service';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
  let service: CheckoutService;
  const prismaService = {};
  const paymentService = {};
  const razorpayProvider = { verifyPaymentSignature: jest.fn() };
  const notificationService = {};
  const promoService = {};
  const auditService = {};
  const eventsGateway = {};
  const addressService = {};
  const settingsService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prismaService },
        { provide: PaymentService, useValue: paymentService },
        { provide: RazorpayProvider, useValue: razorpayProvider },
        { provide: NotificationService, useValue: notificationService },
        { provide: PromoService, useValue: promoService },
        { provide: AuditService, useValue: auditService },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: AddressService, useValue: addressService },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
