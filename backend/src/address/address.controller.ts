import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/address.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('address')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  create(@Req() req, @Body() createAddressDto: CreateAddressDto) {
    return this.addressService.create(req.user.customerId, createAddressDto);
  }

  @Get()
  findAll(@Req() req) {
    return this.addressService.findAll(req.user.customerId);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.addressService.remove(req.user.customerId, id);
  }

  @Post(':id/default')
  setDefault(@Req() req, @Param('id') id: string) {
    return this.addressService.setDefault(req.user.customerId, id);
  }
}
