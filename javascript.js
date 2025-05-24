// Global variables
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const itemsPerPage = 20;
let viewMode = 'grid';
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let isLoading = false;
let cache = new Map();

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    updateCartUI();
    setupEventListeners();
    fetchProducts();
    setupKeyboardShortcuts();
});

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('product-search').focus();
        }
    });
}

// Setup event listeners with debouncing
function setupEventListeners() {
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

// Enhanced notification system
function showNotification(message, type = 'success', duration = 3000) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    
    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    
    notification.className = `notification ${bgColor} text-white px-6 py-4 rounded-xl shadow-lg flex items-center space-x-3 max-w-sm`;
    notification.innerHTML = `
        <span class="text-lg font-bold">${icon}</span>
        <span class="font-medium">${message}</span>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// Optimized fetch with enhanced error handling
function fetchProducts() {
    if (isLoading) return;
    
    const cacheKey = 'products';
    const cachedData = cache.get(cacheKey);
    const cacheTime = 5 * 60 * 1000;
    
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
    
    xhr.timeout = 8000;
    xhr.open('GET', 'https://api.escuelajs.co/api/v1/products?limit=100', true);
    
    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            isLoading = false;
            if (xhr.status === 200) {
                try {
                    const products = JSON.parse(xhr.responseText);
                    
                    cache.set(cacheKey, {
                        data: products,
                        timestamp: Date.now()
                    });
                    
                    allProducts = products;
                    filteredProducts = [...allProducts];
                    
                    requestAnimationFrame(() => {
                        populateCategories();
                        displayProducts();
                        updateResultsCount();
                        hideLoading();
                        showNotification('Products loaded successfully!', 'success');
                    });
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    showError('Failed to parse product data');
                    showNotification('Failed to load products', 'error');
                }
            } else {
                showError('Failed to load products. Please try again.');
                showNotification('Network error occurred', 'error');
            }
        }
    };
    
    xhr.onerror = () => {
        isLoading = false;
        showError('Network error. Please check your connection.');
        showNotification('Connection failed', 'error');
    };
    
    xhr.ontimeout = () => {
        isLoading = false;
        showError('Request timed out. Please try again.');
        showNotification('Request timed out', 'error');
    };
    
    xhr.send();
}

// Enhanced category population
function populateCategories() {
    const categoryFilter = document.getElementById('category-filter');
    const existingOptions = categoryFilter.querySelectorAll('option:not([value="all"])');
    
    existingOptions.forEach(option => option.remove());
    
    const categories = [...new Set(allProducts.map(product => product.category?.name).filter(Boolean))];
    
    const fragment = document.createDocumentFragment();
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        fragment.appendChild(option);
    });
    
    categoryFilter.appendChild(fragment);
}

// Enhanced search handler
function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    
    const searchInputs = ['product-search', 'header-search', 'mobile-search-input'];
    searchInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input && input !== event.target && input.value !== event.target.value) {
            input.value = event.target.value;
        }
    });

    filterProducts();
}

function handleFilter() {
    currentPage = 1;
    filterProducts();
}

// Enhanced filtering
function filterProducts() {
    const searchQuery = document.getElementById('product-search').value.toLowerCase();
    const selectedCategory = document.getElementById('category-filter').value;
    const sortBy = document.getElementById('sort-filter').value;

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

    requestAnimationFrame(() => {
        displayProducts();
        updateResultsCount();
        updatePagination();
    });
}

// Enhanced product display
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

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    container.className = viewMode === 'grid' 
        ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
        : 'space-y-6';

    const fragment = document.createDocumentFragment();
    
    paginatedProducts.forEach((product, index) => {
        const productElement = document.createElement('div');
        productElement.innerHTML = createProductCard(product);
        productElement.firstElementChild.style.animationDelay = `${index * 0.1}s`;
        productElement.firstElementChild.classList.add('animate-fade-in');
        fragment.appendChild(productElement.firstElementChild);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    requestAnimationFrame(() => {
        lazyLoadImages();
        updatePagination();
    });
}

// Enhanced product card creation
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

// Enhanced grid view card
function createGridViewCard(product, imageUrl, price, title, description, categoryName) {
    return `
        <div class="product-card modern-card rounded-2xl overflow-hidden group cursor-pointer">
            <div class="relative aspect-square overflow-hidden">
                <img 
                    data-src="${imageUrl}" 
                    alt="${title}" 
                    class="lazy-image w-full h-full object-cover transition-all duration-500 group-hover:scale-110" 
                    loading="lazy"
                    onerror="this.src='https://via.placeholder.com/400x400/f8fafc/64748b?text=No+Image'"
                >
                
                <!-- Enhanced overlay -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div class="absolute bottom-4 left-4 right-4">
                        <button onclick="addToCart(${product.id})" class="btn-modern w-full bg-white text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0">
                            <svg class="h-5 w-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"></path>
                            </svg>
                            Add to Cart
                        </button>
                    </div>
                </div>

                <!-- Category badge -->
                <div class="absolute top-3 left-3">
                    <span class="bg-white/90 backdrop-blur-sm text-gray-800 text-xs px-3 py-1 rounded-full font-medium">${categoryName}</span>
                </div>

                <!-- Wishlist button -->
                <div class="absolute top-3 right-3">
                    <button onclick="toggleWishlist(${product.id})" class="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="p-4">
                <h3 class="font-semibold text-lg mb-2 line-clamp-2 hover:text-blue-600 transition-colors">${title}</h3>
                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${description}</p>
                <div class="flex items-center justify-between">
                    <span class="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">$${price.toFixed(2)}</span>
                    <div class="flex items-center text-yellow-400">
                        <svg class="h-4 w-4 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                        </svg>
                        <span class="text-sm ml-1 font-medium">4.5</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Enhanced list view card
function createListViewCard(product, imageUrl, price, title, description, categoryName) {
    return `
        <div class="modern-card rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col sm:flex-row">
            <div class="relative w-full sm:w-48 h-48 sm:h-auto">
                <img 
                    data-src="${imageUrl}" 
                    alt="${title}" 
                    class="lazy-image w-full h-full object-cover" 
                    loading="lazy"
                    onerror="this.src='https://via.placeholder.com/300x300/f8fafc/64748b?text=No+Image'"
                >
            </div>
            <div class="flex-1 p-6">
                <div class="flex justify-between items-start mb-3">
                    <span class="inline-block bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-medium">${categoryName}</span>
                    <button onclick="toggleWishlist(${product.id})" class="p-2 text-gray-600 hover:text-red-500 transition-colors">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                        </svg>
                    </button>
                </div>
                <h3 class="font-bold text-xl mb-2 hover:text-blue-600 transition-colors">${title}</h3>
                <p class="text-gray-600 mb-4 line-clamp-2">${description}</p>
                <div class="flex items-center justify-between">
                    <span class="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">$${price.toFixed(2)}</span>
                    <button onclick="addToCart(${product.id})" class="btn-modern bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-semibold">
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Enhanced lazy loading
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy-image');
                    img.classList.add('animate-fade-in');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px'
        });

        images.forEach(img => imageObserver.observe(img));
    } else {
        images.forEach(img => {
            img.src = img.dataset.src;
            img.classList.remove('lazy-image');
        });
    }
}

function getValidImageUrl(images) {
    if (!images || !Array.isArray(images) || images.length === 0) {
        return 'https://via.placeholder.com/400x400/f8fafc/64748b?text=No+Image';
    }
    
    let imageUrl = images[0];
    if (typeof imageUrl === 'string') {
        imageUrl = imageUrl.replace(/[[\]"]/g, '').trim();
    }
    
    return imageUrl || 'https://via.placeholder.com/400x400/f8fafc/64748b?text=No+Image';
}

function updateResultsCount() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredProducts.length);
    const resultsCount = document.getElementById('results-count');
    
    if (filteredProducts.length === 0) {
        resultsCount.textContent = 'No products found';
    } else {
        resultsCount.textContent = `Showing ${startIndex + 1}-${endIndex} of ${filteredProducts.length} amazing products`;
    }
}

// Enhanced pagination
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
            class="px-4 py-3 border-2 border-gray-200 rounded-xl ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50 hover:border-blue-300'} transition-all duration-300 font-medium">
            Previous
        </button>
    `);
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML.push(`
            <button onclick="changePage(${i})" 
                class="w-12 h-12 ${currentPage === i ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' : 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-blue-300'} rounded-xl transition-all duration-300 font-semibold">
                ${i}
            </button>
        `);
    }
    
    // Next button
    paginationHTML.push(`
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
            class="px-4 py-3 border-2 border-gray-200 rounded-xl ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50 hover:border-blue-300'} transition-all duration-300 font-medium">
            Next
        </button>
    `);
    
    pagination.innerHTML = paginationHTML.join('');
}

