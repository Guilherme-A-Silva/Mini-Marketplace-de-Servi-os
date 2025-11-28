import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  node: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200'
});

// Criar índice de serviços se não existir
export async function initElasticsearch() {
  try {
    const indexExists = await client.indices.exists({ index: 'services' });
    
    if (!indexExists) {
      await client.indices.create({
        index: 'services',
        body: {
          mappings: {
            properties: {
              id: { type: 'integer' },
              name: { type: 'text', analyzer: 'standard' },
              description: { type: 'text', analyzer: 'standard' },
              serviceTypeId: { type: 'integer' },
              providerId: { type: 'integer' },
              createdAt: { type: 'date' }
            }
          }
        }
      });
      console.log('✅ Índice Elasticsearch criado');
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar Elasticsearch:', error.message);
  }
}

export default client;

