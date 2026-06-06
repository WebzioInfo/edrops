import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  const prismaService = {};
  const razorpayProvider = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RazorpayProvider, useValue: razorpayProvider },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
