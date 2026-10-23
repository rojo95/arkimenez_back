import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface VariantOptionValueAttributes {
  variantId: string;
  attributeValueId: string;
}

@Table({
  tableName: 'variant_option_values',
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class VariantOptionValue extends Model<
  VariantOptionValueAttributes,
  VariantOptionValueAttributes
> {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare variantId: string;

  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare attributeValueId: string;
}
