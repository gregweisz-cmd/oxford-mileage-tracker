import { DatabaseService } from './database';
import { MileageEntry, Receipt, TimeTracking } from '../types';

export class DemoDataService {
  static async createGregJune2024Data() {
    try {
      const employees = await DatabaseService.getEmployees();
      const greg = employees.find(emp => emp.name === 'Greg Weisz');

      if (!greg) {
        console.log('Greg Weisz not found, skipping demo data creation');
        return;
      }

      // Check if June 2024 data already exists
      const existingEntries = await DatabaseService.getMileageEntries();
      const juneEntries = existingEntries.filter(entry => {
        const date = new Date(entry.date);
        return date.getFullYear() === 2024 && date.getMonth() === 5; // June
      });
      
      if (juneEntries.length > 0) {
        console.log('June 2024 demo data already exists, updating instead');
        // Delete existing June 2024 entries to refresh data
        for (const entry of juneEntries) {
          await DatabaseService.deleteMileageEntry(entry.id);
        }
      }

      // Greg's actual June 2024 travel data from expense report
      const juneMileageEntries: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          costCenter: 'Administrative',
          date: new Date(2024, 5, 6), // June 6, 2024
          startLocation: 'BA (230 Wagner St, Troutman, NC 28166)',
          endLocation: 'OH Central (1804 Primrose Pl Durham, NC)',
          purpose: 'BA to OH Central (1804 Primrose Pl Durham, NC) to drop off donations to BA to OH Sharon Amity (252 N Sharon Amity Rd Charlotte, NC) for house stabilization to BA',
          miles: 346,
          notes: 'Delivery donations and house stabilization support',
          hoursWorked: 8,
          isGpsTracked: true,
          odometerReading: 83510
        },
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          costCenter: 'Administrative',
          date: new Date(2024, 5, 12), // June 12, 2024
          startLocation: 'BA (230 Wagner St, Troutman, NC 28166)',
          endLocation: 'Co-worker house (673 Sand Hill Rd Asheville, NC)',
          purpose: 'BA to coworker\'s house (673 Sand Hill Rd Asheville, NC) to work on new employee\'s computer to BA to OH Sharon Amity (252 N Sharon Amity Rd Charlotte, NC) for house stabilization to BA',
          miles: 298,
          notes: 'IT support and house stabilization work',
          hoursWorked: 8,
          isGpsTracked: true,
          odometerReading: 84011
        },
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          costCenter: 'Administrative',
          date: new Date(2024, 5, 13), // June 13, 2024
          startLocation: 'BA (230 Wagner St, Troutman, NC 28166)',
          endLocation: 'Co-worker house (204 Hogan St Morganton, NC)',
          purpose: 'BA to coworker\'s house (204 Hogan St Morganton, NC) to work on reports/training to BA to OH Brittle Creek (1310 Brittle Creek Dr Matthews, NC) for house stabilization to BA',
          miles: 212,
          notes: 'Reports training and house stabilization',
          hoursWorked: 8,
          isGpsTracked: true,
          odometerReading: 84335
        },
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          costCenter: 'Administrative',
          date: new Date(2024, 5, 14), // June 14, 2024
          startLocation: 'BA (230 Wagner St, Troutman, NC 28166)',
          endLocation: 'Donation pickup (14912 Dunbeth Dr Huntersville, NC)',
          purpose: 'BA to (14912 Dunbeth Dr Huntersville, NC) to pick up donations to BA',
          miles: 48,
          notes: 'Donation pickup service',
          hoursWorked: 8,
          isGpsTracked: true,
          odometerReading: 84602
        },
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          costCenter: 'Administrative',
          date: new Date(2024, 5, 25), // June 25, 2024
          startLocation: 'BA (230 Wagner St, Troutman, NC 28166)',
          endLocation: 'Donation pickup (161 Autumn Frost Ave Troutman, NC)',
          purpose: 'BA to (161 Autumn Frost Ave Troutman, NC) to pick up donations to OH McLelland (338 W McLelland Ave Mooresville, NC) to drop off donations to (161 Autumn Frost Ave Troutman, NC) to pick up donations to OH McLelland to drop off donations to BA',
          miles: 30,
          notes: 'Multiple pickup and delivery runs for donations',
          hoursWorked: 8,
          isGpsTracked: true,
          odometerReading: 84844
        }
      ];

      // Create phone/internet receipts matching the $99.99 expense
      const juneReceipts: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: greg.id,
          date: new Date(2024, 5, 5), // June 5, 2024
          amount: 49.99,
          vendor: 'Verizon Wireless',
          description: 'Monthly phone service plan',
          category: 'INTERNET_BILL',
          imageUri: 'verizon-june-2024.jpg'
        },
        {
          employeeId: greg.id,
          date: new Date(2024, 5, 15), // June 15, 2024
          amount: 50.00,
          vendor: 'Comcast Internet',
          description: 'Monthly internet service',
          category: 'INTERNET_BILL',
          imageUri: 'comcast-june-2024.jpg'
        }
      ];

      // Create June 2024 mileage entries
      for (const entry of juneMileageEntries) {
        await DatabaseService.createMileageEntry(entry);
      }

      // Create June 2024 receipts
      for (const receipt of juneReceipts) {
        await DatabaseService.createReceipt(receipt);
      }

      // Create time tracking entries for June 2024 (160 total hours)
      // Work-from-home days (15 days × 8 hours = 120 hours)
      const workFromHomeDays = [3, 4, 5, 7, 10, 11, 17, 18, 19, 20, 21, 24, 26, 27, 28];
      for (const day of workFromHomeDays) {
        const timeTracking: Omit<TimeTracking, 'id' | 'createdAt' | 'updatedAt'> = {
          employeeId: greg.id,
          date: new Date(2024, 5, day), // June 2024
          hours: 8,
          category: 'G&A Hours',
          description: 'Work from home office: Zoom calls, emails and phone calls'
        };
        await DatabaseService.createTimeTracking(timeTracking);
      }

      // Travel days already have hours in mileage entries, but add time tracking entries too
      const travelDays = [6, 12, 13, 14, 25];
      for (const day of travelDays) {
        const timeTracking: Omit<TimeTracking, 'id' | 'createdAt' | 'updatedAt'> = {
          employeeId: greg.id,
          date: new Date(2024, 5, day), // June 2024
          hours: 8,
          category: 'G&A Hours',
          description: 'Field work and travel activities'
        };
        await DatabaseService.createTimeTracking(timeTracking);
      }

      console.log('Greg Weisz June 2024 demo data created successfully!');
      console.log(`- Created ${juneMileageEntries.length} mileage entries (934 total miles)`);
      console.log(`- Created ${juneReceipts.length} receipts ($${juneReceipts.reduce((sum, r) => sum + r.amount, 0).toFixed(2)} total)`);
      console.log(`- Created ${workFromHomeDays.length + travelDays.length} time tracking entries (160 total hours)`);
      console.log('- Matches actual June 2024 expense report data');
      
    } catch (error) {
      console.error('Error creating Greg June 2024 demo data:', error);
    }
  }

  static async createSampleDataForTeam() {
    try {
      const employees = await DatabaseService.getEmployees();
      const alex = employees.find(emp => emp.name === 'Alex Szary');
      const greg = employees.find(emp => emp.name === 'Greg Weisz');
      const jackson = employees.find(emp => emp.name === 'Jackson Longan');

      if (!alex || !greg || !jackson) {
        console.log('Demo employees not found, skipping sample data creation');
        return;
      }

      // Check if sample data already exists
      const existingEntries = await DatabaseService.getMileageEntries();
      if (existingEntries.length > 0) {
        console.log('Sample data already exists, skipping creation');
        return;
      }

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      // Create sample mileage entries for Alex Szary
      const alexEntries: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: alex.id,
          oxfordHouseId: alex.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 5),
          startLocation: 'Charlotte Office',
          endLocation: 'Client Home - Downtown Charlotte',
          purpose: 'Client visit and assessment',
          miles: 12.5,
          notes: 'Initial client meeting',
          hoursWorked: 8.5,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: alex.id,
          oxfordHouseId: alex.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 8),
          startLocation: 'Charlotte Office (123 Main St, Charlotte, NC 28201)',
          endLocation: 'Community Center - Matthews (456 Oak Ave, Matthews, NC 28105)',
          purpose: 'Community outreach event',
          miles: 18.2,
          notes: 'Monthly outreach program',
          hoursWorked: 9.0,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: alex.id,
          oxfordHouseId: alex.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 12),
          startLocation: 'Client Home - Concord (789 Pine St, Concord, NC 28025)',
          endLocation: 'Charlotte Office (123 Main St, Charlotte, NC 28201)',
          purpose: 'Follow-up client visit',
          miles: 22.1,
          notes: 'Progress check and documentation',
          hoursWorked: 7.5,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: alex.id,
          oxfordHouseId: alex.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 15),
          startLocation: 'Charlotte Office',
          endLocation: 'Hospital - Pineville',
          purpose: 'Client medical appointment',
          miles: 15.8,
          notes: 'Transportation assistance',
          hoursWorked: 6.0,
          isGpsTracked: false,
          odometerReading: 123016
        }
      ];

      // Create sample mileage entries for Greg Weisz
      const gregEntries: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 3),
          startLocation: 'Greensboro Office',
          endLocation: 'Client Home - Winston-Salem',
          purpose: 'Client intake and assessment',
          miles: 28.5,
          notes: 'New client onboarding',
          hoursWorked: 8.0,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 7),
          startLocation: 'Greensboro Office',
          endLocation: 'Support Group - High Point',
          purpose: 'Support group facilitation',
          miles: 16.3,
          notes: 'Weekly support group meeting',
          hoursWorked: 7.0,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 11),
          startLocation: 'Client Home - Burlington',
          endLocation: 'Greensboro Office',
          purpose: 'Home visit and documentation',
          miles: 24.7,
          notes: 'Monthly home visit',
          hoursWorked: 8.5,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: greg.id,
          oxfordHouseId: greg.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 16),
          startLocation: 'Greensboro Office',
          endLocation: 'Court House - Greensboro',
          purpose: 'Client court appearance support',
          miles: 8.2,
          notes: 'Legal support and advocacy',
          hoursWorked: 6.5,
          isGpsTracked: false,
          odometerReading: 123030
        }
      ];

      // Create sample mileage entries for Jackson Longan
      const jacksonEntries: Omit<MileageEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: jackson.id,
          oxfordHouseId: jackson.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 2),
          startLocation: 'Yukon Office (425 Pergola St, Yukon, OK 73099)',
          endLocation: 'Oklahoma City Office (123 Business Blvd, Oklahoma City, OK 73102)',
          purpose: 'Team supervision and training',
          miles: 18.5,
          notes: 'Monthly team meeting',
          hoursWorked: 9.0,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: jackson.id,
          oxfordHouseId: jackson.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 9),
          startLocation: 'Yukon Office',
          endLocation: 'Tulsa Office',
          purpose: 'Site visit and staff evaluation',
          miles: 95.2,
          notes: 'Quarterly site assessment',
          hoursWorked: 8.0,
          isGpsTracked: false,
          odometerReading: 123000
        },
        {
          employeeId: jackson.id,
          oxfordHouseId: jackson.oxfordHouseId,
          date: new Date(currentYear, currentMonth, 14),
          startLocation: 'Yukon Office',
          endLocation: 'Norman Office',
          purpose: 'Regional coordination meeting',
          miles: 22.8,
          notes: 'Cross-region collaboration',
          hoursWorked: 7.5,
          isGpsTracked: false,
          odometerReading: 78900
        }
      ];

      // Create all mileage entries
      for (const entry of [...alexEntries, ...gregEntries, ...jacksonEntries]) {
        await DatabaseService.createMileageEntry(entry);
      }

      // Create sample receipts for Alex
      const alexReceipts: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: alex.id,
          date: new Date(currentYear, currentMonth, 5),
          amount: 15.50,
          vendor: 'Starbucks',
          description: 'Client meeting coffee',
          category: 'Meals',
          imageUri: 'sample-receipt-1.jpg'
        },
        {
          employeeId: alex.id,
          date: new Date(currentYear, currentMonth, 8),
          amount: 28.75,
          vendor: 'Subway',
          description: 'Team lunch during outreach',
          category: 'Meals',
          imageUri: 'sample-receipt-2.jpg'
        }
      ];

      // Create sample receipts for Greg
      const gregReceipts: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: greg.id,
          date: new Date(currentYear, currentMonth, 3),
          amount: 12.25,
          vendor: 'McDonald\'s',
          description: 'Client meal assistance',
          category: 'Meals',
          imageUri: 'sample-receipt-3.jpg'
        },
        {
          employeeId: greg.id,
          date: new Date(currentYear, currentMonth, 11),
          amount: 45.00,
          vendor: 'Office Depot',
          description: 'Client supplies and materials',
          category: 'Supplies',
          imageUri: 'sample-receipt-4.jpg'
        }
      ];

      // Create sample receipts for Jackson
      const jacksonReceipts: Omit<Receipt, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          employeeId: jackson.id,
          date: new Date(currentYear, currentMonth, 2),
          amount: 28.50,
          vendor: 'Hampton Inn',
          description: 'Team meeting venue',
          category: 'Travel',
          imageUri: 'sample-receipt-5.jpg'
        },
        {
          employeeId: jackson.id,
          date: new Date(currentYear, currentMonth, 9),
          amount: 18.75,
          vendor: 'Braum\'s',
          description: 'Staff training lunch',
          category: 'Meals',
          imageUri: 'sample-receipt-6.jpg'
        }
      ];

      // Create all receipts
      for (const receipt of [...alexReceipts, ...gregReceipts, ...jacksonReceipts]) {
        await DatabaseService.createReceipt(receipt);
      }

      console.log('Sample data created successfully for demo team');
    } catch (error) {
      console.error('Error creating sample data:', error);
    }
  }
}
