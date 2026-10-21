import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface StoreSettingAttributes {
  key: string;
  value: string;
}

@Table({
  tableName: 'store_settings',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class StoreSetting extends Model<
  StoreSettingAttributes,
  StoreSettingAttributes
> {
  @PrimaryKey
  @Column({ type: DataType.STRING(80), allowNull: false })
  declare key: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare value: string;
}
