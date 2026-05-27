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

const PRODUCTS_STORAGE_KEY = 'rice_mill_products';

// Initialize
let allProducts = [];
let cart = [];
let currentCategory = 'all';
let searchQuery = '';
let selectedMillIds = new Set();

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
  updateCartUI();
}

// Save cart to localStorage
function saveCart() {
  localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
  updateCartUI();
}

// Update cart UI
function updateCartUI() {
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Update cart count in header and footer
  document.querySelectorAll('#cart-count, #cart-count-bottom').forEach(el => {
    el.textContent = cartCount;
  });
  
  // Update total price
  const totalPriceEl = document.getElementById('total-price');
  if (totalPriceEl) {
    totalPriceEl.textContent = '฿' + totalPrice.toFixed(2);
  }
}

// Fetch products from API
async function fetchProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();

    if (result && result.success && Array.isArray(result.data)) {
      allProducts = result.data;
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(allProducts));
    } else {
      const cached = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      allProducts = cached ? JSON.parse(cached) : [];
    }

    // Build category tabs
    buildCategoryTabs();

    // Populate mill filter dropdown
    populateMillFilter();

    // Display products
    displayProducts();
  } catch (error) {
    console.error('Error fetching products:', error);
    try {
      const cached = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      allProducts = cached ? JSON.parse(cached) : [];
      buildCategoryTabs();
      displayProducts();
    } catch {
      document.getElementById('products-container').innerHTML = 
        '<div class="no-products">ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่</div>';
    }
  }
}

// Populate mill filter with checkbox tiles from database
async function populateMillFilter() {
  const select = document.getElementById('mill-filter');
  if (!select) return;

  try {
    const response = await fetch('/api/mills');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const mills = Array.isArray(result?.data) ? result.data : [];

    select.innerHTML = '';

    const summary = document.getElementById('mill-filter-summary');

    const createOption = (labelText, value, checked = false) => {
      const label = document.createElement('label');
      label.className = `mill-filter-option${checked ? ' is-selected' : ''}`;
      label.innerHTML = `
        <input type="checkbox" data-mill-value="${value}" ${checked ? 'checked' : ''}>
        <span>${labelText}</span>
      `;
      return label;
    };

    select.appendChild(createOption('แสดงทุกโรงสี', 'all', true));
    mills.forEach((mill) => {
      const millId = String(mill.mill_id || '');
      const millName = mill.mill_name_th || mill.mill_name || `โรงสี ${mill.mill_id}`;
      select.appendChild(createOption(millName, millId, false));
    });

    const syncSelection = () => {
      const allCheckbox = select.querySelector('input[data-mill-value="all"]');
      const millCheckboxes = Array.from(select.querySelectorAll('input[type="checkbox"]')).filter(input => input !== allCheckbox);
      const selectedValues = millCheckboxes
        .filter(input => input.checked)
        .map(input => input.getAttribute('data-mill-value'))
        .filter(value => value);

      if (allCheckbox?.checked || selectedValues.length === 0) {
        if (allCheckbox) allCheckbox.checked = true;
        millCheckboxes.forEach((input) => { input.checked = false; });
        selectedMillIds.clear();
        if (summary) summary.textContent = 'แสดงทุกโรงสี';
      } else {
        if (allCheckbox) allCheckbox.checked = false;
        selectedMillIds = new Set(selectedValues.map(v => String(Number(v))));
        if (summary) summary.textContent = `เลือก ${selectedValues.length} โรงสี`;
      }

      select.querySelectorAll('.mill-filter-option').forEach((label) => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        label.classList.toggle('is-selected', checkbox.checked);
      });

      // Reset category to 'all' when mill filter changes
      selectCategory('all');
      displayProducts();
    };

    select.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const value = checkbox.getAttribute('data-mill-value');
        const allCheckbox = select.querySelector('input[data-mill-value="all"]');

        if (value === 'all' && checkbox.checked) {
          select.querySelectorAll('input[type="checkbox"]').forEach((other) => {
            if (other !== checkbox) other.checked = false;
          });
        } else if (value !== 'all' && checkbox.checked) {
          if (allCheckbox) allCheckbox.checked = false;
        }

        syncSelection();
      });
    });

    syncSelection();
  } catch (error) {
    console.error('Error loading mills:', error);
  }
}

