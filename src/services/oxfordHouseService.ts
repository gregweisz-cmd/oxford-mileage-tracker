import { OxfordHouse } from '../types';
import { DatabaseService } from './database';

export class OxfordHouseService {
  // Comprehensive Oxford House data - realistic addresses and phone numbers
  private static readonly SAMPLE_HOUSES: Omit<OxfordHouse, 'id' | 'createdAt' | 'updatedAt'>[] = [
    // Charlotte Area Houses
    {
      name: 'Oxford House Charlotte - Central',
      address: '1234 Central Avenue',
      city: 'Charlotte',
      state: 'NC',
      zipCode: '28204',
      phoneNumber: '(704) 555-0101'
    },
    {
      name: 'Oxford House Charlotte - South',
      address: '5678 South Boulevard',
      city: 'Charlotte',
      state: 'NC',
      zipCode: '28203',
      phoneNumber: '(704) 555-0102'
    },
    {
      name: 'Oxford House Charlotte - East',
      address: '9012 Independence Boulevard',
      city: 'Charlotte',
      state: 'NC',
      zipCode: '28205',
      phoneNumber: '(704) 555-0103'
    },
    
    // Raleigh Area Houses
    {
      name: 'Oxford House Raleigh - Downtown',
      address: '2345 Glenwood Avenue',
      city: 'Raleigh',
      state: 'NC',
      zipCode: '27608',
      phoneNumber: '(919) 555-0201'
    },
    {
      name: 'Oxford House Raleigh - North',
      address: '6789 Six Forks Road',
      city: 'Raleigh',
      state: 'NC',
      zipCode: '27615',
      phoneNumber: '(919) 555-0202'
    },
    {
      name: 'Oxford House Raleigh - West',
      address: '3456 Hillsborough Street',
      city: 'Raleigh',
      state: 'NC',
      zipCode: '27606',
      phoneNumber: '(919) 555-0203'
    },
    
    // Durham Area Houses
    {
      name: 'Oxford House Durham - Central',
      address: '4567 Main Street',
      city: 'Durham',
      state: 'NC',
      zipCode: '27701',
      phoneNumber: '(919) 555-0301'
    },
    {
      name: 'Oxford House Durham - South',
      address: '7890 Fayetteville Road',
      city: 'Durham',
      state: 'NC',
      zipCode: '27713',
      phoneNumber: '(919) 555-0302'
    },
    
    // Greensboro Area Houses
    {
      name: 'Oxford House Greensboro - Central',
      address: '1234 Elm Street',
      city: 'Greensboro',
      state: 'NC',
      zipCode: '27401',
      phoneNumber: '(336) 555-0401'
    },
    {
      name: 'Oxford House Greensboro - West',
      address: '5678 West Market Street',
      city: 'Greensboro',
      state: 'NC',
      zipCode: '27407',
      phoneNumber: '(336) 555-0402'
    },
    {
      name: 'Oxford House Greensboro - East',
      address: '9012 East Wendover Avenue',
      city: 'Greensboro',
      state: 'NC',
      zipCode: '27405',
      phoneNumber: '(336) 555-0403'
    },
    
    // Winston-Salem Area Houses
    {
      name: 'Oxford House Winston-Salem - Central',
      address: '2345 North Main Street',
      city: 'Winston-Salem',
      state: 'NC',
      zipCode: '27101',
      phoneNumber: '(336) 555-0501'
    },
    {
      name: 'Oxford House Winston-Salem - South',
      address: '6789 South Stratford Road',
      city: 'Winston-Salem',
      state: 'NC',
      zipCode: '27103',
      phoneNumber: '(336) 555-0502'
    },
    
    // Asheville Area Houses
    {
      name: 'Oxford House Asheville - Central',
      address: '3456 Haywood Road',
      city: 'Asheville',
      state: 'NC',
      zipCode: '28806',
      phoneNumber: '(828) 555-0601'
    },
    {
      name: 'Oxford House Asheville - North',
      address: '7890 Merrimon Avenue',
      city: 'Asheville',
      state: 'NC',
      zipCode: '28804',
      phoneNumber: '(828) 555-0602'
    },
    
    // Wilmington Area Houses
    {
      name: 'Oxford House Wilmington - Central',
      address: '4567 Market Street',
      city: 'Wilmington',
      state: 'NC',
      zipCode: '28401',
      phoneNumber: '(910) 555-0701'
    },
    {
      name: 'Oxford House Wilmington - South',
      address: '8901 South College Road',
      city: 'Wilmington',
      state: 'NC',
      zipCode: '28403',
      phoneNumber: '(910) 555-0702'
    },
    
    // Fayetteville Area Houses
    {
      name: 'Oxford House Fayetteville - Central',
      address: '5678 Bragg Boulevard',
      city: 'Fayetteville',
      state: 'NC',
      zipCode: '28301',
      phoneNumber: '(910) 555-0801'
    },
    {
      name: 'Oxford House Fayetteville - West',
      address: '9012 Raeford Road',
      city: 'Fayetteville',
      state: 'NC',
      zipCode: '28305',
      phoneNumber: '(910) 555-0802'
    },
    
    // Gastonia Area Houses
    {
      name: 'Oxford House Gastonia - Central',
      address: '1234 Franklin Boulevard',
      city: 'Gastonia',
      state: 'NC',
      zipCode: '28052',
      phoneNumber: '(704) 555-0901'
    },
    
    // Concord Area Houses
    {
      name: 'Oxford House Concord - Central',
      address: '2345 Union Street',
      city: 'Concord',
      state: 'NC',
      zipCode: '28025',
      phoneNumber: '(704) 555-1001'
    },
    
    // High Point Area Houses
    {
      name: 'Oxford House High Point - Central',
      address: '3456 North Main Street',
      city: 'High Point',
      state: 'NC',
      zipCode: '27260',
      phoneNumber: '(336) 555-1101'
    },
    
    // Burlington Area Houses
    {
      name: 'Oxford House Burlington - Central',
      address: '4567 South Church Street',
      city: 'Burlington',
      state: 'NC',
      zipCode: '27215',
      phoneNumber: '(336) 555-1201'
    },
    
    // Rocky Mount Area Houses
    {
      name: 'Oxford House Rocky Mount - Central',
      address: '5678 Sunset Avenue',
      city: 'Rocky Mount',
      state: 'NC',
      zipCode: '27804',
      phoneNumber: '(252) 555-1301'
    },
    
    // Wilson Area Houses
    {
      name: 'Oxford House Wilson - Central',
      address: '6789 Nash Street',
      city: 'Wilson',
      state: 'NC',
      zipCode: '27893',
      phoneNumber: '(252) 555-1401'
    },
    
    // Greenville Area Houses
    {
      name: 'Oxford House Greenville - Central',
      address: '7890 Evans Street',
      city: 'Greenville',
      state: 'NC',
      zipCode: '27834',
      phoneNumber: '(252) 555-1501'
    },
    
    // Additional Major Cities
    {
      name: 'Oxford House Cary',
      address: '1234 Kildaire Farm Road',
      city: 'Cary',
      state: 'NC',
      zipCode: '27511',
      phoneNumber: '(919) 555-1601'
    },
    {
      name: 'Oxford House Chapel Hill',
      address: '2345 Franklin Street',
      city: 'Chapel Hill',
      state: 'NC',
      zipCode: '27516',
      phoneNumber: '(919) 555-1701'
    },
    {
      name: 'Oxford House Hickory',
      address: '3456 North Center Street',
      city: 'Hickory',
      state: 'NC',
      zipCode: '28601',
      phoneNumber: '(828) 555-1801'
    },
    {
      name: 'Oxford House Jacksonville',
      address: '4567 Marine Boulevard',
      city: 'Jacksonville',
      state: 'NC',
      zipCode: '28540',
      phoneNumber: '(910) 555-1901'
    },
    {
      name: 'Oxford House Goldsboro',
      address: '5678 Wayne Memorial Drive',
      city: 'Goldsboro',
      state: 'NC',
      zipCode: '27534',
      phoneNumber: '(919) 555-2001'
    }
  ];

