import client, { initElasticsearch } from '../config/elasticsearch.js';

export class ElasticsearchService {
  static async indexService(service) {
    try {
      await initElasticsearch();
      await client.index({
        index: 'services',
        id: service.id.toString(),
        body: {
          id: service.id,
          name: service.name,
          description: service.description || '',
          serviceTypeId: service.serviceTypeId,
          providerId: service.providerId,
          createdAt: service.createdAt
        }
      });
    } catch (error) {
      console.error('Erro ao indexar serviço:', error);
    }
  }

  static async updateService(service) {
    try {
      await client.update({
        index: 'services',
        id: service.id.toString(),
        body: {
          doc: {
            name: service.name,
            description: service.description || '',
            serviceTypeId: service.serviceTypeId
          }
        }
      });
    } catch (error) {
      console.error('Erro ao atualizar serviço no Elasticsearch:', error);
    }
  }

  static async deleteService(serviceId) {
    try {
      await client.delete({
        index: 'services',
        id: serviceId.toString()
      });
    } catch (error) {
      console.error('Erro ao deletar serviço do Elasticsearch:', error);
    }
  }

  static async searchServices(query, filters = {}) {
    try {
      await initElasticsearch();
      
      const must = [];
      
      if (query) {
        must.push({
          multi_match: {
            query,
            fields: ['name^3', 'description'],
            fuzziness: 'AUTO'
          }
        });
      }

      if (filters.serviceTypeId) {
        must.push({
          term: { serviceTypeId: filters.serviceTypeId }
        });
      }

      const body = {
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }]
          }
        },
        size: filters.limit || 50,
        from: filters.offset || 0
      };

      const result = await client.search({
        index: 'services',
        body
      });

      return result.body.hits.hits.map(hit => ({
        id: hit._source.id,
        score: hit._score
      }));
    } catch (error) {
      console.error('Erro na busca Elasticsearch:', error);
      return [];
    }
  }
}

