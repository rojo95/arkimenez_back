import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './models/user.model';
import { PasswordHasher } from './password-hasher';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  providers: [PasswordHasher],
  exports: [PasswordHasher],
})
export class UsersModule {}
