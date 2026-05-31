const fs = require('fs');
let code = fs.readFileSync('src/components/CookDashboard.tsx', 'utf-8');

const targetStr = `<div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 py-2">
                      {filteredProducts.map(product => (
                          <Card 
                          key={product.id} 
                          className={\`border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-sm transition-all cursor-pointer group bg-white dark:bg-slate-900 overflow-hidden flex flex-col \${user.role !== 'viewer' ? 'hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 active:scale-95' : 'cursor-not-allowed opacity-70'}\`} 
                          onClick={() => user.role !== 'viewer' && addToCart(product)}
                        >
                          <CardHeader className="p-4 md:p-6 pb-3 md:pb-4 flex-1">
                            <div className="flex justify-between items-start mb-3 md:mb-4">
                              <Badge variant="outline" className="text-xs md:text-sm uppercase font-black tracking-widest border-slate-200 bg-slate-50 text-slate-700 dark:text-slate-300 rounded-lg h-6 md:h-7 px-2 border">
                                {product.category.substring(0, 15)}{product.category.length > 15 ? '...' : ''}
                              </Badge>
                              <div className="flex flex-col items-end">
                                <span className="text-xl md:text-2xl font-black font-mono text-slate-900 leading-none">{product.quantity}</span>
                                <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">{product.unit}</span>
                              </div>
                            </div>
                            <CardTitle className="text-sm md:text-base font-black text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight">{product.name}</CardTitle>
                          </CardHeader>
                          <div className="h-1.5 bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
                        </Card>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div className="col-span-full h-40 md:h-60 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 space-y-3 opacity-30">
                            <Search className="w-8 h-8 md:w-10 md:h-10" />
                            <p className="text-sm md:text-base font-bold uppercase">No encontrado</p>
                        </div>
                      )}
                    </div>`;

const ProductCard = `{products.map(product => (
                          <Card 
                          key={product.id} 
                          className={\`border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-sm transition-all cursor-pointer group bg-white dark:bg-slate-900 overflow-hidden flex flex-col \${user.role !== 'viewer' ? 'hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 active:scale-95' : 'cursor-not-allowed opacity-70'}\`} 
                          onClick={() => user.role !== 'viewer' && addToCart(product)}
                        >
                          <CardHeader className="p-4 md:p-6 pb-3 md:pb-4 flex-1">
                            <div className="flex justify-between items-start mb-3 md:mb-4">
                              <Badge variant="outline" className="text-xs md:text-sm uppercase font-black tracking-widest border-slate-200 bg-slate-50 text-slate-700 dark:text-slate-300 rounded-lg h-6 md:h-7 px-2 border">
                                {product.category.substring(0, 15)}{product.category.length > 15 ? '...' : ''}
                              </Badge>
                              <div className="flex flex-col items-end">
                                <span className="text-xl md:text-2xl font-black font-mono text-slate-900 leading-none">{product.quantity}</span>
                                <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">{product.unit}</span>
                              </div>
                            </div>
                            <CardTitle className="text-sm md:text-base font-black text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight">{product.name}</CardTitle>
                          </CardHeader>
                          <div className="h-1.5 bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
                        </Card>
                      ))}`;

const renderGroupedList = `{selectedCategory ? (
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 py-2">
                        {(() => {
                          const products = filteredProducts;
                          return products.length > 0 ? (
                            <>${ProductCard}</>
                          ) : (
                            <div className="col-span-full h-40 md:h-60 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 space-y-3 opacity-30">
                                <Search className="w-8 h-8 md:w-10 md:h-10" />
                                <p className="text-sm md:text-base font-bold uppercase">No encontrado</p>
                            </div>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {filteredCategories.map(category => {
                           const products = filteredProducts.filter(p => p.category === category.name);
                           if (products.length === 0) return null;
                           return (
                             <div key={category.id} className="space-y-4">
                               <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">{category.name}</h3>
                               <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                                 ${ProductCard}
                               </div>
                             </div>
                           );
                        })}
                        {filteredProducts.length === 0 && (
                          <div className="h-40 md:h-60 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 space-y-3 opacity-30">
                              <Search className="w-8 h-8 md:w-10 md:h-10" />
                              <p className="text-sm md:text-base font-bold uppercase">No encontrado</p>
                          </div>
                        )}
                      </div>
                    )}`;

if (code.includes(targetStr)) {
code = code.replace(targetStr, renderGroupedList);
fs.writeFileSync('src/components/CookDashboard.tsx', code);
console.log('replaced successfully');
} else {
console.log('target not found');
}
