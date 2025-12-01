import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Discount = sequelize.define('Discount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  serviceVariationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'service_variations',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '0 = Domingo, 1 = Segunda, ..., 6 = Sábado'
  },
  discountPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    },
    comment: 'Percentual de desconto (0-100)'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de início do desconto (opcional, se null é permanente)'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de fim do desconto (opcional)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'discounts'
});

export default Discount;