  static async initializeOxfordHouses(): Promise<void> {
    try {
      console.log('Initializing Oxford Houses...');
      
      // Check if houses already exist
      const existingHouses = await this.getAllOxfordHouses();
      
      if (existingHouses.length === 0) {
        console.log('No Oxford Houses found, creating sample data...');
        
        // Create sample houses
        for (const houseData of this.SAMPLE_HOUSES) {
          await DatabaseService.createOxfordHouse(houseData);
        }
        
        console.log(`Created ${this.SAMPLE_HOUSES.length} Oxford Houses`);
      } else {
        console.log(`Found ${existingHouses.length} existing Oxford Houses`);
      }
    } catch (error) {
      console.error('Error initializing Oxford Houses:', error);
      throw error;
    }
  }

  static async getAllOxfordHouses(): Promise<OxfordHouse[]> {
    return await DatabaseService.getOxfordHouses();
  }

  static async searchOxfordHouses(query: string): Promise<OxfordHouse[]> {
    if (!query.trim()) {
      return await this.getAllOxfordHouses();
    }

    const allHouses = await this.getAllOxfordHouses();
    const searchTerm = query.toLowerCase().trim();

    return allHouses.filter(house => 
      house.name.toLowerCase().includes(searchTerm) ||
      house.address.toLowerCase().includes(searchTerm) ||
      house.city.toLowerCase().includes(searchTerm) ||
      house.state.toLowerCase().includes(searchTerm) ||
      house.zipCode.includes(searchTerm)
    );
  }

  static async getOxfordHouseById(id: string): Promise<OxfordHouse | null> {
    const houses = await this.getAllOxfordHouses();
    return houses.find(house => house.id === id) || null;
  }

  static formatHouseDisplay(house: OxfordHouse): string {
    return `${house.name} - ${house.address}, ${house.city}, ${house.state} ${house.zipCode}`;
  }

  static formatHouseAddress(house: OxfordHouse): string {
    return `${house.address}, ${house.city}, ${house.state} ${house.zipCode}`;
  }
}
