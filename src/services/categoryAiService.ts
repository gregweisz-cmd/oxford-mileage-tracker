import { Receipt } from '../types';
import { DatabaseService } from './database';

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0-100
  reasoning: string;
  vendorPattern?: string;
  amountRange?: { min: number; max: number };
}

export interface VendorLearning {
  vendorName: string;
  category: string;
  frequency: number;
  averageAmount: number;
  lastUsed: Date;
  aliases: string[];
}

export class CategoryAiService {
  private static readonly CATEGORIES = [
    'Rental Car Fuel',
    'Hotels/AirBnB',
    'Office Supplies',
    'Meals',
    'Parking',
    'Tolls',
    'Other Transportation',
    'Training/Education',
    'Equipment',
    'Maintenance',
    'Other'
  ];

  private static readonly VENDOR_PATTERNS: Record<string, string> = {
    // Fuel stations
    'shell': 'Rental Car Fuel',
    'exxon': 'Rental Car Fuel',
    'mobil': 'Rental Car Fuel',
    'bp': 'Rental Car Fuel',
    'chevron': 'Rental Car Fuel',
    'speedway': 'Rental Car Fuel',
    'circle k': 'Rental Car Fuel',
    '7-eleven': 'Rental Car Fuel',
    'wawa': 'Rental Car Fuel',
    'sheetz': 'Rental Car Fuel',
    'gas': 'Rental Car Fuel',
    'fuel': 'Rental Car Fuel',
    'station': 'Rental Car Fuel',
    
    // Hotels
    'hilton': 'Hotels/AirBnB',
    'hampton': 'Hotels/AirBnB',
    'marriott': 'Hotels/AirBnB',
    'holiday inn': 'Hotels/AirBnB',
    'best western': 'Hotels/AirBnB',
    'comfort inn': 'Hotels/AirBnB',
    'quality inn': 'Hotels/AirBnB',
    'days inn': 'Hotels/AirBnB',
    'super 8': 'Hotels/AirBnB',
    'motel': 'Hotels/AirBnB',
    'hotel': 'Hotels/AirBnB',
    'inn': 'Hotels/AirBnB',
    'airbnb': 'Hotels/AirBnB',
    
    // Office supplies
    'office depot': 'Office Supplies',
    'staples': 'Office Supplies',
    'office max': 'Office Supplies',
    'walmart': 'Office Supplies',
    'target': 'Office Supplies',
    'amazon': 'Office Supplies',
    
    // Meals
    'mcdonalds': 'Meals',
    'burger king': 'Meals',
    'wendys': 'Meals',
    'subway': 'Meals',
    'taco bell': 'Meals',
    'kfc': 'Meals',
    'pizza hut': 'Meals',
    'dominos': 'Meals',
    'restaurant': 'Meals',
    'cafe': 'Meals',
    'diner': 'Meals',
    'grill': 'Meals',
    
    // Parking
    'parking': 'Parking',
    'garage': 'Parking',
    'lot': 'Parking',
    
    // Tolls
    'toll': 'Tolls',
    'turnpike': 'Tolls',
    'expressway': 'Tolls',
    
    // Transportation
    'uber': 'Other Transportation',
    'lyft': 'Other Transportation',
    'taxi': 'Other Transportation',
    'bus': 'Other Transportation',
    'train': 'Other Transportation',
    'airline': 'Other Transportation',
    'rental car': 'Other Transportation',
  };

  private static readonly AMOUNT_RANGES: Record<string, { min: number; max: number }> = {
    'Rental Car Fuel': { min: 20, max: 80 },
    'Hotels/AirBnB': { min: 80, max: 300 },
    'Office Supplies': { min: 5, max: 200 },
    'Meals': { min: 8, max: 50 },
    'Parking': { min: 2, max: 25 },
    'Tolls': { min: 1, max: 15 },
    'Other Transportation': { min: 10, max: 100 },
    'Training/Education': { min: 50, max: 500 },
    'Equipment': { min: 25, max: 1000 },
    'Maintenance': { min: 30, max: 500 },
  };

