// Global variables
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 20; // Increased for better performance
let viewMode = 'grid';
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let isLoading = false;
let cache = new Map(); // Simple caching system

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    updateCartUI();
    setupEventListeners();
    fetchProducts();
});

// Setup event listeners with debouncing
function setupEventListeners() {
    // Debounced search
    let searchTimeout;
    const searchHandler = (event) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(event), 300);
    };
    
    document.getElementById('product-search').addEventListener('input', searchHandler);
    document.getElementById('header-search').addEventListener('input', searchHandler);
    document.getElementById('mobile-search-input').addEventListener('input', searchHandler);
    document.getElementById('category-filter').addEventListener('change', handleFilter);
    document.getElementById('sort-filter').addEventListener('change', handleFilter);
}

// Optimized fetch with caching and timeout
function fetchProducts() {
    if (isLoading) return;
    
    // Check cache first
    const cacheKey = 'products';
    const cachedData = cache.get(cacheKey);
    const cacheTime = 5 * 60 * 1000; // 5 minutes
    
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheTime) {
        allProducts = cachedData.data;
        filteredProducts = [...allProducts];
        populateCategories();
        displayProducts();
        updateResultsCount();
        hideLoading();
        return;
    }
    
    isLoading = true;
    const xhr = new XMLHttpRequest();
    
    // Shorter timeout for faster failure detection
    xhr.timeout = 5000;
    xhr.open('GET', 'https://api.escuelajs.co/api/v1/products?limit=50', true); // Limit initial load
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            isLoading = false;
            if (xhr.status === 200) {
                try {
                    const products = JSON.parse(xhr.responseText);
                    
                    // Cache the data
                    cache.set(cacheKey, {
                        data: products,
                        timestamp: Date.now()
                    });
                    
                    allProducts = products;
                    filteredProducts = [...allProducts];
                    
                    // Use requestAnimationFrame for smooth rendering
                    requestAnimationFrame(() => {
                        populateCategories();
                        displayProducts();
                        updateResultsCount();
                        hideLoading();
                    });
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    showError('Failed to parse product data');
                }
            } else {
                showError('Failed to load products. Please try again.');
            }
        }
    };
    
    xhr.onerror = () => {
        isLoading = false;
        showError('Network error. Please check your connection.');
    };
    
    xhr.ontimeout = () => {
        isLoading = false;
        showError('Request timed out. Please try again.');
    };
    
    xhr.send();
}

// Optimized category population
function populateCategories() {
    const categoryFilter = document.getElementById('category-filter');
    const existingOptions = categoryFilter.querySelectorAll('option:not([value="all"])');
    
    // Clear existing options except "All Categories"
    existingOptions.forEach(option => option.remove());
    
    // Use Set for better performance
    const categories = [...new Set(allProducts.map(product => product.category?.name).filter(Boolean))];
    
    // Create fragment for better performance
    const fragment = document.createDocumentFragment();
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        fragment.appendChild(option);
    });
    
    categoryFilter.appendChild(fragment);
}

// Debounced search handler
function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    
    // Sync search across all search inputs efficiently
    const searchInputs = ['product-search', 'header-search', 'mobile-search-input'];
    searchInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input && input !== event.target && input.value !== event.target.value) {
            input.value = event.target.value;
        }
    });

    filterProducts();
}

// Optimized filter handler
function handleFilter() {
    currentPage = 1;
    filterProducts();
}

// Optimized filtering with better performance
function filterProducts() {
    const searchQuery = document.getElementById('product-search').value.toLowerCase();
    const selectedCategory = document.getElementById('category-filter').value;
    const sortBy = document.getElementById('sort-filter').value;

    // Use more efficient filtering
    filteredProducts = allProducts.filter(product => {
        if (!product) return false;
        
        const matchesSearch = !searchQuery || 
            (product.title && product.title.toLowerCase().includes(searchQuery)) ||
            (product.description && product.description.toLowerCase().includes(searchQuery)) ||
            (product.category?.name && product.category.name.toLowerCase().includes(searchQuery));
        
        const matchesCategory = selectedCategory === 'all' || 
            (product.category?.name === selectedCategory);
        
        return matchesSearch && matchesCategory;
    });

    // Optimized sorting
    if (sortBy !== 'name') {
        filteredProducts.sort((a, b) => {
            switch (sortBy) {
                case 'price-low':
                    return (a.price || 0) - (b.price || 0);
                case 'price-high':
                    return (b.price || 0) - (a.price || 0);
                default:
                    return (a.title || '').localeCompare(b.title || '');
            }
        });
    }

    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
        displayProducts();
        updateResultsCount();
        updatePagination();
    });
}