function changePage(page) {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    
    document.getElementById('products').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
    
    requestAnimationFrame(() => {
        displayProducts();
        updateResultsCount();
    });
}

// Enhanced view mode switching
function setViewMode(mode) {
    if (viewMode === mode) return;
    
    viewMode = mode;
    
    const gridBtn = document.getElementById('grid-view');
    const listBtn = document.getElementById('list-view');
    
    if (mode === 'grid') {
        gridBtn.className = 'px-4 py-2 bg-white text-gray-800 rounded-lg shadow-sm font-medium transition-all';
        listBtn.className = 'px-4 py-2 text-gray-600 rounded-lg font-medium transition-all';
    } else {
        gridBtn.className = 'px-4 py-2 text-gray-600 rounded-lg font-medium transition-all';
        listBtn.className = 'px-4 py-2 bg-white text-gray-800 rounded-lg shadow-sm font-medium transition-all';
    }
    
    requestAnimationFrame(() => {
        displayProducts();
    });
}

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
    
    showNotification('Filters cleared successfully!', 'info');
}

function hideLoading() {
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
}

function showError(message) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `
        <div class="text-center py-16">
            <div class="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                <svg class="h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">Oops! Something went wrong</h3>
            <p class="text-gray-600 mb-6">${message}</p>
            <button onclick="location.reload()" class="btn-modern bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-semibold">
                Try Again
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
    if (!mobileSearch.classList.contains('hidden')) {
        document.getElementById('mobile-search-input').focus();
    }
}

// Enhanced cart functions with proper working delete and clear
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        showNotification('Product not found!', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
        showNotification(`Increased ${product.title} quantity!`, 'success');
    } else {
        cart.push({
            id: product.id,
            title: product.title || 'Unknown Product',
            price: product.price || 0,
            image: getValidImageUrl(product.images),
            quantity: 1
        });
        showNotification(`${product.title} added to cart!`, 'success');
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    
    // Enhanced badge animation
    const badge = document.getElementById('cart-badge');
    badge.classList.add('animate-bounce-in');
    setTimeout(() => {
        badge.classList.remove('animate-bounce-in');
    }, 500);
}

// Fixed remove from cart function
function removeFromCart(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex === -1) return;
    
    const item = cart[itemIndex];
    const itemElement = document.querySelector(`[data-cart-item="${productId}"]`);
    
    if (itemElement) {
        itemElement.classList.add('removing');
        setTimeout(() => {
            cart.splice(itemIndex, 1);
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartUI();
            showNotification(`${item.title} removed from cart!`, 'info');
        }, 300);
    } else {
        cart.splice(itemIndex, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();
        showNotification(`${item.title} removed from cart!`, 'info');
    }
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

// Fixed clear cart function
function clearCart() {
    if (cart.length === 0) {
        showNotification('Cart is already empty!', 'info');
        return;
    }
    
    // Add confirmation
    if (confirm('Are you sure you want to clear your entire cart?')) {
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();
        showNotification('Cart cleared successfully!', 'success');
    }
}

// Enhanced cart UI update with proper item rendering
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
        cartItems.innerHTML = `
            <div id="empty-cart" class="text-center py-12">
                <div class="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg class="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h3>
                <p class="text-gray-600 mb-6">Add some products to get started!</p>
                <button onclick="toggleCart()" class="btn-modern bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-semibold">
                    Continue Shopping
                </button>
            </div>
        `;
        cartFooter.classList.add('hidden');
    } else {
        cartFooter.classList.remove('hidden');
        cartTotal.textContent = `$${totalPrice.toFixed(2)}`;
        
        // Create cart items HTML
        const cartItemsHTML = cart.map(item => createCartItemHTML(item)).join('');
        cartItems.innerHTML = cartItemsHTML;
    }
}

// Enhanced cart item HTML with proper data attributes for removal
function createCartItemHTML(item) {
    return `
        <div class="cart-item flex items-center space-x-4 py-4 border-b border-gray-200 last:border-b-0" data-cart-item="${item.id}">
            <img src="${item.image}" alt="${item.title}" class="w-16 h-16 object-cover rounded-xl" onerror="this.src='https://via.placeholder.com/64x64/f8fafc/64748b?text=No+Image'">
            <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-sm line-clamp-2 text-gray-900">${item.title}</h4>
                <p class="text-lg font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">$${item.price.toFixed(2)}</p>
                <div class="flex items-center space-x-3 mt-2">
                    <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})" class="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-blue-300 transition-all font-semibold">-</button>
                    <span class="text-sm font-semibold min-w-[20px] text-center">${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})" class="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:border-blue-300 transition-all font-semibold">+</button>
                </div>
            </div>
            <button onclick="removeFromCart(${item.id})" class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-300">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    
    // Focus management for accessibility
    if (!cartSidebar.classList.contains('translate-x-full')) {
        setTimeout(() => {
            const firstFocusable = cartSidebar.querySelector('button');
            if (firstFocusable) firstFocusable.focus();
        }, 300);
    }
}

