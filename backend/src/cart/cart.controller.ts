import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { SyncCartDto } from './dto/sync-cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can access cart');
    }
    return this.cartService.getCart(req.user.customerId);
  }

  @Post('sync')
  syncCart(@Req() req, @Body() body: SyncCartDto) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can update cart');
    }
    return this.cartService.syncCart(req.user.customerId, body);
  }

  @Post('items')
  addItem(@Req() req, @Body() body: { productId: string; quantity: number }) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can update cart');
    }
    return this.cartService.addItem(req.user.customerId, body.productId, body.quantity);
  }

  @Delete('items/:productId')
  removeItem(@Req() req, @Param('productId') productId: string) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can update cart');
    }
    return this.cartService.removeItem(req.user.customerId, productId);
  }

  @Delete()
  clearCart(@Req() req) {
    if (!req.user.customerId) {
      throw new BadRequestException('Only customer accounts can clear cart');
    }
    return this.cartService.clearCart(req.user.customerId);
  }
}
