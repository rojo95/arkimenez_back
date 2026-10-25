import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RolesPermissionsModule } from '../roles-permissions/roles-permissions.module';
import { Address } from './models/address.model';
import { User } from './models/user.model';
import { PasswordHasher } from './password-hasher';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    SequelizeModule.forFeature([User, Address]),
    RolesPermissionsModule,
  ],
  controllers: [UsersController],
  providers: [PasswordHasher, UsersService],
  exports: [PasswordHasher, UsersService],
})
export class UsersModule {}
