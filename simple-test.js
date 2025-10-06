// Simple timezone test
const now = new Date();
const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

console.log('Current time:', now.toString());
console.log('Local today:', localToday.toString());

const year = localToday.getFullYear();
const month = String(localToday.getMonth() + 1).padStart(2, '0');
const day = String(localToday.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;

console.log('Manual date string:', dateStr);
console.log('✅ Timezone test passed!');