// Build category tabs
function buildCategoryTabs() {
  const categoriesSet = new Set();
  allProducts.forEach(product => {
    categoriesSet.add(JSON.stringify({ 
      category: product.category, 
      category_th: product.category_th 
    }));
  });
  
  const categories = Array.from(categoriesSet)
    .map(item => JSON.parse(item))
    .sort((a, b) => a.category_th.localeCompare(b.category_th, 'th'));
  
  const tabsContainer = document.getElementById('category-tabs-container');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = `
    <button class="category-tab active" data-category="all" onclick="selectCategory('all')">
      ทั้งหมด
    </button>
  `;
  
  // Add category tabs
  categories.forEach(cat => {
    const button = document.createElement('button');
    button.className = 'category-tab';
    button.setAttribute('data-category', cat.category);
    button.textContent = cat.category_th;
    button.onclick = () => selectCategory(cat.category);
    tabsContainer.appendChild(button);
  });
}

// Select category
function selectCategory(category) {
  currentCategory = category;
  searchQuery = document.getElementById('search-input')?.value || '';
  
  // Update active tab
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-category') === category);
  });
  
  displayProducts();
}

// Search products
function searchProducts() {
  searchQuery = document.getElementById('search-input')?.value || '';
  displayProducts();
}

// Filter products
function getFilteredProducts() {
  let filtered = allProducts;
  
  // Filter by category
  if (currentCategory !== 'all') {
    filtered = filtered.filter(p => p.category === currentCategory);
  }
  
  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.product_name_th.toLowerCase().includes(query) ||
      p.product_name.toLowerCase().includes(query) ||
      p.description_th.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
  }
  
  // Filter by selected mills
  if (selectedMillIds && selectedMillIds.size > 0) {
    filtered = filtered.filter(p => {
      const mid = p.mill_id ? String(Number(p.mill_id)) : '';
      return selectedMillIds.has(mid);
    });
  }

  return filtered;
}

