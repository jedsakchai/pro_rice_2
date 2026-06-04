function buildProductCarouselFlex(products = []) {
  return {
    type: 'flex',
    altText: 'รายการสินค้าโรงสีข้าว',
    contents: {
      type: 'carousel',
      contents: products.slice(0, 10).map((product) => ({
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#1F4E3D',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: product.product_name_th || product.product_name || '-', weight: 'bold', color: '#FFFFFF', size: 'md', wrap: true },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: `ราคา ${Number(product.price || 0).toLocaleString('th-TH')} บาท`, size: 'sm', wrap: true },
            { type: 'text', text: `คงเหลือ ${product.stock || 0}`, size: 'sm', wrap: true },
            { type: 'text', text: product.description_th || product.description || '', size: 'xs', wrap: true, color: '#666666', margin: 'md' },
          ],
        },
      })),
    },
  };
}

module.exports = {
  buildProductCarouselFlex,
};