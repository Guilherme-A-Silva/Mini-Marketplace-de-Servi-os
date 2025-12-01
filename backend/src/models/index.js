import User from './User.js';
import ServiceType from './ServiceType.js';
import Service from './Service.js';
import ServiceVariation from './ServiceVariation.js';
import AvailabilitySlot from './AvailabilitySlot.js';
import Booking from './Booking.js';
import Notification from './Notification.js';
import Discount from './Discount.js';
import Review from './Review.js';
import Message from './Message.js';

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

// ServiceVariation -> Discount
ServiceVariation.hasMany(Discount, { foreignKey: 'serviceVariationId', as: 'discounts' });
Discount.belongsTo(ServiceVariation, { foreignKey: 'serviceVariationId', as: 'variation' });

// Booking -> Review (1:1)
Booking.hasOne(Review, { foreignKey: 'bookingId', as: 'review' });
Review.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

// Service -> Review
Service.hasMany(Review, { foreignKey: 'serviceId', as: 'reviews' });
Review.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

// User -> Review (Provider)
User.hasMany(Review, { foreignKey: 'providerId', as: 'providerReviews' });
Review.belongsTo(User, { foreignKey: 'providerId', as: 'provider' });

// User -> Review (Client)
User.hasMany(Review, { foreignKey: 'clientId', as: 'clientReviews' });
Review.belongsTo(User, { foreignKey: 'clientId', as: 'client' });

// User -> Message (Sender)
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

// User -> Message (Receiver)
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

// Booking -> Message
Booking.hasMany(Message, { foreignKey: 'bookingId', as: 'messages' });
Message.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

export {
  User,
  ServiceType,
  Service,
  ServiceVariation,
  AvailabilitySlot,
  Booking,
  Notification,
  Discount,
  Review,
  Message
};

