import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { normalizeEmail } from '../../shared/utils/email';
import { RolesPermissionsService } from '../roles-permissions/roles-permissions.service';
import { Address } from './models/address.model';
import { User } from './models/user.model';
import type { AddressInput, PublicAddress, PublicUser } from './users.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly rolesPermissions: RolesPermissionsService,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Address) private readonly addressModel: typeof Address,
  ) {}

  async findById(id: string, transaction?: Transaction): Promise<User | null> {
    return this.userModel.findByPk(id, { transaction });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ where: { email: normalizeEmail(email) } });
  }

  async createCustomer(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    return this.sequelize.transaction(async (transaction) => {
      const user = await this.userModel.create(
        {
          name: input.name.trim(),
          email: normalizeEmail(input.email),
          passwordHash: input.passwordHash,
          status: 'ACTIVE',
          isStaff: false,
        },
        { transaction },
      );

      await this.rolesPermissions.assignRole(user.id, 'CUSTOMER', transaction);

      return user;
    });
  }

  async getProfile(userId: string): Promise<PublicUser> {
    return this.toPublicUser(await this.requireUser(userId));
  }

  async updateProfile(userId: string, name: string): Promise<PublicUser> {
    const user = await this.requireUser(userId);
    user.name = name.trim();
    await user.save();
    return this.toPublicUser(user);
  }

  async listAddresses(userId: string): Promise<PublicAddress[]> {
    const addresses = await this.addressModel.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']],
    });
    return addresses.map((address) => this.toPublicAddress(address));
  }

  async createAddress(
    userId: string,
    input: AddressInput,
  ): Promise<PublicAddress> {
    const address = await this.addressModel.create({
      userId,
      ...this.normalizeAddress(input),
    });
    return this.toPublicAddress(address);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    input: AddressInput,
  ): Promise<PublicAddress> {
    const address = await this.requireOwnedAddress(userId, addressId);
    address.set(this.normalizeAddress(input));
    await address.save();
    return this.toPublicAddress(address);
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.requireOwnedAddress(userId, addressId);
    await address.destroy();
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isStaff: user.isStaff,
    };
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHENTICATED,
        'La sesión no es válida o ha expirado',
      );
    }
    return user;
  }

  private async requireOwnedAddress(
    userId: string,
    addressId: string,
  ): Promise<Address> {
    const address = await this.addressModel.findOne({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'La dirección no existe',
      );
    }
    return address;
  }

  private normalizeAddress(input: AddressInput): AddressInput {
    return {
      fullName: input.fullName.trim(),
      line1: input.line1.trim(),
      line2: input.line2?.trim() || null,
      city: input.city.trim(),
      region: input.region.trim(),
      postalCode: input.postalCode.trim(),
      countryCode: input.countryCode.trim().toUpperCase(),
      phone: input.phone.trim(),
    };
  }

  private toPublicAddress(address: Address): PublicAddress {
    return {
      id: address.id,
      fullName: address.fullName,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      countryCode: address.countryCode,
      phone: address.phone,
    };
  }
}
