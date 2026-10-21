import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { StoreSetting } from './models/store-setting.model';
import { StoreSettingsService } from './store-settings.service';

@Module({
  imports: [SequelizeModule.forFeature([StoreSetting])],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
