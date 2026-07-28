import {
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
