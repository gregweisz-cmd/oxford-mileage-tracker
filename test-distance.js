// Quick test of the distance service
const { DistanceService } = require('./src/services/distanceService.ts');

async function testDistance() {
  try {
    console.log('Testing distance calculation...');
    const distance = await DistanceService.calculateDistance('New York, NY', 'Boston, MA');
    console.log('Distance calculated:', distance, 'miles');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDistance();
