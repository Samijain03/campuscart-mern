export function priceOrder(items, products) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error('Your cart must contain between 1 and 100 items.');
  const quantities = new Map();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Quantity must be between 1 and 99.');
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  const lines = [...quantities].map(([id, quantity]) => {
    const product = products.find(p => p.id === id);
    if (!product) throw new Error('A product is no longer available.');
    if (quantity > product.stock) throw new Error(`Only ${product.stock} of ${product.name} available.`);
    return { productId: id, name: product.name, price: product.price, quantity };
  });
  const subtotal = lines.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = subtotal >= 499 ? 0 : 49;
  return {items: lines, subtotal, shipping, total: subtotal + shipping};
}