// Highly optimized product display with virtual scrolling concept
function displayProducts() {
    const container = document.getElementById('products-container');
    const noResults = document.getElementById('no-results');
    
    if (filteredProducts.length === 0) {
        container.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    noResults.classList.add('hidden');
    container.classList.remove('hidden');

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    // Update container class based on view mode
    container.className = viewMode === 'grid' 
        ? 'products-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
        : 'space-y-4';

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    paginatedProducts.forEach(product => {
        const productElement = document.createElement('div');
        productElement.innerHTML = createProductCard(product);
        fragment.appendChild(productElement.firstElementChild);
    });
    
    // Clear and append in one operation
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Lazy load images after DOM update
    requestAnimationFrame(() => {
        lazyLoadImages();
        updatePagination();
    });
}

// Optimized product card creation
function createProductCard(product) {
    if (!product) return '';
    
    const imageUrl = getValidImageUrl(product.images);
    const price = product.price || 0;
    const title = product.title || 'Unknown Product';
    const description = product.description || '';
    const categoryName = product.category?.name || 'Uncategorized';
    
    if (viewMode === 'list') {
        return createListViewCard(product, imageUrl, price, title, description, categoryName);
    }
    
    return createGridViewCard(product, imageUrl, price, title, description, categoryName);
}

// Optimized grid view card
function createGridViewCard(product, imageUrl, price, title, description, categoryName) {
    return `
        <div class="product-card bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-200">
            <div class="relative aspect-square overflow-hidden group">
                <img 
                    data-src="${imageUrl}" 
                    alt="${title}" 
                    class="lazy-image w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                    loading="lazy"
                    onerror="this.src='https://via.placeholder.com/300x300/f3f4f6/9ca3af?text=No+Image'"
                >
                
                <!-- Category badge -->
                <div class="absolute top-2 left-2">
                    <span class="bg-white/90 text-gray-800 text-xs px-2 py-1 rounded-full">${categoryName}</span>
                </div>

                <!-- Quick actions overlay -->
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <button onclick="addToCart(${product.id})" class="bg-white text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors">
                        Add to Cart
                    </button>
                </div>
            </div>

            <div class="p-3">
                <h3 class="font-semibold text-sm mb-1 line-clamp-2 hover:text-blue-600 transition-colors">${title}</h3>
                <p class="text-gray-600 text-xs mb-2 line-clamp-2">${description}</p>
                <div class="flex items-center justify-between">
                    <span class="text-lg font-bold text-green-600">$${price.toFixed(2)}</span>
                    <div class="flex items-center text-yellow-400">
                        <svg class="h-3 w-3 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                        <span class="text-xs ml-1">4.5</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Optimized list view card
function createListViewCard(product, imageUrl, price, title, description, categoryName) {
    return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col sm:flex-row">
            <div class="relative w-full sm:w-32 h-32">
                <img 
                    data-src="${imageUrl}" 
                    alt="${title}" 
                    class="lazy-image w-full h-full object-cover" 
                    loading="lazy"
                    onerror="this.src='https://via.placeholder.com/200x200/f3f4f6/9ca3af?text=No+Image'"
                >
            </div>
            <div class="flex-1 p-4">
                <div class="flex justify-between items-start mb-2">
                    <span class="inline-block bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full">${categoryName}</span>
                </div>
                <h3 class="font-semibold text-lg mb-1 hover:text-blue-600 transition-colors">${title}</h3>
                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${description}</p>
                <div class="flex items-center justify-between">
                    <span class="text-xl font-bold text-green-600">$${price.toFixed(2)}</span>
                    <button onclick="addToCart(${product.id})" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm">
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Lazy loading implementation
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy-image');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px'
        });

        images.forEach(img => imageObserver.observe(img));
    } else {
        // Fallback for older browsers
        images.forEach(img => {
            img.src = img.dataset.src;
            img.classList.remove('lazy-image');
        });
    }
}

// Optimized image URL handling
function getValidImageUrl(images) {
    if (!images || !Array.isArray(images) || images.length === 0) {
        return 'https://via.placeholder.com/300x300/f3f4f6/9ca3af?text=No+Image';
    }
    
    let imageUrl = images[0];
    if (typeof imageUrl === 'string') {
        imageUrl = imageUrl.replace(/[[\]"]/g, '').trim();
    }
    
    return imageUrl || 'https://via.placeholder.com/300x300/f3f4f6/9ca3af?text=No+Image';
}

// Optimized results count update
function updateResultsCount() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredProducts.length);
    const resultsCount = document.getElementById('results-count');
    
    if (filteredProducts.length === 0) {
        resultsCount.textContent = 'No products found';
    } else {
        resultsCount.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredProducts.length} products`;
    }
}

// Optimized pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.classList.add('hidden');
        return;
    }
    
    pagination.classList.remove('hidden');
    
    const paginationHTML = [];
    
    // Previous button
    paginationHTML.push(`
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
            class="px-3 py-2 border border-gray-300 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
            Previous
        </button>
    `);
    
    // Page numbers (simplified for performance)
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML.push(`
            <button onclick="changePage(${i})" 
                class="w-10 h-10 ${currentPage === i ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'} rounded-md transition-colors">
                ${i}
            </button>
        `);
    }
    
    // Next button
    paginationHTML.push(`
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
            class="px-3 py-2 border border-gray-300 rounded-md ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
            Next
        </button>
    `);
    
    pagination.innerHTML = paginationHTML.join('');
}