// Enhanced wishlist function
function toggleWishlist(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    const isInWishlist = wishlist.includes(productId);
    
    if (isInWishlist) {
        wishlist = wishlist.filter(id => id !== productId);
        showNotification(`${product.title} removed from wishlist!`, 'info');
    } else {
        wishlist.push(productId);
        showNotification(`${product.title} added to wishlist!`, 'success');
    }
    
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    
    // Update wishlist UI (you can expand this)
    const wishlistBadge = document.querySelector('.relative svg + span');
    if (wishlistBadge) {
        wishlistBadge.textContent = wishlist.length;
        wishlistBadge.classList.toggle('hidden', wishlist.length === 0);
    }
}

// Scroll to top function
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Enhanced keyboard navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const cartSidebar = document.getElementById('cart-sidebar');
        if (!cartSidebar.classList.contains('translate-x-full')) {
            toggleCart();
        }
        
        const mobileMenu = document.getElementById('mobile-menu');
        if (!mobileMenu.classList.contains('hidden')) {
            toggleMobileMenu();
        }
    }
});

// Initialize wishlist on page load
document.addEventListener('DOMContentLoaded', function() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    const wishlistBadge = document.querySelector('.relative svg + span');
    if (wishlistBadge) {
        wishlistBadge.textContent = wishlist.length;
        wishlistBadge.classList.toggle('hidden', wishlist.length === 0);
    }
});