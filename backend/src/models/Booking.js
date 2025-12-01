import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  providerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  serviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'services',
      key: 'id'
    }
  },
  serviceVariationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'service_variations',
      key: 'id'
    }
  },
  scheduledDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  scheduledTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Para serviços de múltiplos dias'
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Para serviços de múltiplos dias'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed', 'rejected'),
    defaultValue: 'pending',
    allowNull: false
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Motivo da rejeição pelo prestador'
  },
  suggestedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data sugerida pelo prestador ao rejeitar'
  },
  suggestedTime: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'Horário sugerido pelo prestador ao rejeitar'
  },
  alternativeBookingId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id'
    },
    comment: 'ID da nova contratação criada quando cliente aceita sugestão'
  },
  suggestionRejectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data/hora em que o cliente rejeitou a sugestão do prestador'
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
  tableName: 'bookings'
});

export default Booking;

