import sequelize from '../config/database.js';
import {
  User,
  ServiceType,
  Service,
  ServiceVariation,
  AvailabilitySlot,
  Booking,
  Notification
} from '../models/index.js';

async function migrate() {
  try {
    console.log('🔄 Iniciando migrações...');

    await sequelize.authenticate();
    console.log('✅ Conexão com banco estabelecida');

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

