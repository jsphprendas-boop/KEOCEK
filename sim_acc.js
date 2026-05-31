import fs from 'fs';
const data = JSON.parse(fs.readFileSync('backup_main_db.json', 'utf-8'));
const criticalProducts = [];
data.products.forEach((p) => {
    const qty = parseFloat(p.quantity || "0");
    const customMin = parseFloat(p.minStock);
    const minQty = !isNaN(customMin) ? customMin : (data.settings?.criticalStockThreshold || 10);
    if (qty <= minQty) {
        criticalProducts.push({ ...p, computedMin: minQty });
    }
});
console.log("Critical length:", criticalProducts.length);
console.log(criticalProducts.filter(p => p.name.includes('Arroz')));
