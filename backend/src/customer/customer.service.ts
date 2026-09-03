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
      jars_at_customer,
      jarsAtCustomer,
      referralCode,
      referredById,
      password,
      generateRandomPassword,
    } = createCustomerDto;

    // Validation
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      throw new BadRequestException('Phone number is already registered.');
    }
    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email is already registered.');
      }
    }
    if (gstNumber) {
      const existingGst = await this.prisma.customer.findUnique({
        where: { gstNumber },
      });
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

    const initialJars =
      jars_at_customer !== undefined
        ? Number(jars_at_customer)
        : jarsAtCustomer !== undefined
        ? Number(jarsAtCustomer)
        : 0;

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
          jarsAtCustomer: initialJars,
          referralCode,
          referredById,
          createdById: createdByUserId,
          createdFrom: createdByUserId ? 'Admin Panel' : 'Registration',
        },
      });

      // 3. Create Addresses
      if (addresses && addresses.length > 0) {
        await tx.address.createMany({
          data: addresses.map((addr) => ({
            customerId: customer.id,
            houseName: addr.houseName,
            buildingName: addr.buildingName,
            street: addr.street,
            area: addr.area,
            landmark: addr.landmark,
            city: addr.city,
            district: addr.district,
            state: addr.state,
            country: addr.country || 'India',
            zipCode: addr.zipCode,
            latitude: addr.latitude,
            longitude: addr.longitude,
            googleMapsUrl: addr.googleMapsUrl,
            addressNotes: addr.addressNotes,
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
      if (
        preferredTimeSlot ||
        (preferredDeliveryDays && preferredDeliveryDays.length > 0)
      ) {
        const schedule = await tx.deliverySchedule.create({
          data: {
            customerId: customer.id,
          },
        });
        if (preferredDeliveryDays && preferredDeliveryDays.length > 0) {
          await tx.deliveryScheduleRule.createMany({
            data: preferredDeliveryDays.map((day) => ({
              deliveryScheduleId: schedule.id,
              type: 'WEEKLY',
              dayOfWeek: day,
              quantity: 1, // Default to 1, can be customized later
              customNotes: deliveryInstructions,
            })),
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
          },
        });
      }

      return { user, customer };
    });

    // Notify
    let createdByName = 'System';
    if (createdByUserId) {
      const creator = await this.prisma.user.findUnique({
        where: { id: createdByUserId },
      });
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

  async findAll() {
    const customers = await this.prisma.customer.findMany({
      include: {
        user: true,
        addresses: { where: { isDefault: true }, take: 1 },
        wallet: true,
        jarBalances: true,
      },
      orderBy: { user: { createdAt: 'desc' } },
    });
    return customers.map((c) => ({
      ...c,
      jars_at_customer: c.jarsAtCustomer,
    }));
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
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
    if (!customer) return null;
    return {
      ...customer,
      jars_at_customer: customer.jarsAtCustomer,
    };
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    updatedByUserId?: string,
  ) {
    const {
      firstName,
      lastName,
      phone,
      email,
      customerType,
      companyName,
      gstNumber,
      contactPerson,
      businessCategory,
      jars_at_customer,
      jarsAtCustomer,
      addresses,
    } = updateCustomerDto;

    return this.prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findUnique({
        where: { id },
        include: { user: true, addresses: true },
      });

      if (!existingCustomer) {
        throw new BadRequestException('Customer not found');
      }

      // Check phone uniqueness if phone is changing
      if (phone && phone !== existingCustomer.user.phone) {
        const phoneExists = await tx.user.findUnique({ where: { phone } });
        if (phoneExists) {
          throw new BadRequestException('Phone number is already registered.');
        }
      }

      // Check email uniqueness if email is changing
      if (email && email !== existingCustomer.user.email) {
        const emailExists = await tx.user.findUnique({ where: { email } });
        if (emailExists) {
          throw new BadRequestException('Email is already registered.');
        }
      }

      // 1. Update User
      if (firstName || lastName || phone || email !== undefined) {
        await tx.user.update({
          where: { id: existingCustomer.userId },
          data: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            ...(phone ? { phone } : {}),
            ...(email !== undefined ? { email } : {}),
          },
        });
      }

      // 2. Update Customer
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          ...(customerType !== undefined ? { customerType } : {}),
          ...(companyName !== undefined ? { companyName } : {}),
          ...(gstNumber !== undefined ? { gstNumber } : {}),
          ...(contactPerson !== undefined ? { contactPerson } : {}),
          ...(businessCategory !== undefined ? { businessCategory } : {}),
          ...(jars_at_customer !== undefined
            ? { jarsAtCustomer: Number(jars_at_customer) }
            : jarsAtCustomer !== undefined
            ? { jarsAtCustomer: Number(jarsAtCustomer) }
            : {}),
          updatedById: updatedByUserId,
        },
      });

      // 3. Update Address if provided
      if (addresses && addresses.length > 0) {
        const newAddr = addresses[0];
        const defaultAddr = existingCustomer.addresses.find((a) => a.isDefault) || existingCustomer.addresses[0];

        if (defaultAddr) {
          await tx.address.update({
            where: { id: defaultAddr.id },
            data: {
              street: newAddr.street ?? defaultAddr.street,
              city: newAddr.city ?? defaultAddr.city,
              state: newAddr.state ?? defaultAddr.state,
              zipCode: newAddr.zipCode ?? defaultAddr.zipCode,
              country: newAddr.country ?? defaultAddr.country ?? 'India',
              houseName: newAddr.houseName !== undefined ? newAddr.houseName : defaultAddr.houseName,
              buildingName: newAddr.buildingName !== undefined ? newAddr.buildingName : defaultAddr.buildingName,
              area: newAddr.area !== undefined ? newAddr.area : defaultAddr.area,
              landmark: newAddr.landmark !== undefined ? newAddr.landmark : defaultAddr.landmark,
              district: newAddr.district !== undefined ? newAddr.district : defaultAddr.district,
              latitude: newAddr.latitude !== undefined ? newAddr.latitude : defaultAddr.latitude,
              longitude: newAddr.longitude !== undefined ? newAddr.longitude : defaultAddr.longitude,
              googleMapsUrl: newAddr.googleMapsUrl !== undefined ? newAddr.googleMapsUrl : defaultAddr.googleMapsUrl,
              addressNotes: newAddr.addressNotes !== undefined ? newAddr.addressNotes : defaultAddr.addressNotes,
            },
          });
        } else {
          await tx.address.create({
            data: {
              customerId: id,
              street: newAddr.street,
              city: newAddr.city,
              state: newAddr.state,
              zipCode: newAddr.zipCode,
              country: newAddr.country || 'India',
              houseName: newAddr.houseName,
              buildingName: newAddr.buildingName,
              area: newAddr.area,
              landmark: newAddr.landmark,
              district: newAddr.district,
              latitude: newAddr.latitude,
              longitude: newAddr.longitude,
              googleMapsUrl: newAddr.googleMapsUrl,
              addressNotes: newAddr.addressNotes,
              isDefault: true,
            },
          });
        }
      }

      return {
        ...updatedCustomer,
        jars_at_customer: updatedCustomer.jarsAtCustomer,
      };
    });
  }

  remove(id: string) {
    // Soft delete can be implemented by setting isActive = false on User
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id },
        include: { user: true },
      });
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
