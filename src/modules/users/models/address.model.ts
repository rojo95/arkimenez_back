import { randomUUID } from 'node:crypto';
import type { Optional } from 'sequelize';
import {
  Column,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface AddressAttributes {
  id: string;
  userId: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

export type AddressCreationAttributes = Optional<
  AddressAttributes,
  'id' | 'line2'
>;

@Table({
  tableName: 'addresses',
  underscored: true,
  timestamps: true,
})
export class Address extends Model<
  AddressAttributes,
  AddressCreationAttributes
> {
  @PrimaryKey
  @Default(() => randomUUID())
  @Column({ type: DataType.UUID, allowNull: false })
  declare id: string;

  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare fullName: string;

  @Column({ type: DataType.STRING(180), allowNull: false })
  declare line1: string;

  @Column({ type: DataType.STRING(180), allowNull: true })
  declare line2: string | null;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare city: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare region: string;

  @Column({ type: DataType.STRING(20), allowNull: false })
  declare postalCode: string;

  @Column({ type: DataType.STRING(2), allowNull: false })
  declare countryCode: string;

  @Column({ type: DataType.STRING(30), allowNull: false })
  declare phone: string;
}
