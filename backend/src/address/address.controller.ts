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

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req, @Body() createAddressDto: CreateAddressDto) {
    return this.addressService.create(req.user.customerId, createAddressDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req) {
    return this.addressService.findAll(req.user.customerId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req, @Param('id') id: string) {
    return this.addressService.remove(req.user.customerId, id);
  }

  @Post(':id/default')
  @UseGuards(JwtAuthGuard)
  setDefault(@Req() req, @Param('id') id: string) {
    return this.addressService.setDefault(req.user.customerId, id);
  }
}
