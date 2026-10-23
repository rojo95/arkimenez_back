import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

export interface ProductCategoryAttributes {
  productId: string;
  categoryId: string;
}

@Table({
  tableName: 'product_categories',
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class ProductCategory extends Model<
  ProductCategoryAttributes,
  ProductCategoryAttributes
> {
  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare productId: string;

  @PrimaryKey
  @Column({ type: DataType.UUID, allowNull: false })
  declare categoryId: string;
}
