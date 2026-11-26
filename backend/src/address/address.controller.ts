import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/address.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  /** GET /address/serviceability?pincode=673638 (Public) */
  @Get('serviceability')
  checkServiceability(@Query('pincode') pincode: string) {
    if (!pincode) {
      throw new BadRequestException('pincode query parameter is required');
    }
    return this.addressService.checkServiceability(pincode);
  }

  /** GET /address/check-delivery?pincode=682001 (Public alias) */
  @Get('check-delivery')
  checkDelivery(@Query('pincode') pincode: string) {
    if (!pincode) {
      throw new BadRequestException('pincode query parameter is required');
    }
    return this.addressService.checkServiceability(pincode);
  }

  private getCustomerIdOrThrow(req: any): string {
    const customerId = req.user?.customerId;
    if (!customerId) {
      throw new ForbiddenException('Customer profile required for address operations');
    }
    return customerId;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req, @Body() createAddressDto: CreateAddressDto) {
    return this.addressService.create(this.getCustomerIdOrThrow(req), createAddressDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req) {
    return this.addressService.findAll(this.getCustomerIdOrThrow(req));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req, @Param('id') id: string) {
    return this.addressService.remove(this.getCustomerIdOrThrow(req), id);
  }

  @Post(':id/default')
  @UseGuards(JwtAuthGuard)
  setDefault(@Req() req, @Param('id') id: string) {
    return this.addressService.setDefault(this.getCustomerIdOrThrow(req), id);
  }
}
