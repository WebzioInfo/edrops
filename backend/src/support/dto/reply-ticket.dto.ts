import {
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

class AttachmentDto {
  @IsNotEmpty()
  fileUrl: string;

  @IsNotEmpty()
  fileName: string;

  @IsNotEmpty()
  fileType: string;
}

export class ReplyTicketDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(4000, { message: 'Message cannot exceed 4000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