// Display products
function displayProducts() {
  const filtered = getFilteredProducts();
  const container = document.getElementById('products-container');
  if (!container) return;
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-products">ไม่พบสินค้า</div>';
    return;
  }
  // If user filtered by one or more mills, group products per mill
  if (selectedMillIds && selectedMillIds.size > 0) {
    // Group by mill_id
    const groups = {};
    filtered.forEach(p => {
      const mid = p.mill_id ? String(Number(p.mill_id)) : 'unknown';
      if (!groups[mid]) groups[mid] = { millId: mid, millName: p.mill_name_th || p.mill_name || `โรงสี ${mid}`, items: [] };
      groups[mid].items.push(p);
    });

    // Build HTML grouped by mill
    container.innerHTML = Object.values(groups).map(group => {
      const itemsHtml = group.items.map(product => {
        const cartItem = cart.find(item => item.product_id === product.product_id);
        const quantity = cartItem ? cartItem.quantity : 1;
        const price = Number(product.price) || 0;
        const stock = Number(product.stock) || 0;
        const imageUrl = product.has_image ? `/api/products/${product.product_id}/image` : (product.image_url || '/images/placeholder.jpg');
        return `
          <div class="product-list-item" data-product-id="${product.product_id}">
            <div class="product-image">
              <img src="${imageUrl}" alt="${product.product_name_th}" onerror="this.src='/images/placeholder.jpg'">
            </div>
            <div class="product-info">
              <div>
                <div class="product-header">
                  <div class="product-name">${product.product_name_th}</div>
                  <div class="product-description">${product.description_th}</div>
                  <div class="product-description" style="margin-top:0.25rem;font-size:0.8rem;color:#6b7280;">โรงสี: ${group.millName}</div>
                </div>
                <div class="product-meta">
                  <div class="product-meta-item">
                    <div class="product-meta-label">ราคา</div>
                    <div class="product-meta-value product-price">฿${price.toFixed(2)}</div>
                  </div>
                  <div class="product-meta-item">
                    <div class="product-meta-label">หน่วย</div>
                    <div class="product-meta-value">${product.unit_th}</div>
                  </div>
                  <div class="product-meta-item">
                    <div class="product-meta-label">จำนวนคงเหลือ</div>
                    <div class="product-meta-value">${stock} ชิ้น</div>
                  </div>
                </div>
              </div>
              <div class="product-actions">
                <div class="quantity-selector">
                  <button class="quantity-btn" onclick="changeQuantity(${product.product_id}, -1)">−</button>
                  <input type="number" class="quantity-input" id="qty-${product.product_id}" value="${quantity}" min="1" max="${stock}" onchange="validateQuantity(${product.product_id})">
                  <button class="quantity-btn" onclick="changeQuantity(${product.product_id}, 1)">+</button>
                </div>
                <button class="add-to-cart-btn" onclick="addToCart(${product.product_id})" ${stock === 0 ? 'disabled' : ''}>
                  ${stock === 0 ? 'สินค้าหมด' : 'เพิ่มลงตะกร้า'}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <section style="margin-bottom:1.75rem">
          <h3 style="margin:0 0 0.75rem 0;color:#2d5016;font-weight:700">สินค้า - ${group.millName}</h3>
          ${itemsHtml}
        </section>
      `;
    }).join('');
    return;
  }

  container.innerHTML = filtered.map(product => {
    const cartItem = cart.find(item => item.product_id === product.product_id);
    const quantity = cartItem ? cartItem.quantity : 1;
    const price = Number(product.price) || 0;
    const stock = Number(product.stock) || 0;
    const millName = product.mill_name_th || product.mill_name || 'ไม่ระบุโรงสี';
    const imageUrl = product.has_image ? `/api/products/${product.product_id}/image` : (product.image_url || '/images/placeholder.jpg');
    
    return `
      <div class="product-list-item" data-product-id="${product.product_id}">
        <div class="product-image">
          <img src="${imageUrl}" alt="${product.product_name_th}" onerror="this.src='/images/placeholder.jpg'">
        </div>
        <div class="product-info">
          <div>
            <div class="product-header">
              <div class="product-name">${product.product_name_th}</div>
              <div class="product-description">${product.description_th}</div>
              <div class="product-description" style="margin-top:0.25rem;font-size:0.8rem;color:#6b7280;">โรงสี: ${millName}</div>
            </div>
            
            <div class="product-meta">
              <div class="product-meta-item">
                <div class="product-meta-label">ราคา</div>
                <div class="product-meta-value product-price">฿${price.toFixed(2)}</div>
              </div>
              <div class="product-meta-item">
                <div class="product-meta-label">หน่วย</div>
                <div class="product-meta-value">${product.unit_th}</div>
              </div>
              <div class="product-meta-item">
                <div class="product-meta-label">จำนวนคงเหลือ</div>
                  <div class="product-meta-value">${stock} ชิ้น</div>
              </div>
              <div class="product-meta-item">
                <div class="product-meta-label">หมวดหมู่</div>
                <div class="product-meta-value">${product.category_th}</div>
              </div>
            </div>
          </div>
          
          <div class="product-actions">
            <div class="quantity-selector">
              <button class="quantity-btn" onclick="changeQuantity(${product.product_id}, -1)">−</button>
              <input type="number" class="quantity-input" id="qty-${product.product_id}" value="${quantity}" 
                       min="1" max="${stock}" onchange="validateQuantity(${product.product_id})">
              <button class="quantity-btn" onclick="changeQuantity(${product.product_id}, 1)">+</button>
            </div>
            <button class="add-to-cart-btn" onclick="addToCart(${product.product_id})" 
                      ${stock === 0 ? 'disabled' : ''}>
                ${stock === 0 ? 'สินค้าหมด' : 'เพิ่มลงตะกร้า'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Change quantity
function changeQuantity(productId, change) {
  const input = document.getElementById(`qty-${productId}`);
  const newValue = Math.max(1, parseInt(input.value) + change);
  input.value = newValue;
  validateQuantity(productId);
}

// Validate quantity
function validateQuantity(productId) {
  const product = allProducts.find(p => p.product_id === productId);
  const input = document.getElementById(`qty-${productId}`);
  const value = parseInt(input.value);
  const stock = Number(product.stock) || 0;
  
  if (isNaN(value)) {
    input.value = 1;
  } else if (value < 1) {
    input.value = 1;
  } else if (value > stock) {
    input.value = stock;
  }
}

// Add to cart
function addToCart(productId) {
  const product = allProducts.find(p => p.product_id === productId);
  const quantityInput = document.getElementById(`qty-${productId}`);
  const quantity = parseInt(quantityInput.value) || 1;
  const stock = Number(product.stock) || 0;
  
  if (quantity > stock) {
    alert('จำนวนที่ขอมากกว่าสินค้าที่มี');
    quantityInput.value = stock;
    return;
  }
  
  // Check if already in cart
  const existingItem = cart.find(item => item.product_id === productId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
    if (existingItem.quantity > stock) {
      existingItem.quantity = stock;
    }
  } else {
    cart.push({
      product_id: productId,
      product_name_th: product.product_name_th,
      price: Number(product.price) || 0,
      unit_th: product.unit_th,
      image_url: product.image_url,
      mill_name: product.mill_name || product.mill_name_th || '',
      mill_name_th: product.mill_name_th || product.mill_name || '',
      quantity: quantity,
      stock: stock,
      mill_id: product.mill_id || null
    });
  }
  
  // Reset quantity input
  quantityInput.value = 1;
  
  // Save and update UI
  saveCart();
  
  // Show feedback
  showNotification('เพิ่มสินค้าลงตะกร้าสำเร็จ');
}

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2d5016;
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Handle Enter key in search
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchProducts();
      }
    });
  }
  
  // Initialize
  loadCart();
  fetchProducts();
});
