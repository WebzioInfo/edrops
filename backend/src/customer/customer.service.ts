import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';
import { AccountStatus } from '@prisma/client';
import { normalizePhoneNumber } from '../common/phone-utils';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

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
      sendSetupLink,
    } = createCustomerDto;

    // Phone Validation & Normalization
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      throw new BadRequestException('Please enter a valid mobile number.');
    }

    // Email Validation & Normalization
    let normalizedEmail: string | undefined = undefined;
    if (email && typeof email === 'string' && email.trim()) {
      normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        throw new BadRequestException('Please enter a valid email address.');
      }
    }

    // If created by a distributor or referralCode provided, derive referral attribution
    let appliedReferralCode: string | null = null;
    let createdFrom = 'Registration';
    let referringDistributor: any = null;

    if (createdByUserId) {
      createdFrom = 'Admin Panel';
      const creator = await this.prisma.user.findUnique({
        where: { id: createdByUserId },
        include: { distributor: true },
      });
      if (creator?.role === 'DISTRIBUTOR') {
        if (!creator.distributor?.referralCode) {
          throw new BadRequestException('Distributor does not have an assigned referral code. Cannot onboard customer.');
        }
        appliedReferralCode = creator.distributor.referralCode;
        referringDistributor = creator.distributor;
        createdFrom = 'Distributor Portal';

        // Validate client passed referral code if provided
        if (referralCode && referralCode.trim().toUpperCase() !== appliedReferralCode.toUpperCase()) {
          throw new BadRequestException('Invalid referral code. It must match your assigned distributor code.');
        }

        // Email is mandatory for Quick Customer Creation onboarding
        if (!normalizedEmail) {
          throw new BadRequestException('Email address is required for customer account onboarding.');
        }
      }
    }

    if (!referringDistributor && referralCode) {
      const dist = await this.prisma.distributor.findFirst({
        where: { referralCode: { equals: referralCode.trim(), mode: 'insensitive' } },
        include: { user: true },
      });
      if (dist) {
        appliedReferralCode = dist.referralCode;
        referringDistributor = dist;
      }
    }

    // Duplicate Phone Check
    const existingPhone = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { phone }],
      },
    });
    if (existingPhone) {
      throw new BadRequestException('Phone number is already registered.');
    }

    // Duplicate Email Check
    if (normalizedEmail) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      });
      if (existingEmail) {
        throw new BadRequestException('This email is already registered.');
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

    // Account activation / password setup logic
    // Any customer created with an email defaults to PENDING_PASSWORD_SETUP flow
    const requiresSetup = Boolean(normalizedEmail);
    const accountStatus = requiresSetup
      ? AccountStatus.PENDING_PASSWORD_SETUP
      : AccountStatus.ACTIVE;

    // Password: NEVER expose or return plaintext password.
    // If pending setup, use an unguessable crypto random hash so passwordHash is never null/empty
    const effectivePassword =
      password && !requiresSetup ? password : crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(effectivePassword, 10);

    // Cryptographically secure one-time activation token (32 bytes = 64 hex chars)
    let rawActivationToken: string | null = null;
    let activationTokenHash: string | null = null;
    let activationExpiresAt: Date | null = null;

    if (requiresSetup) {
      rawActivationToken = crypto.randomBytes(32).toString('hex');
      activationTokenHash = crypto
        .createHash('sha256')
        .update(rawActivationToken)
        .digest('hex');
      activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    const initialJars =
      jars_at_customer !== undefined
        ? Number(jars_at_customer)
        : jarsAtCustomer !== undefined
        ? Number(jarsAtCustomer)
        : 0;

    // Customer's own referral code (unique)
    let customerOwnCode = referralCode;
    if (!customerOwnCode || customerOwnCode.toUpperCase() === appliedReferralCode?.toUpperCase()) {
      customerOwnCode = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Create via Atomic Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Double-check uniqueness inside transaction
      const dupPhone = await tx.user.findFirst({
        where: { OR: [{ phone: normalizedPhone }, { phone }] },
      });
      if (dupPhone) {
        throw new BadRequestException('Phone number is already registered.');
      }

      if (normalizedEmail) {
        const dupEmail = await tx.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (dupEmail) {
          throw new BadRequestException('This email is already registered.');
        }
      }

      // 2. Create User
      const user = await tx.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          alternatePhone: alternatePhone ? alternatePhone.trim() : null,
          email: normalizedEmail || null,
          gender,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          passwordHash,
          accountStatus,
          role: 'CUSTOMER',
        },
      });

      // 3. Create Password Setup Token if activation is required
      if (requiresSetup && activationTokenHash && activationExpiresAt) {
        await tx.passwordSetupToken.create({
          data: {
            userId: user.id,
            tokenHash: activationTokenHash,
            expiresAt: activationExpiresAt,
            createdBy: createdByUserId,
            purpose: 'ACCOUNT_ACTIVATION',
          },
        });
      }

      // 4. Create Customer Profile
      const customer = await tx.customer.create({
        data: {
          userId: user.id,
          customerType: customerType || 'RESIDENTIAL',
          gstNumber,
          companyName: companyName ? companyName.trim() : null,
          contactPerson: contactPerson ? contactPerson.trim() : null,
          businessCategory,
          jarsAtCustomer: initialJars,
          referralCode: customerOwnCode,
          source: appliedReferralCode || referralCode || null,
          referredById,
          createdById: createdByUserId,
          createdFrom,
        },
      });

      // 5. Create Addresses
      if (addresses && addresses.length > 0) {
        await tx.address.createMany({
          data: addresses.map((addr) => ({
            customerId: customer.id,
            houseName: addr.houseName ? addr.houseName.trim() : undefined,
            buildingName: addr.buildingName ? addr.buildingName.trim() : undefined,
            street: addr.street.trim(),
            area: addr.area ? addr.area.trim() : undefined,
            landmark: addr.landmark ? addr.landmark.trim() : undefined,
            city: addr.city.trim(),
            district: addr.district ? addr.district.trim() : undefined,
            state: addr.state.trim() || 'Kerala',
            country: addr.country || 'India',
            zipCode: addr.zipCode.trim(),
            latitude: addr.latitude,
            longitude: addr.longitude,
            googleMapsUrl: addr.googleMapsUrl,
            addressNotes: addr.addressNotes,
            isDefault: addr.isDefault || false,
          })),
        });
      }

      // 6. Create Wallet
      await tx.wallet.create({
        data: {
          customerId: customer.id,
          balance: openingWalletBalance || 0,
        },
      });

      // 7. Delivery Schedule rules
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
              quantity: 1,
              customNotes: deliveryInstructions,
            })),
          });
        }
      }

      // 8. Audit Logs
      await tx.auditLog.create({
        data: {
          userId: createdByUserId || user.id,
          action: 'CUSTOMER_CREATED',
          entityType: 'Customer',
          entityId: customer.id,
          newValues: {
            customerId: customer.id,
            actorId: createdByUserId || user.id,
            distributorId: referringDistributor?.id || null,
            phone: normalizedPhone,
            email: normalizedEmail,
            customerType,
            createdFrom,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: createdByUserId || user.id,
          action: 'CUSTOMER_ACCOUNT_CREATED',
          entityType: 'User',
          entityId: user.id,
          newValues: {
            customerId: customer.id,
            actorId: createdByUserId || user.id,
            distributorId: referringDistributor?.id || null,
            phone: normalizedPhone,
            email: normalizedEmail,
            role: 'CUSTOMER',
            accountStatus,
          },
        },
      });

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

    const referringDistName = referringDistributor
      ? referringDistributor.agencyName ||
        (referringDistributor.user
          ? `${referringDistributor.user.firstName} ${referringDistributor.user.lastName}`.trim()
          : undefined)
      : undefined;

    // Send Onboarding Email (Non-fatal: DB transaction is committed, email failure does NOT roll back account)
    let emailSent = false;
    let emailDeliveryStatus: 'SENT' | 'FAILED' | 'SKIPPED' = 'SKIPPED';

    if (result.user.email) {
      if (requiresSetup && rawActivationToken) {
        try {
          emailSent = await this.mailService.sendAccountSetupEmail(
            result.user,
            rawActivationToken,
            { distributorName: referringDistName },
          );
          emailDeliveryStatus = emailSent ? 'SENT' : 'FAILED';
        } catch (err: any) {
          this.logger.error(
            `Failed to send account setup email to ${result.user.email}: ${err.message}`,
          );
          emailSent = false;
          emailDeliveryStatus = 'FAILED';
        }
      } else {
        try {
          await this.mailService.sendWelcomeEmail(result.user);
          emailSent = true;
          emailDeliveryStatus = 'SENT';
        } catch {
          emailDeliveryStatus = 'FAILED';
        }
      }

      // Record audit log for email outcome
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: createdByUserId || result.user.id,
            action: emailSent ? 'WELCOME_EMAIL_SENT' : 'WELCOME_EMAIL_FAILED',
            entityType: 'User',
            entityId: result.user.id,
            newValues: {
              customerId: result.customer.id,
              actorId: createdByUserId || result.user.id,
              distributorId: referringDistributor?.id || null,
              email: result.user.email,
              status: emailDeliveryStatus,
            },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to record email audit log: ${err.message}`);
      }
    }

    return {
      success: true,
      customerId: result.customer.id,
      accountCreated: true,
      accountStatus: result.user.accountStatus,
      emailSent,
      emailDeliveryStatus,
      message: emailSent
        ? `Customer created successfully. Account activated and welcome email sent to ${result.user.email}.`
        : `Customer account created, but the welcome email could not be sent.`,
      customerName: `${result.user.firstName} ${result.user.lastName}`,
      email: result.user.email,
      phone: result.user.phone,
      referralCode: appliedReferralCode || undefined,
      referredByDistributorId: referringDistributor?.id || undefined,
      referredByDistributorName: referringDistName,
      activationPending: requiresSetup,
      activationEmailSent: emailSent,
    };
  }

  async resendSetupLink(customerId: string, staffUserId?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { user: true },
    });

    if (!customer || !customer.user) {
      throw new NotFoundException('Customer not found');
    }

    if (!customer.user.email) {
      throw new BadRequestException('Customer does not have an email address to send setup link to.');
    }

    if (customer.user.accountStatus === AccountStatus.ACTIVE) {
      throw new BadRequestException('Customer account is already activated.');
    }

    // Rate Limiting: check if a token was created within the last 60 seconds
    if (this.prisma.passwordSetupToken?.findFirst) {
      const recentToken = await this.prisma.passwordSetupToken.findFirst({
        where: {
          userId: customer.user.id,
          createdAt: { gt: new Date(Date.now() - 60000) },
        },
      });
      if (recentToken) {
        throw new BadRequestException('A welcome email was recently sent. Please wait 60 seconds before requesting another.');
      }
    }

    // Tenant / Distributor permission check
    let referringDistName: string | undefined = undefined;
    if (staffUserId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: staffUserId },
        include: { distributor: true },
      });
      if (actor?.role === 'DISTRIBUTOR') {
        const distCode = actor.distributor?.referralCode?.toUpperCase();
        const matchesAttribution =
          customer.createdById === staffUserId ||
          (customer.source && distCode && customer.source.toUpperCase() === distCode);
        if (!matchesAttribution) {
          throw new BadRequestException('You do not have permission to resend welcome email for this customer.');
        }
        referringDistName = actor.distributor?.agencyName || `${actor.firstName} ${actor.lastName}`.trim();
      }
    }

    // Invalidate existing unused tokens for this user
    await this.prisma.passwordSetupToken.updateMany({
      where: {
        userId: customer.user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate new 32-byte crypto token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.passwordSetupToken.create({
      data: {
        userId: customer.user.id,
        tokenHash,
        expiresAt,
        createdBy: staffUserId,
        purpose: 'ACCOUNT_ACTIVATION',
      },
    });

    let emailSent = false;
    try {
      emailSent = await this.mailService.sendAccountSetupEmail(
        customer.user,
        rawToken,
        { distributorName: referringDistName },
      );
    } catch (err: any) {
      this.logger.error(`Failed to send account setup email: ${err.message}`);
      emailSent = false;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: staffUserId || customer.user.id,
          action: emailSent ? 'WELCOME_EMAIL_RESENT' : 'WELCOME_EMAIL_FAILED',
          entityType: 'User',
          entityId: customer.user.id,
          newValues: {
            customerId: customer.id,
            email: customer.user.email,
            status: emailSent ? 'SENT' : 'FAILED',
            expiresAt,
          },
        },
      });
    } catch {
      // Non-fatal
    }

    if (!emailSent) {
      return {
        success: false,
        emailSent: false,
        message: 'Welcome email could not be sent. Please check email address or try again later.',
      };
    }

    return {
      success: true,
      emailSent: true,
      message: `Welcome email resent successfully to ${customer.user.email}.`,
    };
  }

  async findAll() {
    const customers = await this.prisma.customer.findMany({
      include: {
        user: true,
        addresses: true,
        wallet: true,
        jarBalances: true,
        jarDeposits: true,
        deliverySchedule: {
          include: {
            rules: true,
          },
        },
      },
      orderBy: { user: { createdAt: 'desc' } },
    });

    const creatorIds = Array.from(
      new Set(customers.map((c) => c.createdById).filter(Boolean)),
    ) as string[];

    const creators = creatorIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            distributor: {
              select: {
                id: true,
                referralCode: true,
                agencyName: true,
              },
            },
          },
        })
      : [];
    const creatorMap = new Map(creators.map((u) => [u.id, u]));

    const sourceCodes = Array.from(
      new Set(customers.map((c) => c.source).filter(Boolean)),
    ) as string[];
    const distByCode = sourceCodes.length > 0
      ? await this.prisma.distributor.findMany({
          where: { referralCode: { in: sourceCodes } },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : [];
    const distCodeMap = new Map(distByCode.map((d) => [d.referralCode.toUpperCase(), d]));

    return customers.map((c) => {
      const creator = c.createdById ? creatorMap.get(c.createdById) : null;
      const distFromCode = c.source ? distCodeMap.get(c.source.toUpperCase()) : null;

      const code = c.source || creator?.distributor?.referralCode || distFromCode?.referralCode || null;
      let distributorName: string | null = null;
      let distributorId: string | null = null;
      if (distFromCode) {
        distributorId = distFromCode.id;
        distributorName = distFromCode.agencyName || `${distFromCode.user.firstName} ${distFromCode.user.lastName}`.trim();
      } else if (creator?.distributor) {
        distributorId = creator.distributor.id;
        distributorName = creator.distributor.agencyName || `${creator.firstName} ${creator.lastName}`.trim();
      } else if (creator && creator.role === 'DISTRIBUTOR') {
        distributorId = creator.id;
        distributorName = `${creator.firstName} ${creator.lastName}`.trim();
      }

      const referralInfo = code ? {
        code,
        distributorId: distributorId || undefined,
        distributorName: distributorName || 'Edrops Distributor',
        isDistributor: true,
      } : null;

      return {
        ...c,
        jars_at_customer: c.jarsAtCustomer,
        referredByDistributorId: distributorId,
        referredByDistributorName: distributorName,
        referralInfo,
      };
    });
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

    let referralInfo: { code: string; distributorId?: string; distributorName: string; isDistributor: boolean } | null = null;
    let distId: string | null = null;
    let distName: string | null = null;

    if (customer.source || customer.createdById) {
      let code = customer.source || null;

      if (code) {
        const dist = await this.prisma.distributor.findFirst({
          where: { referralCode: { equals: code, mode: 'insensitive' } },
          include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (dist) {
          distId = dist.id;
          distName = dist.agencyName || `${dist.user.firstName} ${dist.user.lastName}`.trim();
        }
      }

      if (!distName && customer.createdById) {
        const creator = await this.prisma.user.findUnique({
          where: { id: customer.createdById },
          select: {
            firstName: true,
            lastName: true,
            role: true,
            distributor: { select: { id: true, referralCode: true, agencyName: true } },
          },
        });
        if (creator?.distributor?.referralCode) {
          code = creator.distributor.referralCode;
          distId = creator.distributor.id;
          distName = creator.distributor.agencyName || `${creator.firstName} ${creator.lastName}`.trim();
        }
      }

      if (code) {
        referralInfo = {
          code,
          distributorId: distId || undefined,
          distributorName: distName || 'Edrops Distributor',
          isDistributor: true,
        };
      }
    }

    return {
      ...customer,
      jars_at_customer: customer.jarsAtCustomer,
      referredByDistributorId: distId,
      referredByDistributorName: distName,
      referralInfo,
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

      // Check phone uniqueness with normalization if phone is changing
      let normalizedPhone: string | undefined = undefined;
      if (phone) {
        normalizedPhone = normalizePhoneNumber(phone) || undefined;
        if (!normalizedPhone) {
          throw new BadRequestException('Please enter a valid mobile number.');
        }
        if (normalizedPhone !== existingCustomer.user.phone) {
          const phoneExists = await tx.user.findFirst({
            where: {
              OR: [{ phone: normalizedPhone }, { phone }],
              NOT: { id: existingCustomer.userId },
            },
          });
          if (phoneExists) {
            throw new BadRequestException('Phone number is already registered.');
          }
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
            ...(phone ? { phone: normalizedPhone || phone } : {}),
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
