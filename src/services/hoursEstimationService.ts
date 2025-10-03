/**
 * Hours Estimation Service
 * Smart suggestions for hours worked based on mileage and trip details
 */

export interface HoursEstimate {
  suggestedHours: number;
  confidence: number;
  reasoning: string;
}

export class HoursEstimationService {
  
  /**
   * Estimate hours worked based on miles driven
   */
  static estimateHoursFromMiles(miles: number): HoursEstimate {
    let suggestedHours = 0;
    let reasoning = '';
    let confidence = 0.7;
    
    if (miles < 25) {
      // Short local trip
      suggestedHours = 2;
      reasoning = 'Short local trip (< 25 miles)';
      confidence = 0.6;
    } else if (miles >= 25 && miles < 75) {
      // Medium distance trip
      suggestedHours = 4;
      reasoning = 'Medium distance trip (25-75 miles)';
      confidence = 0.7;
    } else if (miles >= 75 && miles < 150) {
      // Long trip
      suggestedHours = 6;
      reasoning = 'Long distance trip (75-150 miles)';
      confidence = 0.75;
    } else if (miles >= 150 && miles < 250) {
      // Full day trip
      suggestedHours = 8;
      reasoning = 'Full day trip (150-250 miles)';
      confidence = 0.8;
    } else {
      // Very long trip
      suggestedHours = 8;
      reasoning = 'Extended trip (250+ miles)';
      confidence = 0.7;
    }
    
    return {
      suggestedHours,
      confidence,
      reasoning,
    };
  }
  
  /**
   * Estimate hours based on trip details and patterns
   */
  static estimateHoursFromTripDetails(
    miles: number,
    purpose: string,
    startTime?: Date,
    endTime?: Date
  ): HoursEstimate {
    
    // If we have actual start/end times, calculate precise hours
    if (startTime && endTime) {
      const millisDiff = endTime.getTime() - startTime.getTime();
      const hoursDiff = Math.round(millisDiff / (1000 * 60 * 60));
      
      return {
        suggestedHours: Math.min(hoursDiff, 12), // Cap at 12 hours
        confidence: 0.95,
        reasoning: 'Calculated from actual trip duration',
      };
    }
    
    // Use miles-based estimation as baseline
    const baseEstimate = this.estimateHoursFromMiles(miles);
    
    // Adjust based on purpose keywords
    const purposeLower = purpose.toLowerCase();
    
    // Activities that typically take longer
    if (purposeLower.includes('training') || purposeLower.includes('meeting')) {
      baseEstimate.suggestedHours = Math.min(baseEstimate.suggestedHours + 2, 8);
      baseEstimate.reasoning += ' + extended for training/meeting';
    }
    
    if (purposeLower.includes('stabilization') || purposeLower.includes('inspection')) {
      baseEstimate.suggestedHours = Math.max(baseEstimate.suggestedHours, 6);
      baseEstimate.reasoning += ' + typical for house stabilization';
    }
    
    // Quick activities
    if (purposeLower.includes('drop off') || purposeLower.includes('pickup')) {
      baseEstimate.suggestedHours = Math.max(baseEstimate.suggestedHours - 2, 1);
      baseEstimate.reasoning += ' - shorter for pickup/delivery';
      baseEstimate.confidence = 0.6;
    }
    
    return baseEstimate;
  }
  
  /**
   * Get multiple hour suggestions with different scenarios
   */
  static getHoursSuggestions(miles: number, purpose: string): HoursEstimate[] {
    const suggestions: HoursEstimate[] = [];
    
    // Primary suggestion based on miles
    const primary = this.estimateHoursFromTripDetails(miles, purpose);
    suggestions.push(primary);
    
    // Alternative: Full day if long trip
    if (miles >= 100 && primary.suggestedHours < 8) {
      suggestions.push({
        suggestedHours: 8,
        confidence: 0.6,
        reasoning: 'Full work day alternative',
      });
    }
    
    // Alternative: Half day if medium trip
    if (miles >= 50 && miles < 100 && primary.suggestedHours !== 4) {
      suggestions.push({
        suggestedHours: 4,
        confidence: 0.5,
        reasoning: 'Half day alternative',
      });
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Quick suggestion buttons for common scenarios
   */
  static getQuickOptions(): { hours: number; label: string }[] {
    return [
      { hours: 2, label: '2 hrs (Quick trip)' },
      { hours: 4, label: '4 hrs (Half day)' },
      { hours: 6, label: '6 hrs (Most of day)' },
      { hours: 8, label: '8 hrs (Full day)' },
    ];
  }
}