// Optimized page change
function changePage(page) {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    
    // Smooth scroll to top of products
    document.getElementById('products').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
        displayProducts();
        updateResultsCount();
    });
}

// Optimized view mode switching
function setViewMode(mode) {
    if (viewMode === mode) return;
    
    viewMode = mode;
    
    const gridBtn = document.getElementById('grid-view');
    const listBtn = document.getElementById('list-view');
    
    if (mode === 'grid') {
        gridBtn.className = 'px-3 py-2 bg-blue-600 text-white rounded-md transition-colors';
        listBtn.className = 'px-3 py-2 border border-gray-300 text-gray-600 rounded-md transition-colors';
    } else {
        gridBtn.className = 'px-3 py-2 border border-gray-300 text-gray-600 rounded-md transition-colors';
        listBtn.className = 'px-3 py-2 bg-blue-600 text-white rounded-md transition-colors';
    }
    
    requestAnimationFrame(() => {
        displayProducts();
    });
}

// Optimized filter clearing
function clearFilters() {
    const inputs = ['product-search', 'header-search', 'mobile-search-input'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    
    document.getElementById('category-filter').value = 'all';
    document.getElementById('sort-filter').value = 'name';
    currentPage = 1;
    
    requestAnimationFrame(() => {
        filterProducts();
    });
}

// Optimized loading state
function hideLoading() {
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
}

// Optimized error display
function showError(message) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `
        <div class="text-center py-8">
            <div class="text-4xl mb-4">⚠️</div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Error Loading Products</h3>
            <p class="text-gray-600 mb-4">${message}</p>
            <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                Retry
            </button>
        </div>
    `;
    loading.classList.remove('hidden');
}

// Mobile menu functions
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    const closeIcon = document.getElementById('close-icon');
    
    mobileMenu.classList.toggle('hidden');
    menuIcon.classList.toggle('hidden');
    closeIcon.classList.toggle('hidden');
}

function toggleMobileSearch() {
    const mobileSearch = document.getElementById('mobile-search');
    mobileSearch.classList.toggle('hidden');
}

// Optimized cart functions
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            title: product.title || 'Unknown Product',
            price: product.price || 0,
            image: getValidImageUrl(product.images),
            quantity: 1
        });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    
    // Optimized badge animation
    const badge = document.getElementById('cart-badge');
    badge.style.animation = 'none';
    requestAnimationFrame(() => {
        badge.style.animation = 'bounce 0.3s ease';
    });
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

function updateQuantity(productId, quantity) {
    if (quantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = quantity;
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();
    }
}

function clearCart() {
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
}

// Optimized cart UI update
function updateCartUI() {
    const cartBadge = document.getElementById('cart-badge');
    const cartItems = document.getElementById('cart-items');
    const cartFooter = document.getElementById('cart-footer');
    const emptyCart = document.getElementById('empty-cart');
    const cartTotal = document.getElementById('cart-total');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Update badge
    if (totalItems > 0) {
        cartBadge.textContent = totalItems;
        cartBadge.classList.remove('hidden');
    } else {
        cartBadge.classList.add('hidden');
    }
    
    // Update cart content
    if (cart.length === 0) {
        emptyCart.classList.remove('hidden');
        cartFooter.classList.add('hidden');
        cartItems.innerHTML = '<div id="empty-cart" class="text-center py-8"><svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"></path></svg><p class="mt-2 text-gray-600">Your cart is empty</p></div>';
    } else {
        emptyCart.classList.add('hidden');
        cartFooter.classList.remove('hidden');
        cartTotal.textContent = `$${totalPrice.toFixed(2)}`;
        
        // Use fragment for better performance
        const fragment = document.createDocumentFragment();
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.innerHTML = createCartItemHTML(item);
            fragment.appendChild(itemElement.firstElementChild);
        });
        
        cartItems.innerHTML = '';
        cartItems.appendChild(fragment);
    }
}

function createCartItemHTML(item) {
    return `
        <div class="flex items-center space-x-3 py-3 border-b">
            <img src="${item.image}" alt="${item.title}" class="w-12 h-12 object-cover rounded-md" onerror="this.src='https://via.placeholder.com/48x48/f3f4f6/9ca3af?text=No+Image'">
            <div class="flex-1">
                <h4 class="font-medium text-sm line-clamp-2">${item.title}</h4>
                <p class="text-green-600 font-semibold text-sm">$${item.price.toFixed(2)}</p>
                <div class="flex items-center space-x-2 mt-1">
                    <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})" class="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-sm hover:bg-gray-50 transition-colors">-</button>
                    <span class="text-sm">${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})" class="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-sm hover:bg-gray-50 transition-colors">+</button>
                </div>
            </div>
            <button onclick="removeFromCart(${item.id})" class="text-red-500 hover:text-red-700 transition-colors">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        </div>
    `;
}

function toggleCart() {
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    
    cartSidebar.classList.toggle('translate-x-full');
    cartOverlay.classList.toggle('hidden');
}