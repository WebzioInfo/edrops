import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PromoService } from './promo.service';

describe('PromoService', () => {
  let service: PromoService;
  const prismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromoService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<PromoService>(PromoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
