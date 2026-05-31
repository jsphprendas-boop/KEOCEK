import fs from 'fs';
const data = JSON.parse(fs.readFileSync('backup_main_db.json', 'utf-8'));
const arroz = data.products.filter(p => p.name.toLowerCase().includes('arroz'));
console.log(arroz);