  /**
   * Get category suggestions for a receipt
   */
  static async getCategorySuggestions(
    vendor: string,
    amount: number,
    description?: string,
    employeeId?: string
  ): Promise<CategorySuggestion[]> {
    try {
      console.log('🏷️ CategoryAI: Getting suggestions for:', { vendor, amount, description });

      const suggestions: CategorySuggestion[] = [];

      // 1. Vendor pattern matching
      const vendorSuggestion = this.matchVendorPattern(vendor);
      if (vendorSuggestion) {
        suggestions.push(vendorSuggestion);
      }

      // 2. Amount range matching
      const amountSuggestion = this.matchAmountRange(amount);
      if (amountSuggestion) {
        suggestions.push(amountSuggestion);
      }

      // 3. Historical learning
      if (employeeId) {
        const historicalSuggestions = await this.getHistoricalSuggestions(
          vendor,
          amount,
          employeeId
        );
        suggestions.push(...historicalSuggestions);
      }

      // 4. Description analysis
      if (description) {
        const descriptionSuggestion = this.analyzeDescription(description, amount);
        if (descriptionSuggestion) {
          suggestions.push(descriptionSuggestion);
        }
      }

      // Remove duplicates and sort by confidence
      const uniqueSuggestions = this.removeDuplicateSuggestions(suggestions);
      uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

      console.log('🏷️ CategoryAI: Generated suggestions:', uniqueSuggestions.length);
      return uniqueSuggestions.slice(0, 3); // Return top 3

    } catch (error) {
      console.error('❌ CategoryAI: Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Match vendor name against known patterns
   */
  private static matchVendorPattern(vendor: string): CategorySuggestion | null {
    const vendorLower = vendor.toLowerCase();
    
    for (const [pattern, category] of Object.entries(this.VENDOR_PATTERNS)) {
      if (vendorLower.includes(pattern)) {
        return {
          category,
          confidence: 85, // High confidence for exact pattern matches
          reasoning: `Vendor "${vendor}" matches pattern for ${category}`,
          vendorPattern: pattern
        };
      }
    }

    return null;
  }

  /**
   * Match amount against typical ranges for categories
   */
  private static matchAmountRange(amount: number): CategorySuggestion | null {
    for (const [category, range] of Object.entries(this.AMOUNT_RANGES)) {
      if (amount >= range.min && amount <= range.max) {
        return {
          category,
          confidence: 60, // Medium confidence for amount matching
          reasoning: `Amount $${amount} is typical for ${category}`,
          amountRange: range
        };
      }
    }

    return null;
  }

  /**
   * Get suggestions based on historical data
   */
  private static async getHistoricalSuggestions(
    vendor: string,
    amount: number,
    employeeId: string
  ): Promise<CategorySuggestion[]> {
    try {
      const receipts = await DatabaseService.getReceipts(employeeId);
      
      // Find receipts from the same vendor
      const vendorReceipts = receipts.filter(receipt => 
        receipt.vendor.toLowerCase().includes(vendor.toLowerCase()) ||
        vendor.toLowerCase().includes(receipt.vendor.toLowerCase())
      );

      if (vendorReceipts.length === 0) {
        return [];
      }

      // Calculate most common category for this vendor
      const categoryCount = new Map<string, number>();
      let totalAmount = 0;

      for (const receipt of vendorReceipts) {
        const count = categoryCount.get(receipt.category) || 0;
        categoryCount.set(receipt.category, count + 1);
        totalAmount += receipt.amount;
      }

      // Find most common category
      let mostCommonCategory = '';
      let maxCount = 0;
      
      for (const [category, count] of categoryCount) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonCategory = category;
        }
      }

      if (mostCommonCategory && maxCount >= 2) {
        const averageAmount = totalAmount / vendorReceipts.length;
        const amountSimilarity = Math.abs(amount - averageAmount) / averageAmount;
        
        return [{
          category: mostCommonCategory,
          confidence: Math.min(95, 70 + (maxCount * 5) - (amountSimilarity * 20)),
          reasoning: `You've categorized "${vendor}" as ${mostCommonCategory} ${maxCount} times before`,
          amountRange: { min: averageAmount * 0.7, max: averageAmount * 1.3 }
        }];
      }

      return [];
    } catch (error) {
      console.error('❌ CategoryAI: Error getting historical suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze receipt description for category clues
   */
  private static analyzeDescription(description: string, amount: number): CategorySuggestion | null {
    const descLower = description.toLowerCase();
    
    // Look for category keywords in description
    for (const [pattern, category] of Object.entries(this.VENDOR_PATTERNS)) {
      if (descLower.includes(pattern)) {
        return {
          category,
          confidence: 75,
          reasoning: `Description mentions "${pattern}" which suggests ${category}`,
          vendorPattern: pattern
        };
      }
    }

    return null;
  }

  /**
   * Remove duplicate category suggestions
   */
  private static removeDuplicateSuggestions(suggestions: CategorySuggestion[]): CategorySuggestion[] {
    const seen = new Set<string>();
    const unique: CategorySuggestion[] = [];

    for (const suggestion of suggestions) {
      if (!seen.has(suggestion.category)) {
        seen.add(suggestion.category);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Learn from user's category selection
   */
  static async learnFromSelection(
    vendor: string,
    amount: number,
    selectedCategory: string,
    employeeId: string
  ): Promise<void> {
    try {
      console.log('🏷️ CategoryAI: Learning from selection:', { vendor, selectedCategory });

      // Store the learning data (in a real app, you'd save this to a learning database)
      // For now, we'll just log it
      const learningData = {
        vendor,
        amount,
        category: selectedCategory,
        employeeId,
        timestamp: new Date()
      };

      console.log('🏷️ CategoryAI: Learned pattern:', learningData);

      // In a production app, you'd save this to a learning database
      // await DatabaseService.saveCategoryLearning(learningData);

    } catch (error) {
      console.error('❌ CategoryAI: Error learning from selection:', error);
    }
  }

  /**
   * Get vendor learning data for auto-complete
   */
  static async getVendorLearning(employeeId: string): Promise<VendorLearning[]> {
    try {
      const receipts = await DatabaseService.getReceipts(employeeId);
      
      // Group receipts by vendor
      const vendorMap = new Map<string, {
        receipts: Receipt[];
        category: string;
        aliases: Set<string>;
      }>();

      for (const receipt of receipts) {
        const vendorKey = receipt.vendor.toLowerCase();
        
        if (!vendorMap.has(vendorKey)) {
          vendorMap.set(vendorKey, {
            receipts: [],
            category: receipt.category,
            aliases: new Set()
          });
        }

        const vendorData = vendorMap.get(vendorKey)!;
        vendorData.receipts.push(receipt);
        
        // Add aliases (partial matches)
        const words = receipt.vendor.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.length > 2) {
            vendorData.aliases.add(word);
          }
        });
      }

      // Convert to VendorLearning objects
      const learning: VendorLearning[] = [];
      
      for (const [vendorKey, data] of vendorMap) {
        if (data.receipts.length >= 2) { // Only include vendors used 2+ times
          const totalAmount = data.receipts.reduce((sum, r) => sum + r.amount, 0);
          const lastUsed = data.receipts.reduce((latest, r) => 
            r.date > latest ? r.date : latest, data.receipts[0].date
          );

          learning.push({
            vendorName: data.receipts[0].vendor, // Use original casing
            category: data.category,
            frequency: data.receipts.length,
            averageAmount: totalAmount / data.receipts.length,
            lastUsed,
            aliases: Array.from(data.aliases)
          });
        }
      }

      // Sort by frequency and recency
      learning.sort((a, b) => {
        const frequencyScore = b.frequency - a.frequency;
        const recencyScore = b.lastUsed.getTime() - a.lastUsed.getTime();
        return frequencyScore * 0.7 + (recencyScore / (1000 * 60 * 60 * 24)) * 0.3;
      });

      return learning.slice(0, 20); // Return top 20 vendors

    } catch (error) {
      console.error('❌ CategoryAI: Error getting vendor learning:', error);
      return [];
    }
  }

  /**
   * Get vendor suggestions for auto-complete
   */
  static async getVendorSuggestions(
    input: string,
    employeeId: string
  ): Promise<Array<{
    vendor: string;
    category: string;
    averageAmount: number;
    frequency: number;
    confidence: number;
  }>> {
    try {
      if (input.length < 2) {
        return [];
      }

      const learning = await this.getVendorLearning(employeeId);
      const inputLower = input.toLowerCase();
      
      const suggestions = learning
        .filter(vendor => 
          vendor.vendorName.toLowerCase().includes(inputLower) ||
          vendor.aliases.some(alias => alias.includes(inputLower))
        )
        .map(vendor => ({
          vendor: vendor.vendorName,
          category: vendor.category,
          averageAmount: vendor.averageAmount,
          frequency: vendor.frequency,
          confidence: this.calculateVendorConfidence(vendor, inputLower)
        }))
        .sort((a, b) => b.confidence - a.confidence);

      return suggestions.slice(0, 5); // Return top 5 suggestions

    } catch (error) {
      console.error('❌ CategoryAI: Error getting vendor suggestions:', error);
      return [];
    }
  }

  /**
   * Calculate confidence for vendor suggestions
   */
  private static calculateVendorConfidence(
    vendor: VendorLearning,
    input: string
  ): number {
    let confidence = 0;

    // Exact match gets highest confidence
    if (vendor.vendorName.toLowerCase().includes(input)) {
      confidence += 80;
    }

    // Alias match gets medium confidence
    if (vendor.aliases.some(alias => alias.includes(input))) {
      confidence += 60;
    }

    // Frequency bonus
    confidence += Math.min(20, vendor.frequency * 2);

    // Recency bonus
    const daysSinceLastUse = (Date.now() - vendor.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    confidence += Math.max(0, 10 - daysSinceLastUse);

    return Math.min(100, confidence);
  }

  /**
   * Get all available categories
   */
  static getCategories(): string[] {
    return [...this.CATEGORIES];
  }

  /**
   * Get category description
   */
  static getCategoryDescription(category: string): string {
    const descriptions: Record<string, string> = {
      'Rental Car Fuel': 'Gasoline for rental vehicles',
      'Hotels/AirBnB': 'Accommodation expenses',
      'Office Supplies': 'Office materials and supplies',
      'Meals': 'Food and dining expenses',
      'Parking': 'Parking fees and permits',
      'Tolls': 'Highway and bridge tolls',
      'Other Transportation': 'Uber, Lyft, taxi, bus, train, etc.',
      'Training/Education': 'Training courses and educational materials',
      'Equipment': 'Tools and equipment purchases',
      'Maintenance': 'Vehicle and equipment maintenance',
      'Other': 'Miscellaneous expenses'
    };

    return descriptions[category] || 'Expense category';
  }
}
