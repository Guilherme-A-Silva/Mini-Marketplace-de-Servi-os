import sequelize from '../config/database.js';
import {
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
} from '../models/index.js';

async function migrate() {
  try {
    console.log('🔄 Iniciando migrações...');

    await sequelize.authenticate();
    console.log('✅ Conexão com banco estabelecida');

    // Atualizar enum de notificações primeiro
    console.log('🔄 Atualizando enum de tipos de notificação...');
    try {
      await sequelize.query(`
        DO $$ 
        BEGIN
          -- Adicionar 'booking_confirmed' se não existir
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'booking_confirmed' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_notifications_type')
          ) THEN
            ALTER TYPE enum_notifications_type ADD VALUE 'booking_confirmed';
          END IF;

          -- Adicionar 'booking_rejected' se não existir
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'booking_rejected' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_notifications_type')
          ) THEN
            ALTER TYPE enum_notifications_type ADD VALUE 'booking_rejected';
          END IF;

          -- Adicionar 'booking_completed' se não existir
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'booking_completed' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_notifications_type')
          ) THEN
            ALTER TYPE enum_notifications_type ADD VALUE 'booking_completed';
          END IF;

          -- Adicionar 'suggestion_accepted' se não existir
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'suggestion_accepted' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_notifications_type')
          ) THEN
            ALTER TYPE enum_notifications_type ADD VALUE 'suggestion_accepted';
          END IF;

          -- Adicionar 'suggestion_rejected' se não existir
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'suggestion_rejected' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_notifications_type')
          ) THEN
            ALTER TYPE enum_notifications_type ADD VALUE 'suggestion_rejected';
          END IF;
        END $$;
      `);
      console.log('✅ Enum de tipos de notificação atualizado');
    } catch (error) {
      console.warn('⚠️ Aviso ao atualizar enum (pode já estar atualizado):', error.message);
    }

    // Sincronizar todas as tabelas (alter: true para adicionar novos campos)
    await sequelize.sync({ force: false, alter: true });
    console.log('✅ Tabelas sincronizadas');

    console.log('✅ Migrações concluídas!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro nas migrações:', error);
    process.exit(1);
  }
}

migrate();

