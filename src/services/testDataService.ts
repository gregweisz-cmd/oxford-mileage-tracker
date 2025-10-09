import { DatabaseService } from './database';
import { Employee } from '../types';

export class TestDataService {
  static async createTestEmployees(): Promise<Employee[]> {
    const testEmployees: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // Real Oxford House Staff from Google Sheet
      {
        name: 'AJ Dunaway',
        email: 'aj.dunaway@oxfordhouse.org',
        password: 'AJwelcome1',
        oxfordHouseId: '5d60325822954e074a4cf6e1',
        position: 'Regional Manager',
        phoneNumber: '17735909830',
        baseAddress: 'Regional Office',
        costCenters: ['IL-STATE', 'MN-STATE', 'WI-STATE'],
        selectedCostCenters: ['IL-STATE', 'MN-STATE', 'WI-STATE'],
        defaultCostCenter: 'IL-STATE'
      },
      {
        name: 'Aaron Torrance',
        email: 'aaron.torrance@oxfordhouse.org',
        password: 'Aaronwelcome1',
        oxfordHouseId: '653fc7377ffe2633dcb88761',
        position: 'Outreach Worker',
        phoneNumber: '14253875050',
        baseAddress: 'Seattle, WA',
        costCenters: ['WA.KING'],
        selectedCostCenters: ['WA.KING'],
        defaultCostCenter: 'WA.KING'
      },
      {
        name: 'Aaron Vick',
        email: 'aaron.vick@oxfordhouse.org',
        password: 'Aaronwelcome1',
        oxfordHouseId: '5cfaed33c5929137a5d1f906',
        position: 'Senior Outreach Coordinator',
        phoneNumber: '14054462751',
        baseAddress: 'Oklahoma City, OK',
        costCenters: ['OK-SUBG'],
        selectedCostCenters: ['OK-SUBG'],
        defaultCostCenter: 'OK-SUBG'
      },
      {
        name: 'Aislinne Langston',
        email: 'aislinne.langston@oxfordhouse.org',
        password: 'Aislinnewelcome1',
        oxfordHouseId: '5fd7c4930300f7002999941b',
        position: 'Training & Education Coordinator',
        phoneNumber: '18036050459',
        baseAddress: 'Columbia, SC',
        costCenters: ['SC-STATE'],
        selectedCostCenters: ['SC-STATE'],
        defaultCostCenter: 'SC-STATE'
      },
      {
        name: 'Alex Smith',
        email: 'alex.smith@oxfordhouse.org',
        password: 'Alexwelcome1',
        oxfordHouseId: '65c8ecccebc24bc3a11bc948',
        position: 'Outreach Worker',
        phoneNumber: '19712635014',
        baseAddress: 'Portland, OR',
        costCenters: ['OR-STATE'],
        selectedCostCenters: ['OR-STATE'],
        defaultCostCenter: 'OR-STATE'
      },
      {
        name: 'Alex Szary',
        email: 'alex.szary@oxfordhouse.org',
        password: 'Alexwelcome1',
        oxfordHouseId: '5cfaed341af1bf3e3acd891a',
        position: 'Senior Manager of Data and Analytics',
        phoneNumber: '12103698399',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      },
      {
        name: 'Alexandra Mulvey',
        email: 'alex.mulvey@oxfordhouse.org',
        password: 'Alexandrawelcome1',
        oxfordHouseId: '660d9406ae7fb5de1e937015',
        position: 'Accounts Receivable Specialist',
        phoneNumber: '12404268481',
        baseAddress: 'Corporate Office',
        costCenters: ['Finance'],
        selectedCostCenters: ['Finance'],
        defaultCostCenter: 'Finance'
      },
      {
        name: 'Alexis Landa',
        email: 'alexis.landa@oxfordhouse.org',
        password: 'Alexiswelcome1',
        oxfordHouseId: '66352cb976b9b714c8d22994',
        position: 'Outreach Worker',
        phoneNumber: '16029093157',
        baseAddress: 'Phoenix, AZ',
        costCenters: ['AZ.MC-SUBG'],
        selectedCostCenters: ['AZ.MC-SUBG'],
        defaultCostCenter: 'AZ.MC-SUBG'
      },
      {
        name: 'Alison Kayrouz',
        email: 'alison.kayrouz@oxfordhouse.org',
        password: 'Alisonwelcome1',
        oxfordHouseId: '65b4279cee86bfbddf4ee5cc',
        position: 'Data Specialist',
        phoneNumber: '15025285361',
        baseAddress: 'Louisville, KY',
        costCenters: ['KY-SOR'],
        selectedCostCenters: ['KY-SOR'],
        defaultCostCenter: 'KY-SOR'
      },
      {
        name: 'Alyssa Robles',
        email: 'alyssa.robles@oxfordhouse.org',
        password: 'Alyssawelcome1',
        oxfordHouseId: '67698b8828337c0dec758a34',
        position: 'Re-entry Coordinator',
        phoneNumber: '19109985818',
        baseAddress: 'Charlotte, NC',
        costCenters: ['NC.F-SOR'],
        selectedCostCenters: ['NC.F-SOR'],
        defaultCostCenter: 'NC.F-SOR'
      },
      {
        name: 'Amanda Disney',
        email: 'amanda.disney@oxfordhouse.org',
        password: 'Amandawelcome1',
        oxfordHouseId: '63f4d60a6a7ffc46c8bf7aeb',
        position: 'Data Specialist',
        phoneNumber: '14072530603',
        baseAddress: 'Tallahassee, FL',
        costCenters: ['FL-SOR'],
        selectedCostCenters: ['FL-SOR'],
        defaultCostCenter: 'FL-SOR'
      },
      {
        name: 'Amanda McGuirt',
        email: 'amanda.mcguirt@oxfordhouse.org',
        password: 'Amandawelcome1',
        oxfordHouseId: '65809c05d9954830480e9c0a',
        position: 'Outreach Worker',
        phoneNumber: '17046177735',
        baseAddress: 'Charlotte, NC',
        costCenters: ['NC.MECKCO-OSG'],
        selectedCostCenters: ['NC.MECKCO-OSG'],
        defaultCostCenter: 'NC.MECKCO-OSG'
      },
      {
        name: 'Andrea Kissack',
        email: 'andrea.kissack@oxfordhouse.org',
        password: 'Andreawelcome1',
        oxfordHouseId: '622f6b513da22f72f6989a12',
        position: 'Accounts Receivable Specialist',
        phoneNumber: '12406818820',
        baseAddress: 'Corporate Office',
        costCenters: ['Finance'],
        selectedCostCenters: ['Finance'],
        defaultCostCenter: 'Finance'
      },
      {
        name: 'Andrew Ward',
        email: 'andrew.ward@oxfordhouse.org',
        password: 'Andrewwelcome1',
        oxfordHouseId: '65871429cd986921f5ce2ac2',
        position: 'Outreach Worker',
        phoneNumber: '13059688231',
        baseAddress: 'Tallahassee, FL',
        costCenters: ['FL-SOR'],
        selectedCostCenters: ['FL-SOR'],
        defaultCostCenter: 'FL-SOR'
      },
      {
        name: 'Angelica Neighbors',
        email: 'angelica.neighbors@oxfordhouse.org',
        password: 'Angelicawelcome1',
        oxfordHouseId: '65733778f2c9a1989cd0f310',
        position: 'Outreach Worker',
        phoneNumber: '18177160413',
        baseAddress: 'Houston, TX',
        costCenters: ['TX-SUBG'],
        selectedCostCenters: ['TX-SUBG'],
        defaultCostCenter: 'TX-SUBG'
      },
      {
        name: 'Anna Rand',
        email: 'anna.rand@oxfordhouse.org',
        password: 'Annawelcome1',
        oxfordHouseId: '5cfaed34a7e24d36e6574300',
        position: 'Outreach Worker',
        phoneNumber: '15094352832',
        baseAddress: 'Seattle, WA',
        costCenters: ['WA-SUBG'],
        selectedCostCenters: ['WA-SUBG'],
        defaultCostCenter: 'WA-SUBG'
      },
      {
        name: 'Annie Headley',
        email: 'annie.headley@oxfordhouse.org',
        password: 'Anniewelcome1',
        oxfordHouseId: '5cfaed321af1bf2f0e18feb2',
        position: 'Senior Outreach Coordinator',
        phoneNumber: '13608399124',
        baseAddress: 'Seattle, WA',
        costCenters: ['WA-SUBG'],
        selectedCostCenters: ['WA-SUBG'],
        defaultCostCenter: 'WA-SUBG'
      },
      {
        name: 'Antonio Rivera Jr.',
        email: 'tony.rivera@oxfordhouse.org',
        password: 'Antoniowelcome1',
        oxfordHouseId: '61534df91932e77cd23d9a85',
        position: 'Outreach Worker',
        phoneNumber: '18062312101',
        baseAddress: 'Houston, TX',
        costCenters: ['TX-SUBG'],
        selectedCostCenters: ['TX-SUBG'],
        defaultCostCenter: 'TX-SUBG'
      },
      {
        name: 'Greg Weisz',
        email: 'greg.weisz@oxfordhouse.org',
        password: 'Gregwelcome1',
        oxfordHouseId: '5cfaed3392dabb58c03d5779',
        position: 'Senior Data Analyst',
        phoneNumber: '17045647053',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      },
      {
        name: 'Jackson Longan',
        email: 'jackson.longan@oxfordhouse.org',
        password: 'Jacksonwelcome1',
        oxfordHouseId: '5cfaed321af1bf3f29708a29',
        position: 'Director of Communication and Information',
        phoneNumber: '14057771918',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      },
      {
        name: 'George Kent',
        email: 'george.kent@oxfordhouse.org',
        password: 'Georgewelcome1',
        oxfordHouseId: '5cfaed3129624875195c4d4c',
        position: 'Regional Manager',
        phoneNumber: '17326843678',
        baseAddress: 'Regional Office',
        costCenters: ['CT-STATE', 'DE-STATE', 'NJ-STATE'],
        selectedCostCenters: ['CT-STATE', 'DE-STATE', 'NJ-STATE'],
        defaultCostCenter: 'CT-STATE'
      },
      {
        name: 'Jason Jarreau',
        email: 'jason.jarreau@oxfordhouse.org',
        password: 'Jasonwelcome1',
        oxfordHouseId: '5cfaed32c5929136cea26dee',
        position: 'Director of Contracts and Development',
        phoneNumber: '12023082366',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      },
      {
        name: 'James Alston',
        email: 'james.alston@oxfordhouse.org',
        password: 'Jameswelcome1',
        oxfordHouseId: '5cfaed32c5929137e459451a',
        position: 'Contracts Specialist',
        phoneNumber: '19283266263',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      },
      // Additional staff members from Google Sheet
      {
        name: 'Jacqueline Alba',
        email: 'jackie.alba@oxfordhouse.org',
        password: 'Jacquelinewelcome1',
        oxfordHouseId: '5cfaed31c5929137e45944c2',
        position: 'Senior Outreach Coordinator',
        phoneNumber: '14022818993',
        baseAddress: 'Omaha, NE',
        costCenters: ['NE-SOR'],
        selectedCostCenters: ['NE-SOR'],
        defaultCostCenter: 'NE-SOR'
      },
      {
        name: 'Jason Hill',
        email: 'jason.hill@oxfordhouse.org',
        password: 'Jasonwelcome1',
        oxfordHouseId: '5cfaed3192dabb584397cd0e',
        position: 'Senior Outreach Coordinator',
        phoneNumber: '12282499468',
        baseAddress: 'Nashville, TN',
        costCenters: ['TN-SUBG'],
        selectedCostCenters: ['TN-SUBG'],
        defaultCostCenter: 'TN-SUBG'
      },
      {
        name: 'Jason Henken',
        email: 'jason.henken@oxfordhouse.org',
        password: 'Jasonwelcome1',
        oxfordHouseId: '63db2744ee7cde62d94f747b',
        position: 'Outreach Worker',
        phoneNumber: '13607226102',
        baseAddress: 'Seattle, WA',
        costCenters: ['WA-SUBG'],
        selectedCostCenters: ['WA-SUBG'],
        defaultCostCenter: 'WA-SUBG'
      },
      {
        name: 'Jared Vaughn',
        email: 'jared.vaughn@oxfordhouse.org',
        password: 'Jaredwelcome1',
        oxfordHouseId: '6758568409e617ce81da62f8',
        position: 'Outreach Worker',
        phoneNumber: '16063093140',
        baseAddress: 'Louisville, KY',
        costCenters: ['KY-SOR'],
        selectedCostCenters: ['KY-SOR'],
        defaultCostCenter: 'KY-SOR'
      },
      {
        name: 'James Raymond',
        email: 'james.raymond@oxfordhouse.org',
        password: 'Jameswelcome1',
        oxfordHouseId: '67799997e9d88464ff952d74',
        position: 'Outreach Worker',
        phoneNumber: '16292448942',
        baseAddress: 'Nashville, TN',
        costCenters: ['TN-STATE'],
        selectedCostCenters: ['TN-STATE'],
        defaultCostCenter: 'TN-STATE'
      },
      {
        name: 'Jacob McKinney',
        email: 'jacob.mckinney@oxfordhouse.org',
        password: 'Jacobwelcome1',
        oxfordHouseId: '610b1a09ff6a5fdaad7ed702',
        position: 'Outreach Worker',
        phoneNumber: '12602989126',
        baseAddress: 'Columbus, OH',
        costCenters: ['OH-SOR', 'OH-SOS'],
        selectedCostCenters: ['OH-SOR', 'OH-SOS'],
        defaultCostCenter: 'OH-SOR'
      },
      {
        name: 'Jacklyn Feliciano',
        email: 'jacklyn.sledge@oxfordhouse.org',
        password: 'Jacklynwelcome1',
        oxfordHouseId: '5cfaed31c5929137a5d1f881',
        position: 'Senior Outreach Coordinator',
        phoneNumber: '18564184918',
        baseAddress: 'Charlotte, NC',
        costCenters: ['NC.F-SUBG'],
        selectedCostCenters: ['NC.F-SUBG'],
        defaultCostCenter: 'NC.F-SUBG'
      },
      {
        name: 'Isaac Benezra',
        email: 'isaac.benezra@oxfordhouse.org',
        password: 'Isaacwelcome1',
        oxfordHouseId: '661833adea836b98786ca3f7',
        position: 'Outreach Worker',
        phoneNumber: '18484680686',
        baseAddress: 'Newark, NJ',
        costCenters: ['NJ-SUBG'],
        selectedCostCenters: ['NJ-SUBG'],
        defaultCostCenter: 'NJ-SUBG'
      },
      {
        name: 'Irving Hewitt',
        email: 'irving.hewitt@oxfordhouse.org',
        password: 'Irvingwelcome1',
        oxfordHouseId: '68390e6855d11fd9c4015875',
        position: 'Outreach Worker',
        phoneNumber: '19843037725',
        baseAddress: 'Charlotte, NC',
        costCenters: ['NC.AHP'],
        selectedCostCenters: ['NC.AHP'],
        defaultCostCenter: 'NC.AHP'
      },
      {
        name: 'Heather Lee',
        email: 'heather.lee@oxfordhouse.org',
        password: 'Heatherwelcome1',
        oxfordHouseId: '5d9ce4b2b0974e4dea5a3676',
        position: 'Senior Outreach Coordinator',
        phoneNumber: '15044172743',
        baseAddress: 'New Orleans, LA',
        costCenters: ['LA-SOR'],
        selectedCostCenters: ['LA-SOR'],
        defaultCostCenter: 'LA-SOR'
      },
      {
        name: 'Harold Hannum',
        email: 'harold.hannum@oxfordhouse.org',
        password: 'Haroldwelcome1',
        oxfordHouseId: '60493c873dc2a796bd56082c',
        position: 'Outreach Worker',
        phoneNumber: '19082855788',
        baseAddress: 'Newark, NJ',
        costCenters: ['NJ-SOR'],
        selectedCostCenters: ['NJ-SOR'],
        defaultCostCenter: 'NJ-SOR'
      },
      {
        name: 'Geremy Wilkerson',
        email: 'geremy.wilkerson@oxfordhouse.org',
        password: 'Geremywelcome1',
        oxfordHouseId: '653ff50e278ec661ef79c91b',
        position: 'Outreach Worker',
        phoneNumber: '18652069609',
        baseAddress: 'Nashville, TN',
        costCenters: ['TN-STATE'],
        selectedCostCenters: ['TN-STATE'],
        defaultCostCenter: 'TN-STATE'
      },
      {
        name: 'George Buddington',
        email: 'george.buddington@oxfordhouse.org',
        password: 'Georgewelcome1',
        oxfordHouseId: '635fd70d0e0e7e8617c4c3d5',
        position: 'Outreach Worker',
        phoneNumber: '13367083053',
        baseAddress: 'Charlotte, NC',
        costCenters: ['NC.F-SUBG'],
        selectedCostCenters: ['NC.F-SUBG'],
        defaultCostCenter: 'NC.F-SUBG'
      },
      {
        name: 'Jesse Wilson',
        email: 'jesse.wilson@oxfordhouse.org',
        password: 'Jessewelcome1',
        oxfordHouseId: 'jesse_wilson_001',
        position: 'Outreach Worker',
        phoneNumber: '15551234567',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      },
      {
        name: 'Kenneth Norman',
        email: 'kenneth.norman@oxfordhouse.org',
        password: 'Kennethwelcome1',
        oxfordHouseId: 'kenneth_norman_001',
        position: 'Outreach Worker',
        phoneNumber: '15551234568',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      },
      {
        name: 'Tim Diehl',
        email: 'tim.diehl@oxfordhouse.org',
        password: 'Timwelcome1',
        oxfordHouseId: '5cf055ff1af1bf261b344ed4',
        position: 'Director of Technology',
        phoneNumber: '19083075545',
        baseAddress: 'Corporate Office',
        costCenters: ['Program Services'],
        selectedCostCenters: ['Program Services'],
        defaultCostCenter: 'Program Services'
      }
    ];

