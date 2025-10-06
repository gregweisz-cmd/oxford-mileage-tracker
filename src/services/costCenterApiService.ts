// Cost Center API Service for Mobile App
// Handles fetching cost centers from the backend API

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

class CostCenterApiService {
  private baseUrl = 'http://localhost:3002/api';
  private costCenters: CostCenter[] = [];
  private lastFetch: number = 0;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch cost centers from the API
   */
  async fetchCostCenters(): Promise<CostCenter[]> {
    try {
      const response = await fetch(`${this.baseUrl}/cost-centers`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const costCenters = await response.json();
      this.costCenters = costCenters.filter((cc: CostCenter) => cc.isActive);
      this.lastFetch = Date.now();
      return this.costCenters;
    } catch (error) {
      console.error('Failed to fetch cost centers from API:', error);
      // Return cached data if available, otherwise fallback to hardcoded list
      if (this.costCenters.length > 0) {
        return this.costCenters;
      }
      return this.getFallbackCostCenters();
    }
  }

  /**
   * Get cost centers with caching
   */
  async getCostCenters(): Promise<CostCenter[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.costCenters.length > 0 && (now - this.lastFetch) < this.cacheTimeout) {
      return this.costCenters;
    }

    // Fetch fresh data
    return this.fetchCostCenters();
  }

  /**
   * Get cost center names as a simple array (for backward compatibility)
   */
  async getCostCenterNames(): Promise<string[]> {
    const costCenters = await this.getCostCenters();
    return costCenters.map(cc => cc.name).sort();
  }

  /**
   * Find a cost center by name
   */
  async findCostCenterByName(name: string): Promise<CostCenter | undefined> {
    const costCenters = await this.getCostCenters();
    return costCenters.find(cc => cc.name === name);
  }

  /**
   * Find a cost center by code
   */
  async findCostCenterByCode(code: string): Promise<CostCenter | undefined> {
    const costCenters = await this.getCostCenters();
    return costCenters.find(cc => cc.code === code);
  }

  /**
   * Clear the cache to force a fresh fetch
   */
  clearCache(): void {
    this.costCenters = [];
    this.lastFetch = 0;
  }

  /**
   * Fallback cost centers if API is unavailable
   */
  getFallbackCostCenters(): CostCenter[] {
    const fallbackNames = [
      'AL / HI / LA',
      'AL-SOR',
      'AL-SUBG',
      'AZ / CO',
      'AZ.CHCCP-SUBG (N)',
      'AZ.CHCCP-SUBG (S)',
      'AZ.MC-SUBG',
      'CA / CO / SD',
      'CA.CCC-OSG',
      'CA.CCC-SUBG',
      'CA.SLOC-HHSG',
      'CO.RMHP',
      'CO.RMHP-SOR',
      'CO.SBH-SOR',
      'CORPORATE',
      'CT / DE / NJ',
      'DC / MD / VA',
      'DC-SOR',
      'DE-STATE',
      'FL-',
      'FL-SOR',
      'Finance',
      'HI-STATE',
      'ID / WA',
      'IL / MN / WI',
      'IL-SUBG',
      'IL.BCBS',
      'IN.TC-OSG',
      'KY / IN / OH',
      'KY-OSG',
      'KY-SOR',
      'KY-STATE',
      'KY-SUBG',
      'LA-SOR',
      'LA-SUBG',
      'MO.GRACE',
      'NC',
      'NC.AHP',
      'NC.DOGWOOD',
      'NC.F-SOR',
      'NC.F-SUBG',
      'NC.MECKCO-OSG',
      'NC.TRILLIUM',
      'NE-SOR',
      'NJ-OSG',
      'NJ-SOR',
      'NJ-SOR (SUBG X)',
      'NJ-SUBG',
      'NM-STATE',
      'NY-',
      'NY.CC/GC-OSG',
      'NY.NC-OSG',
      'NY.OC-OSG',
      'NY.RC-OSG',
      'NY.SC-OSG',
      'NY.UC-OSG',
      'OH-OSG (HC)',
      'OH-SOR/SOS',
      'OH.BHM-STATE',
      'OH.FC-SOR/SOS',
      'OH.MC-STATE',
      'OK / MO / NE',
      'OK-DOJ (RE-ENTRY)',
      'OK-SUBG',
      'OR-',
      'OR-OSG',
      'OR-STATE',
      'Program Services',
      'SC / TN',
      'SC-STATE',
      'SC.PHCA',
      'SC.RUBICON',
      'SD-SOR',
      'TN-STATE',
      'TN-SUBG',
      'TX / NM',
      'TX-SUBG',
      'TX.HEB',
      'VA-SOR',
      'VA-SUBG',
      'WA-SUBG',
      'WA.KING',
      'WA.SNO',
      'WI.MIL',
    ];

    return fallbackNames.map((name, index) => ({
      id: `fallback-${index}`,
      code: name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
      name,
      description: 'Fallback cost center',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }
}

export const costCenterApiService = new CostCenterApiService();
