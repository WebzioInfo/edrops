import { PartialType } from '@nestjs/mapped-types';
import { CreateDeliveryDto } from './create-delivery.dto';
import { DeliveryStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDeliveryDto extends PartialType(CreateDeliveryDto) {
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  emptyJarsCollected?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  proofImageUrl?: string;
}