    // Note: This is a subset of the 252 employees from the Google Sheet
    // To add all 252 employees, we would need to process the complete Google Sheet data
    // The current implementation includes key staff members across different regions and roles
    // Additional employees can be added by extending this array with their data from the sheet

    const createdEmployees: Employee[] = [];
    
    for (const employeeData of testEmployees) {
      try {
        // Check if employee already exists
        const existingEmployees = await DatabaseService.getEmployees();
        const exists = existingEmployees.some(emp => emp.email === employeeData.email);
        
        if (!exists) {
          const employee = await DatabaseService.createEmployee(employeeData);
          createdEmployees.push(employee);
          console.log('✅ Test employee created:', employee.name);
        } else {
          console.log('ℹ️ Test employee already exists:', employeeData.name);
        }
      } catch (error) {
        console.error('❌ Error creating test employee:', employeeData.name, error);
      }
    }

    return createdEmployees;
  }

  static async createTestOxfordHouse(): Promise<void> {
    try {
      await DatabaseService.createOxfordHouse({
        name: 'Test Oxford House',
        address: '123 Test St',
        city: 'Troutman',
        state: 'NC',
        zipCode: '28166',
        phoneNumber: '555-0123',
        managerId: undefined
      });
      console.log('✅ Test Oxford House created');
    } catch (error) {
      console.error('❌ Error creating test Oxford House:', error);
    }
  }

  static async initializeTestData(): Promise<void> {
    try {
      console.log('🚀 Initializing test data...');
      
      // Create test Oxford House first
      await this.createTestOxfordHouse();
      
      // Create test employees
      await this.createTestEmployees();
      
      console.log('✅ Test data initialization complete');
    } catch (error) {
      console.error('❌ Error initializing test data:', error);
      throw error;
    }
  }
}
