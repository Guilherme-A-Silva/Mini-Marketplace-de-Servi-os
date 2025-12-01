import { Discount } from '../models/index.js';
import { Op } from 'sequelize';

export class DiscountService {
  /**
   * Calcula o preço com desconto aplicado para uma variação em uma data específica
   * @param {number} serviceVariationId - ID da variação do serviço
   * @param {string} scheduledDate - Data do agendamento (YYYY-MM-DD)
   * @param {number} originalPrice - Preço original da variação
   * @returns {Promise<{finalPrice: number, discountPercentage: number, discountAmount: number}>}
   */
  static async calculatePriceWithDiscount(serviceVariationId, scheduledDate, originalPrice) {
    try {
      // Garantir que a data seja tratada como string YYYY-MM-DD para evitar conversão de timezone
      const dateStr = typeof scheduledDate === 'string' 
        ? scheduledDate.split('T')[0] 
        : scheduledDate.toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      const scheduledDateObj = new Date(year, month - 1, day); // Criar data local sem timezone
      const dayOfWeek = scheduledDateObj.getDay(); // 0 = Domingo, 6 = Sábado

      // Buscar descontos ativos para esta variação e dia da semana
      const discounts = await Discount.findAll({
        where: {
          serviceVariationId,
          dayOfWeek,
          isActive: true,
          [Op.or]: [
            // Desconto permanente (sem datas)
            {
              startDate: null,
              endDate: null
            },
            // Desconto com data de início e fim
            {
              startDate: { [Op.lte]: dateStr },
              endDate: { [Op.gte]: dateStr }
            },
            // Desconto apenas com data de início (ainda válido)
            {
              startDate: { [Op.lte]: dateStr },
              endDate: null
            }
          ]
        },
        order: [['discountPercentage', 'DESC']] // Pegar o maior desconto se houver múltiplos
      });

      if (discounts.length === 0) {
        return {
          finalPrice: parseFloat(originalPrice),
          discountPercentage: 0,
          discountAmount: 0
        };
      }

      // Aplicar o maior desconto encontrado
      const discount = discounts[0];
      const discountPercentage = parseFloat(discount.discountPercentage);
      const discountAmount = (parseFloat(originalPrice) * discountPercentage) / 100;
      const finalPrice = parseFloat(originalPrice) - discountAmount;

      return {
        finalPrice: Math.max(0, finalPrice), // Garantir que não seja negativo
        discountPercentage,
        discountAmount
      };
    } catch (error) {
      console.error('Erro ao calcular desconto:', error);
      // Em caso de erro, retornar preço original
      return {
        finalPrice: parseFloat(originalPrice),
        discountPercentage: 0,
        discountAmount: 0
      };
    }
  }

  /**
   * Busca todos os descontos ativos para uma variação
   * @param {number} serviceVariationId - ID da variação
   * @returns {Promise<Array>}
   */
  static async getDiscountsForVariation(serviceVariationId) {
    try {
      const now = new Date();
      return await Discount.findAll({
        where: {
          serviceVariationId,
          isActive: true,
          [Op.or]: [
            { startDate: null, endDate: null },
            {
              startDate: { [Op.lte]: now },
              endDate: { [Op.gte]: now }
            },
            {
              startDate: { [Op.lte]: now },
              endDate: null
            }
          ]
        },
        order: [['dayOfWeek', 'ASC']]
      });
    } catch (error) {
      console.error('Erro ao buscar descontos:', error);
      return [];
    }
  }
}

