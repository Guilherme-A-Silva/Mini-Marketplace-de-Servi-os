import sequelize from '../config/database.js';
import {
  User,
  ServiceType,
  Service,
  ServiceVariation,
  AvailabilitySlot,
  Booking
} from '../models/index.js';
import { ElasticsearchService } from '../services/elasticsearchService.js';

async function seed() {
  try {
    console.log('🌱 Iniciando seed...');

    await sequelize.authenticate();
    console.log('✅ Conexão com banco estabelecida');

    // Limpar dados existentes (opcional - comentar em produção)
    // await Booking.destroy({ where: {} });
    // await ServiceVariation.destroy({ where: {} });
    // await Service.destroy({ where: {} });
    // await AvailabilitySlot.destroy({ where: {} });
    // await ServiceType.destroy({ where: {} });
    // await User.destroy({ where: {} });

    // Criar tipos de serviços
    const [manicureTypeResult, pinturaTypeResult, eletricistaTypeResult] = await Promise.all([
      ServiceType.findOrCreate({
        where: { name: 'Manicure' },
        defaults: { description: 'Serviços de manicure e pedicure' }
      }),
      ServiceType.findOrCreate({
        where: { name: 'Pintura' },
        defaults: { description: 'Serviços de pintura residencial e comercial' }
      }),
      ServiceType.findOrCreate({
        where: { name: 'Eletricista' },
        defaults: { description: 'Serviços elétricos residenciais e comerciais' }
      })
    ]);

    const manicureType = manicureTypeResult[0];
    const pinturaType = pinturaTypeResult[0];
    const eletricistaType = eletricistaTypeResult[0];

    if (!manicureType || !pinturaType || !eletricistaType) {
      throw new Error('Erro ao criar tipos de serviços');
    }

    console.log('✅ Tipos de serviços criados');

    // Criar prestadores
    const [prestador1Result, prestador2Result] = await Promise.all([
      User.findOrCreate({
        where: { email: 'prestador1@test.com' },
        defaults: {
          name: 'Maria Silva',
          email: 'prestador1@test.com',
          password: 'senha123',
          role: 'provider',
          phone: '(11) 98765-4321',
          city: 'São Paulo',
          neighborhood: 'Centro'
        }
      }),
      User.findOrCreate({
        where: { email: 'prestador2@test.com' },
        defaults: {
          name: 'João Santos',
          email: 'prestador2@test.com',
          password: 'senha123',
          role: 'provider',
          phone: '(11) 91234-5678',
          city: 'São Paulo',
          neighborhood: 'Vila Madalena'
        }
      })
    ]);

    const prestador1 = prestador1Result[0];
    const prestador2 = prestador2Result[0];

    if (!prestador1 || !prestador2) {
      throw new Error('Erro ao criar prestadores');
    }

    console.log('✅ Prestadores criados');

    // Criar cliente
    const clienteResult = await User.findOrCreate({
      where: { email: 'cliente@test.com' },
      defaults: {
        name: 'Ana Costa',
        email: 'cliente@test.com',
        password: 'senha123',
        role: 'client',
        phone: '(11) 99999-8888',
        city: 'São Paulo',
        neighborhood: 'Pinheiros'
      }
    });

    const cliente = clienteResult[0];

    if (!cliente) {
      throw new Error('Erro ao criar cliente');
    }

    console.log('✅ Cliente criado');

    // Criar serviços
    const servico1Result = await Service.findOrCreate({
      where: {
        name: 'Manicure Completa',
        providerId: prestador1.id
      },
      defaults: {
        name: 'Manicure Completa',
        description: 'Serviço de manicure excelente, profissional com 20 anos de experiência. Atendimento com qualidade e cuidado.',
        photos: [],
        serviceTypeId: manicureType.id,
        providerId: prestador1.id
      }
    });

    const servico2Result = await Service.findOrCreate({
      where: {
        name: 'Pintura Residencial',
        providerId: prestador2.id
      },
      defaults: {
        name: 'Pintura Residencial',
        description: 'Pintura completa de casas e apartamentos. Trabalho profissional com garantia.',
        photos: [],
        serviceTypeId: pinturaType.id,
        providerId: prestador2.id
      }
    });

    const servico3Result = await Service.findOrCreate({
      where: {
        name: 'Instalação Elétrica',
        providerId: prestador2.id
      },
      defaults: {
        name: 'Instalação Elétrica',
        description: 'Instalações elétricas residenciais e comerciais. Profissional certificado.',
        photos: [],
        serviceTypeId: eletricistaType.id,
        providerId: prestador2.id
      }
    });

    const servico1 = servico1Result[0];
    const servico2 = servico2Result[0];
    const servico3 = servico3Result[0];

    if (!servico1 || !servico2 || !servico3) {
      throw new Error('Erro ao criar serviços');
    }

    console.log('✅ Serviços criados');

    // Criar variações do serviço 1 (Manicure)
    await Promise.all([
      ServiceVariation.findOrCreate({
        where: {
          name: 'Pé',
          serviceId: servico1.id
        },
        defaults: {
          name: 'Pé',
          price: 20.00,
          durationMinutes: 30,
          serviceId: servico1.id
        }
      }),
      ServiceVariation.findOrCreate({
        where: {
          name: 'Pé com pintura',
          serviceId: servico1.id
        },
        defaults: {
          name: 'Pé com pintura',
          price: 30.00,
          durationMinutes: 60,
          serviceId: servico1.id
        }
      }),
      ServiceVariation.findOrCreate({
        where: {
          name: 'Mãos',
          serviceId: servico1.id
        },
        defaults: {
          name: 'Mãos',
          price: 25.50,
          durationMinutes: 30,
          serviceId: servico1.id
        }
      }),
      ServiceVariation.findOrCreate({
        where: {
          name: 'Mãos com pintura',
          serviceId: servico1.id
        },
        defaults: {
          name: 'Mãos com pintura',
          price: 35.00,
          durationMinutes: 60,
          serviceId: servico1.id
        }
      })
    ]);

    // Criar variações do serviço 2 (Pintura)
    await Promise.all([
      ServiceVariation.findOrCreate({
        where: {
          name: 'Pintura de 1 cômodo',
          serviceId: servico2.id
        },
        defaults: {
          name: 'Pintura de 1 cômodo',
          price: 500.00,
          durationMinutes: 480, // 8 horas
          serviceId: servico2.id
        }
      }),
      ServiceVariation.findOrCreate({
        where: {
          name: 'Pintura completa (casa)',
          serviceId: servico2.id
        },
        defaults: {
          name: 'Pintura completa (casa)',
          price: 3000.00,
          durationMinutes: 2880, // 2 dias
          serviceId: servico2.id
        }
      })
    ]);

    // Criar variações do serviço 3 (Eletricista)
    await Promise.all([
      ServiceVariation.findOrCreate({
        where: {
          name: 'Instalação de tomada',
          serviceId: servico3.id
        },
        defaults: {
          name: 'Instalação de tomada',
          price: 80.00,
          durationMinutes: 60,
          serviceId: servico3.id
        }
      }),
      ServiceVariation.findOrCreate({
        where: {
          name: 'Instalação completa (casa nova)',
          serviceId: servico3.id
        },
        defaults: {
          name: 'Instalação completa (casa nova)',
          price: 2000.00,
          durationMinutes: 1440, // 1 dia
          serviceId: servico3.id
        }
      })
    ]);

    console.log('✅ Variações criadas');

    // Criar slots de disponibilidade
    // Prestador 1 - Segunda a Sexta, 9h às 18h
    for (let day = 1; day <= 5; day++) {
      await AvailabilitySlot.findOrCreate({
        where: {
          providerId: prestador1.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00'
        },
        defaults: {
          providerId: prestador1.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          isActive: true
        }
      });
    }

    // Prestador 2 - Segunda a Sábado, 8h às 20h
    for (let day = 1; day <= 6; day++) {
      await AvailabilitySlot.findOrCreate({
        where: {
          providerId: prestador2.id,
          dayOfWeek: day,
          startTime: '08:00',
          endTime: '20:00'
        },
        defaults: {
          providerId: prestador2.id,
          dayOfWeek: day,
          startTime: '08:00',
          endTime: '20:00',
          isActive: true
        }
      });
    }

    console.log('✅ Slots de disponibilidade criados');

    // Indexar serviços no Elasticsearch (opcional - não falha se Elasticsearch não estiver disponível)
    try {
      const services = await Service.findAll();
      let indexedCount = 0;
      for (const service of services) {
        try {
          await ElasticsearchService.indexService(service);
          indexedCount++;
        } catch (error) {
          // Ignora erros individuais
        }
      }
      if (indexedCount > 0) {
        console.log(`✅ ${indexedCount} serviços indexados no Elasticsearch`);
      } else {
        console.log('⚠️  Elasticsearch não disponível - serviços não indexados (opcional)');
      }
    } catch (error) {
      console.log('⚠️  Elasticsearch não disponível - serviços não indexados (opcional)');
    }

    // Criar algumas contratações de exemplo
    const variation1 = await ServiceVariation.findOne({
      where: { name: 'Mãos com pintura', serviceId: servico1.id }
    });

    if (variation1) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await Booking.findOrCreate({
        where: {
          clientId: cliente.id,
          providerId: prestador1.id,
          scheduledDate: dateStr,
          scheduledTime: '14:00'
        },
        defaults: {
          clientId: cliente.id,
          providerId: prestador1.id,
          serviceId: servico1.id,
          serviceVariationId: variation1.id,
          scheduledDate: dateStr,
          scheduledTime: '14:00',
          status: 'confirmed',
          totalPrice: variation1.price
        }
      });
    }

    console.log('✅ Contratações de exemplo criadas');

    console.log('\n✅ Seed concluído com sucesso!');
    console.log('\n📋 Credenciais de teste:');
    console.log('Prestador 1: prestador1@test.com / senha123');
    console.log('Prestador 2: prestador2@test.com / senha123');
    console.log('Cliente: cliente@test.com / senha123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

seed();

