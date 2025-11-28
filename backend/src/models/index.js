import User from './User.js';
import ServiceType from './ServiceType.js';
import Service from './Service.js';
import ServiceVariation from './ServiceVariation.js';
import AvailabilitySlot from './AvailabilitySlot.js';
import Booking from './Booking.js';
import Notification from './Notification.js';

// Definir relacionamentos

// User -> Service (Prestador tem muitos serviços)
User.hasMany(Service, { foreignKey: 'providerId', as: 'services' });
Service.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });

// User -> Booking (Cliente tem muitas contratações)
User.hasMany(Booking, { foreignKey: 'clientId', as: 'clientBookings' });
Booking.belongsTo(User, { foreignKey: 'clientId', as: 'client' });

// User -> Booking (Prestador recebe muitas contratações)
User.hasMany(Booking, { foreignKey: 'providerId', as: 'providerBookings' });
Booking.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });

// ServiceType -> Service
ServiceType.hasMany(Service, { foreignKey: 'serviceTypeId', as: 'services' });
Service.belongsTo(ServiceType, { foreignKey: 'serviceTypeId', as: 'serviceType' });

// Service -> ServiceVariation
Service.hasMany(ServiceVariation, { foreignKey: 'serviceId', as: 'variations' });
ServiceVariation.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

// User -> AvailabilitySlot
User.hasMany(AvailabilitySlot, { foreignKey: 'providerId', as: 'availabilitySlots' });
AvailabilitySlot.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });

// Booking -> ServiceVariation
Booking.belongsTo(ServiceVariation, { foreignKey: 'serviceVariationId', as: 'variation' });
ServiceVariation.hasMany(Booking, { foreignKey: 'serviceVariationId', as: 'bookings' });

// Booking -> Service
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
Service.hasMany(Booking, { foreignKey: 'serviceId', as: 'bookings' });

// User -> Notification
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Booking -> Notification
Booking.hasMany(Notification, { foreignKey: 'bookingId', as: 'notifications' });
Notification.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

export {
  User,
  ServiceType,
  Service,
  ServiceVariation,
  AvailabilitySlot,
  Booking,
  Notification
};

