import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('dashboard')
  getDashboard() {
    return {
      deliverySteps: [
        { label: 'Jar filled', time: '04:20 AM', done: true },
        { label: 'Out for delivery', time: '07:15 AM', done: true },
        { label: 'Expected arrival', time: '08:30 AM', done: false },
      ],
      actions: [
        { icon: 'Package', label: 'Add Pack', detail: 'Manage your jar supply', path: '/customer/recharge' },
        { icon: 'Bell', label: 'Ring Driver', detail: 'Contact delivery partner', path: '/customer/deliveries' },
        { icon: 'MapPin', label: 'Gate Code', detail: 'Access instructions', path: '/customer/settings' },
        { icon: 'Star', label: 'Offers', detail: 'View current discounts', path: '/customer/offers' },
      ]
    };
  }

  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customerService.create(createCustomerDto);
  }

  @Get()
  findAll() {
    return this.customerService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customerService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerService.remove(id);
  }
}
