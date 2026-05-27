// Local storage key (scoped per logged-in villager)
function getSessionVillagerId() {
  const session = window.OwnerSession?.get?.();
  const id = Number(session?.villager_id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getCartStorageKey() {
  const villagerId = getSessionVillagerId();
  return villagerId ? `rice_mill_cart_v_${villagerId}` : 'rice_mill_cart_guest';
}

function getOrderPreviewStorageKey() {
  const villagerId = getSessionVillagerId();
  return villagerId ? `rice_mill_order_preview_v_${villagerId}` : 'rice_mill_order_preview_guest';
}

let cart = [];

function enrichCartItem(item) {
  const product = (window.__allProductsForCart || []).find(p => Number(p.product_id) === Number(item.product_id));
  if (!product) return item;
  return {
    ...item,
    mill_id: item.mill_id || product.mill_id || null,
    mill_name: item.mill_name || product.mill_name || '',
    mill_name_th: item.mill_name_th || product.mill_name_th || '',
    product_name_th: item.product_name_th || product.product_name_th || '',
    unit_th: item.unit_th || product.unit_th || '',
    price: Number(item.price || product.price || 0),
    stock: Number(item.stock || product.stock || 0),
    image_url: item.image_url || product.image_url || '',
    has_image: item.has_image !== undefined ? item.has_image : (product.has_image || false),
    product_id: item.product_id || product.product_id
  };
}

// Load cart from localStorage
function loadCart() {
  const cartKey = getCartStorageKey();
  let stored = localStorage.getItem(cartKey);
  if (!stored) {
    const legacy = localStorage.getItem('rice_mill_cart');
    if (legacy) {
      stored = legacy;
      localStorage.setItem(cartKey, legacy);
    }
  }
  cart = stored ? JSON.parse(stored) : [];
  cart = cart.map(enrichCartItem);
  displayCart();
}

async function hydrateProductsForCart() {
  try {
    const cached = localStorage.getItem('rice_mill_products');
    if (cached) {
      window.__allProductsForCart = JSON.parse(cached) || [];
      cart = cart.map(enrichCartItem);
      return;
    }
    const res = await fetch('/api/products');
    const json = await res.json();
    window.__allProductsForCart = Array.isArray(json?.data) ? json.data : [];
    cart = cart.map(enrichCartItem);
  } catch {
    window.__allProductsForCart = [];
  }
}

// Save cart to localStorage
function saveCart() {
  localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
  displayCart();
}

// Display cart
function displayCart() {
  const container = document.getElementById('cart-content');
  
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <div class="empty-cart-icon">🛒</div>
        <h2 class="text-2xl font-bold text-gray-700 mb-2">ตะกร้าว่างเปล่า</h2>
        <p class="empty-cart-text">คุณยังไม่ได้เลือกสินค้า</p>
        <a href="/order.html" class="inline-block px-6 py-3 bg-field-600 text-white rounded-lg font-semibold hover:bg-field-700 transition">
          กลับไปเลือกสินค้า
        </a>
      </div>
    `;
    return;
  }
  
  // Group items by mill_id
  const groupedByMill = {};
  cart.forEach((item, index) => {
    const millId = item.mill_id || 'unknown';
    if (!groupedByMill[millId]) {
      groupedByMill[millId] = [];
    }
    groupedByMill[millId].push({ item, index });
  });
  
  let totalAllMills = 0;
  let itemCountAllMills = 0;
  
  let html = '';
  
  Object.entries(groupedByMill).forEach(([millId, items]) => {
    let millTotal = 0;
    let millItemCount = 0;
    const millName = items[0]?.item?.mill_name_th || items[0]?.item?.mill_name || `โรงสี ID: ${millId}`;
    
    const tableRows = items.map(({ item, index }) => {
    const itemTotal = item.price * item.quantity;
    millTotal += itemTotal;
    millItemCount += item.quantity;
    const imageUrl = item.has_image ? `/api/products/${item.product_id}/image` : (item.image_url || '/images/placeholder.jpg');
    
    return `
      <tr data-cart-index="${index}">
        <td data-col="product">
          <div class="cart-col-label">สินค้า</div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <div class="cart-item-image">
              <img src="${imageUrl}" alt="${item.product_name_th}" onerror="this.src='/images/placeholder.jpg'">
            </div>
            <div>
              <div class="cart-item-name">${item.product_name_th}</div>
              <div class="cart-item-unit">${item.unit_th}</div>
            </div>
          </div>
        </td>
        <td class="cart-item-price" data-col="price">
          <div class="cart-col-label">ราคาต่อหน่วย</div>
          ฿${item.price.toFixed(2)}
        </td>
        <td data-col="qty">
          <div class="cart-col-label">จำนวน</div>
          <div class="quantity-selector">
            <button class="quantity-btn" onclick="changeCartQuantity(${index}, -1)">−</button>
            <input type="number" class="quantity-input" id="cart-qty-${index}" value="${item.quantity}" 
                   min="1" max="${item.stock}" onchange="validateCartQuantity(${index})">
            <button class="quantity-btn" onclick="changeCartQuantity(${index}, 1)">+</button>
          </div>
        </td>
        <td class="cart-item-price" data-col="total">
          <div class="cart-col-label">รวม</div>
          ฿${itemTotal.toFixed(2)}
        </td>
        <td data-col="action">
          <div class="cart-col-label">การจัดการ</div>
          <button class="remove-btn" onclick="removeFromCart(${index})">
            ลบ
          </button>
        </td>
      </tr>
    `;
    }).join('');
    
    totalAllMills += millTotal;
    itemCountAllMills += millItemCount;
    
    html += `
      <div class="mill-section" style="margin-bottom: 2rem; padding: 1rem; background-color: #f9f9f9; border-radius: 8px; border-left: 4px solid #8B5D3C;">
        <h3 style="font-weight: bold; color: #333; margin-bottom: 1rem;">${millName}</h3>
        <div class="cart-table-wrap">
          <table class="cart-table">
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>ราคาต่อหน่วย</th>
              <th>จำนวน</th>
              <th>รวม</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          </table>
        </div>
        <div class="mill-subtotal" style="text-align: right; padding: 1rem 0; border-top: 1px solid #ddd; margin-top: 1rem;">
          <div style="margin-bottom: 0.5rem;">จำนวน: <strong>${millItemCount}</strong> ชิ้น</div>
          <div style="font-size: 1.1rem; color: #8B5D3C;">รวม: <strong>฿${millTotal.toFixed(2)}</strong></div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = `
    ${html}
    
    <div class="cart-summary">
      <div class="summary-row">
        <span class="summary-label">จำนวนรายการ:</span>
        <span class="summary-value">${itemCountAllMills} ชิ้น</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">ราคารวม:</span>
        <span class="summary-value">฿${totalAllMills.toFixed(2)}</span>
      </div>
      <div class="summary-row total">
        <span>รวมทั้งสิ้น:</span>
        <span>฿${totalAllMills.toFixed(2)}</span>
      </div>
      
      <div class="cart-actions">
        <a href="/order.html" class="btn-secondary">
          เลือกสินค้าเพิ่มเติม
        </a>
        <button class="btn-primary" onclick="checkout()">
          ดำเนินการสั่งซื้อ
        </button>
      </div>
    </div>
  `;
}

// Change quantity in cart
function changeCartQuantity(index, change) {
  const input = document.getElementById(`cart-qty-${index}`);
  const newValue = Math.max(1, parseInt(input.value) + change);
  input.value = newValue;
  validateCartQuantity(index);
}

// Validate cart quantity
function validateCartQuantity(index) {
  const item = cart[index];
  const input = document.getElementById(`cart-qty-${index}`);
  const value = parseInt(input.value);
  
  if (isNaN(value)) {
    input.value = 1;
  } else if (value < 1) {
    input.value = 1;
  } else if (value > item.stock) {
    input.value = item.stock;
  }
  
  cart[index].quantity = parseInt(input.value);
  saveCart();
}

// Remove from cart
function removeFromCart(index) {
  const item = cart[index];
  if (confirm(`ต้องการลบ "${item.product_name_th}" ออกจากตะกร้าหรือไม่?`)) {
    cart.splice(index, 1);
    saveCart();
  }
}

// Checkout
function checkout() {
  if (cart.length === 0) {
    alert('ตะกร้าว่างเปล่า');
    return;
  }
  
  // Prepare order data
  const orderData = {
    items: cart.map(item => ({
      product_id: item.product_id,
      product_name_th: item.product_name_th,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
      mill_id: item.mill_id || null,
      mill_name: item.mill_name || item.mill_name_th || ''
    })),
    total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0)
  };
  
  // Save order data temporarily
  localStorage.setItem(getOrderPreviewStorageKey(), JSON.stringify(orderData));
  
  // Redirect to checkout page (you'll need to create this)
  window.location.href = '/checkout.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  hydrateProductsForCart().finally(() => loadCart());
});
