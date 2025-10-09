// Test filename generation
const nameParts = 'Greg Weisz'.split(' ');
const lastName = nameParts[nameParts.length - 1] || 'UNKNOWN';
const firstName = nameParts[0] || 'UNKNOWN';
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthIndex = monthNames.findIndex(month => month === 'October'.toUpperCase().substring(0, 3));
const monthAbbr = monthIndex >= 0 ? monthNames[monthIndex] : 'October'.toUpperCase().substring(0, 3);
const yearShort = (2025).toString().slice(-2);
const filename = `${lastName.toUpperCase()},${firstName.toUpperCase()} EXPENSES ${monthAbbr}-${yearShort}.pdf`;
console.log('Generated filename:', filename);
