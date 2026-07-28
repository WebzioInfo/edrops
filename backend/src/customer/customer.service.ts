import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private mailService: MailService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, createdByUserId?: string) {
    const {
      firstName,
      lastName,
      phone,
      alternatePhone,
      email,
      gender,
      dateOfBirth,
      customerType,
      gstNumber,
      companyName,
      contactPerson,
      businessCategory,
      addresses,
      preferredTimeSlot,
      preferredDeliveryDays,
      deliveryInstructions,
      openingWalletBalance,
      openingJarBalance,
      openingDeposit,
      referralCode,
      referredById,
      password,
      generateRandomPassword,
    } = createCustomerDto;

    // Validation
    const existingPhone = await this.prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      throw new BadRequestException('Phone number is already registered.');
    }
    if (email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        throw new BadRequestException('Email is already registered.');
      }
    }
    if (gstNumber) {
      const existingGst = await this.prisma.customer.findUnique({ where: { gstNumber } });
      if (existingGst) {
        throw new BadRequestException('GST Number is already registered.');
      }
    }

    // Password
    let rawPassword = password;
    if (generateRandomPassword || !rawPassword) {
      rawPassword = crypto.randomBytes(6).toString('hex');
    }
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // Create via Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          phone,
          alternatePhone,
          email,
          gender,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          passwordHash,
          role: 'CUSTOMER',
        },
      });

      // 2. Create Customer
      const customer = await tx.customer.create({
        data: {
          userId: user.id,
          customerType: customerType || 'RESIDENTIAL',
          gstNumber,
          companyName,
          contactPerson,
          businessCategory,
          referralCode,
          referredById,
          createdById: createdByUserId,
          createdFrom: createdByUserId ? 'Admin Panel' : 'Registration',
        },
      });

      // 3. Create Addresses
      if (addresses && addresses.length > 0) {
        await tx.address.createMany({
          data: addresses.map(addr => ({
            customerId: customer.id,
            houseName: addr.houseName,
            buildingName: addr.buildingName,
            street: addr.street,
            area: addr.area,
            landmark: addr.landmark,
            city: addr.city,
            state: addr.state,
            country: addr.country || 'India',
            zipCode: addr.zipCode,
            latitude: addr.latitude,
            longitude: addr.longitude,
            isDefault: addr.isDefault || false,
          })),
        });
      }

      // 4. Create Wallet
      await tx.wallet.create({
        data: {
          customerId: customer.id,
          balance: openingWalletBalance || 0,
        },
      });

      // 5. Create Jar Balances
      // Removed default jar balance/deposit/ownership creation since they are now brand-specific
      // They will be created on the fly when required for a specific brand

      // 6. Delivery Schedule rules
      if (preferredTimeSlot || (preferredDeliveryDays && preferredDeliveryDays.length > 0)) {
        const schedule = await tx.deliverySchedule.create({
          data: {
            customerId: customer.id,
          }
        });
        if (preferredDeliveryDays && preferredDeliveryDays.length > 0) {
          await tx.deliveryScheduleRule.createMany({
            data: preferredDeliveryDays.map(day => ({
              deliveryScheduleId: schedule.id,
              type: 'WEEKLY',
              dayOfWeek: day,
              quantity: 1, // Default to 1, can be customized later
              customNotes: deliveryInstructions,
            }))
          });
        }
      }

      // 7. Audit Log
      if (createdByUserId) {
        await tx.auditLog.create({
          data: {
            userId: createdByUserId,
            action: 'CREATE_CUSTOMER',
            entityType: 'Customer',
            entityId: customer.id,
            newValues: { phone, email, customerType },
          }
        });
      }

      return { user, customer };
    });

    // Notify
    let createdByName = 'System';
    if (createdByUserId) {
      const creator = await this.prisma.user.findUnique({ where: { id: createdByUserId } });
      if (creator) createdByName = `${creator.firstName} ${creator.lastName}`;
    }

    this.notificationService.notifyCustomerCreated({
      customerId: result.customer.id,
      customerName: `${result.user.firstName} ${result.user.lastName}`,
      email: result.user.email || undefined,
      phone: result.user.phone,
      customerType: result.customer.customerType || 'RESIDENTIAL',
      createdBy: createdByName,
    });

    if (result.user.email) {
      this.mailService.sendWelcomeEmail(result.user).catch(() => {});
    }

    return {
      message: 'Customer created successfully',
      customerId: result.customer.id,
      password: rawPassword, // Returning generated password to the admin/staff so they can share it
    };
  }

  findAll() {
    return this.prisma.customer.findMany({
      include: {
        user: true,
        addresses: { where: { isDefault: true }, take: 1 },
        wallet: true,
        jarBalances: true,
      },
      orderBy: { user: { createdAt: 'desc' } },
    });
  }

  findOne(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
        addresses: true,
        wallet: true,
        jarBalances: true,
        jarDeposits: true,
        jarOwnerships: true,
        deliverySchedule: { include: { rules: true } },
        deliveries: { orderBy: { scheduledFor: 'desc' }, take: 20 },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        supportTickets: { orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }

  update(id: string, updateCustomerDto: UpdateCustomerDto, updatedByUserId?: string) {
    // Only basic update logic provided here for brevity, full implementation requires transactional updates to related entities.
    return this.prisma.customer.update({
      where: { id },
      data: {
        customerType: updateCustomerDto.customerType,
        companyName: updateCustomerDto.companyName,
        updatedById: updatedByUserId,
      },
    });
  }

  remove(id: string) {
    // Soft delete can be implemented by setting isActive = false on User
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id }, include: { user: true } });
      if (customer) {
        await tx.user.update({
          where: { id: customer.userId },
          data: { isActive: false },
        });
      }
      return { message: 'Customer disabled successfully' };
    });
  }
}
