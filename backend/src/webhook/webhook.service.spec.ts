import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayProvider } from '../payment/providers/razorpay.provider';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  let service: WebhookService;
  const prismaService = {};
  const razorpayProvider = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RazorpayProvider, useValue: razorpayProvider },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
