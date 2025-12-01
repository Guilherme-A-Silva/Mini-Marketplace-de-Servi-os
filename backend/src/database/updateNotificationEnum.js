import sequelize from '../config/database.js';

/**
 * Script para atualizar o enum de tipos de notificação no PostgreSQL
 * Execute este script uma vez para adicionar os novos valores ao enum
 */
async function updateNotificationEnum() {
  try {
    console.log('🔄 Atualizando enum de tipos de notificação...');

    // Adicionar novos valores ao enum (se ainda não existirem)
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

    console.log('✅ Enum de tipos de notificação atualizado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao atualizar enum:', error);
    process.exit(1);
  }
}

updateNotificationEnum();

