import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CheckoutController', () => {
  let controller: CheckoutController;
  const checkoutService = {
    initializeCheckout: jest.fn(),
  };
  const prismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [
        { provide: CheckoutService, useValue: checkoutService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    controller = module.get<CheckoutController>(CheckoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
