# Advanced Search Context Documentation

A comprehensive React context library for building powerful search interfaces with TypeScript support, caching, suggestions, filtering, and more.

## Table of Contents

- [Overview](#overview)
- [Installation & Setup](#installation--setup)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [SearchProvider](#searchprovider)
  - [useSearch Hook](#usesearch-hook)
  - [Configuration Options](#configuration-options)
  - [Type Definitions](#type-definitions)
- [Features](#features)
  - [Search Modes](#search-modes)
  - [Debounced Input](#debounced-input)
  - [Validation](#validation)
  - [Caching](#caching)
  - [Suggestions & Autocomplete](#suggestions--autocomplete)
  - [Filtering & Sorting](#filtering--sorting)
  - [Pagination](#pagination)
  - [Infinite Scroll](#infinite-scroll)
  - [URL Synchronization](#url-synchronization)
  - [Error Handling](#error-handling)
  - [Loading States](#loading-states)
  - [Real-time Updates](#real-time-updates)
- [Advanced Usage](#advanced-usage)
  - [Multi-Search Support](#multi-search-support)
  - [Query Library Integration](#query-library-integration)
  - [Custom Validation Rules](#custom-validation-rules)
  - [Performance Optimization](#performance-optimization)
- [Developer Tools](#developer-tools)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Advanced Search Context is a React library that provides a comprehensive solution for implementing search functionality in your applications. It handles common search patterns like debouncing, caching, pagination, filtering, and more through a flexible context-based architecture.

### Key Features

- 🔍 **Debounced Search** - Automatic input debouncing with configurable delays
- 📄 **Pagination & Infinite Scroll** - Support for both pagination modes
- 🎯 **Smart Caching** - Intelligent result caching with TTL and size limits
- 💡 **Suggestions** - Built-in autocomplete and suggestion system
- 🔧 **Filtering** - Dynamic filter system with multiple data types
- ✅ **Validation** - Configurable input validation with custom rules
- 🔗 **URL Sync** - Automatic URL synchronization for shareable searches
- 📊 **Developer Tools** - Built-in debugging and performance monitoring
- 🎨 **TypeScript** - Full TypeScript support with generics
- ♿ **Accessibility** - ARIA-compliant input handling

## Installation & Setup

```bash
npm install react
# The code is self-contained - no additional dependencies required
```

Copy the search context code into your project and import it:

```typescript
import { SearchProvider, useSearch } from './search-context';
```

## Quick Start

Here's a basic example to get you started:

```tsx
import React, { useEffect } from 'react';
import { SearchProvider, useSearch } from './search-context';

// Define your data type
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

// Search function
const searchProducts = async (searchTerm: string, filters: Record<string, any>) => {
  const response = await fetch(`/api/products?q=${searchTerm}`);
  const data = await response.json();
  return {
    data: data.products,
    total: data.total,
    hasMore: data.hasMore
  };
};

// Search component
function ProductSearch() {
  const search = useSearch<Product>();

  // Auto-search when term changes
  useEffect(() => {
    if (search.debouncedSearchTerm) {
      search.search();
    }
  }, [search.debouncedSearchTerm]);

  return (
    <div>
      <input
        {...search.inputProps}
        placeholder="Search products..."
        className="w-full p-2 border rounded"
      />
      
      {search.loadingStates.searching && <div>Searching...</div>}
      
      {search.results?.data.map(product => (
        <div key={product.id} className="p-4 border-b">
          <h3>{product.name}</h3>
          <p>${product.price}</p>
        </div>
      ))}
    </div>
  );
}

// App component
function App() {
  return (
    <SearchProvider config={{ onSearch: searchProducts }}>
      <ProductSearch />
    </SearchProvider>
  );
}
```

## Core Concepts

### Search Context Pattern

The library uses React Context to provide search state and functionality throughout your component tree. This eliminates prop drilling and provides a centralized search state management system.

### Type Safety

The library is built with TypeScript generics, allowing you to specify your data types:

```typescript
const search = useSearch<Product>(); // search.results.data is Product[]
```

### Configuration-Driven

Most functionality is controlled through the configuration object passed to `SearchProvider`, making it easy to enable/disable features and customize behavior.

## API Reference

### SearchProvider

The main provider component that wraps your search interface.

```tsx
<SearchProvider<T>
  config={searchConfig}
  searchId="unique-id"
>
  {children}
</SearchProvider>
```

**Props:**
- `config`: `SearchConfig<T>` - Configuration object (see [Configuration Options](#configuration-options))
- `searchId`: `string` - Unique identifier for multi-search support (default: "default")
- `children`: `React.ReactNode` - Child components

### useSearch Hook

The main hook for accessing search functionality.

```typescript
const search = useSearch<T>();
```

**Returns:** `SearchContextValue<T>` object with all search state and methods.

### Configuration Options

```typescript
interface SearchConfig<T> {
  // Core settings
  debounceMs?: number;              // Input debounce delay (default: 300)
  mode?: 'pagination' | 'infinite'; // Pagination mode (default: 'pagination')
  searchMode?: SearchMode;          // Search matching mode (default: 'contains')
  
  // Feature toggles
  enableSuggestions?: boolean;      // Enable autocomplete (default: false)
  enableCaching?: boolean;          // Enable result caching (default: true)
  enableUrlSync?: boolean;          // Enable URL synchronization (default: false)
  enableDevTools?: boolean;         // Enable debug panel (default: false)
  enableRealTime?: boolean;         // Enable real-time updates (default: false)
  
  // Validation
  validationRules?: ValidationRule[]; // Custom validation rules
  minLength?: number;               // Minimum search term length (default: 0)
  maxLength?: number;               // Maximum search term length (default: 1000)
  
  // Pagination
  pageSize?: number;                // Items per page (default: 20)
  maxPages?: number;                // Maximum pages (default: 100)
  
  // Caching
  cacheSize?: number;               // Maximum cache entries (default: 50)
  cacheTtl?: number;                // Cache TTL in ms (default: 300000)
  
  // Suggestions
  maxSuggestions?: number;          // Maximum suggestions shown (default: 10)
  suggestionDebounceMs?: number;    // Suggestion debounce delay (default: 150)
  
  // Callbacks
  onSearch?: (searchTerm: string, filters: Record<string, any>) => Promise<SearchResult<T>>;
  onSuggestions?: (searchTerm: string) => Promise<Suggestion[]>;
  onLoadMore?: () => Promise<SearchResult<T>>;
  onError?: (error: SearchError) => void;
  onCacheHit?: (cacheKey: string) => void;
}
```

### Type Definitions

```typescript
// Search result structure
interface SearchResult<T> {
  data: T[];
  total?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
}

// Search modes
type SearchMode = 'exact' | 'fuzzy' | 'regex' | 'contains';

// Validation rule
interface ValidationRule {
  rule: (value: string) => boolean;
  message: string;
}

// Suggestion item
interface Suggestion {
  value: string;
  label?: string;
  category?: string;
  metadata?: any;
}

// Error structure
interface SearchError {
  message: string;
  code?: string;
  type: 'validation' | 'network' | 'server' | 'unknown';
  timestamp: number;
}
```

## Features

### Search Modes

Control how search terms are matched:

```typescript
const config = {
  searchMode: 'contains', // 'exact' | 'fuzzy' | 'regex' | 'contains'
};
```

### Debounced Input

Automatic input debouncing prevents excessive API calls:

```typescript
const search = useSearch();

// Access debounced value
console.log(search.debouncedSearchTerm);

// Configure debounce delay
const config = {
  debounceMs: 500, // 500ms delay
};
```

### Validation

Add custom validation rules to search input:

```typescript
const config = {
  validationRules: [
    {
      rule: (value) => value.length >= 3,
      message: 'Search term must be at least 3 characters'
    },
    {
      rule: (value) => !value.includes('<'),
      message: 'Invalid characters detected'
    }
  ],
  minLength: 2,
  maxLength: 100
};

// Check validation errors
if (search.validationErrors.length > 0) {
  console.log('Validation errors:', search.validationErrors);
}
```

### Caching

Intelligent caching system with TTL and size limits:

```typescript
const config = {
  enableCaching: true,
  cacheSize: 100,        // Maximum cache entries
  cacheTtl: 600000,      // 10 minutes TTL
  onCacheHit: (key) => console.log('Cache hit:', key)
};

// Manual cache operations
search.clearCache();
const cached = search.getCachedResults('search-key');
```

### Suggestions & Autocomplete

Built-in autocomplete with keyboard navigation:

```typescript
const config = {
  enableSuggestions: true,
  maxSuggestions: 5,
  suggestionDebounceMs: 200,
  onSuggestions: async (term) => {
    const response = await fetch(`/api/suggestions?q=${term}`);
    return response.json();
  }
};

// Access suggestions
const { suggestions, selectedSuggestionIndex, showSuggestions } = search;

// Suggestion navigation
search.navigateSuggestions('down');
search.selectSuggestion(suggestions[0]);
search.hideSuggestions();
```

### Filtering & Sorting

Dynamic filtering system with multiple data types:

```typescript
const config = {
  filters: [
    {
      key: 'category',
      type: 'select',
      label: 'Category',
      options: [
        { value: 'electronics', label: 'Electronics' },
        { value: 'books', label: 'Books' }
      ]
    },
    {
      key: 'priceRange',
      type: 'range',
      label: 'Price Range',
      min: 0,
      max: 1000
    }
  ]
};

// Filter operations
search.setFilter('category', 'electronics');
search.removeFilter('category');
search.clearFilters();

// Access current filters
console.log(search.filters);
```

### Pagination

Comprehensive pagination support:

```typescript
const config = {
  mode: 'pagination',
  pageSize: 20,
  maxPages: 100
};

// Pagination state
const { page, totalPages, hasNextPage, hasPrevPage } = search;

// Navigation
search.nextPage();
search.prevPage();
search.setPage(5);
search.goToFirstPage();
search.goToLastPage();
```

### Infinite Scroll

Infinite scroll mode for continuous loading:

```typescript
const config = {
  mode: 'infinite',
  onLoadMore: async () => {
    const response = await fetch(`/api/products?cursor=${search.cursor}`);
    return response.json();
  }
};

// Infinite scroll state
const { hasMore, cursor } = search;

// Load more data
if (hasMore) {
  await search.loadMore();
}
```

### URL Synchronization

Automatic URL synchronization for shareable searches:

```typescript
const config = {
  enableUrlSync: true
};

// URLs automatically updated with:
// - Search term
// - Current page
// - Active filters
// - Prefixed with searchId to avoid conflicts
```

### Error Handling

Comprehensive error handling with retry functionality:

```typescript
// Access error state
if (search.error) {
  console.log('Error:', search.error.message);
  console.log('Type:', search.error.type);
  console.log('Timestamp:', search.error.timestamp);
}

// Error operations
search.retrySearch();
search.clearError();

// Custom error handling
const config = {
  onError: (error) => {
    console.error('Search failed:', error);
    // Custom error handling logic
  }
};
```

### Loading States

Granular loading state management:

```typescript
const { loadingStates } = search;

// Available loading states
loadingStates.initial;      // Initial load
loadingStates.searching;    // Active search
loadingStates.loadingMore;  // Loading more results
loadingStates.refreshing;   // Refreshing results
loadingStates.suggestions;  // Loading suggestions

// Manually control loading states
search.setLoadingState('searching', true);
```

### Real-time Updates

Real-time search updates via WebSocket:

```typescript
const config = {
  enableRealTime: true,
  realTimeConfig: {
    enabled: true,
    websocketUrl: 'ws://localhost:8080/search',
    reconnectDelay: 3000,
    maxReconnectAttempts: 5
  }
};

// Real-time connection status
console.log(search.isRealTimeConnected);
```

## Advanced Usage

### Multi-Search Support

Support multiple search instances in the same app:

```tsx
// Multiple providers with unique IDs
<SearchProvider searchId="products" config={productConfig}>
  <ProductSearch />
</SearchProvider>

<SearchProvider searchId="users" config={userConfig}>
  <UserSearch />
</SearchProvider>

// Access specific search instance
const productSearch = useSearch(); // Within products provider
```

### Query Library Integration

Compatible with React Query, SWR, and other data fetching libraries:

```typescript
// With React Query
const queryKey = search.searchKey; // Pre-built query key
const { data } = useQuery(queryKey, () => searchAPI(search.trimmedSearch, search.filters));

// With SWR
const { data } = useSWR(queryKey, () => searchAPI(search.trimmedSearch, search.filters));
```

### Custom Validation Rules

Create complex validation logic:

```typescript
const config = {
  validationRules: [
    {
      rule: (value) => {
        // Custom validation logic
        const words = value.split(' ');
        return words.length <= 10;
      },
      message: 'Search term cannot exceed 10 words'
    },
    {
      rule: (value) => {
        // Check against blocked terms
        const blockedTerms = ['spam', 'blocked'];
        return !blockedTerms.some(term => value.toLowerCase().includes(term));
      },
      message: 'Search term contains blocked content'
    }
  ]
};
```

### Performance Optimization

Optimize performance for large datasets:

```typescript
const config = {
  // Longer debounce for expensive operations
  debounceMs: 500,
  
  // Limit cache size for memory management
  cacheSize: 25,
  
  // Shorter cache TTL for fresh data
  cacheTtl: 120000, // 2 minutes
  
  // Limit page size for faster rendering
  pageSize: 10,
  
  // Fewer suggestions for faster response
  maxSuggestions: 5
};
```

## Developer Tools

Enable the built-in debugging panel:

```typescript
const config = {
  enableDevTools: true
};
```

The dev tools panel shows:
- Current search state
- Cache statistics (hits/misses/size)
- Performance metrics
- Loading states
- Search history
- Configuration details

Access debug info programmatically:

```typescript
const { debugInfo } = search;
console.log('Cache stats:', debugInfo.cacheStats);
console.log('Performance:', debugInfo.performanceMetrics);
console.log('History:', debugInfo.searchHistory);
```

## Examples

### Basic Product Search

```tsx
function ProductSearch() {
  const search = useSearch<Product>();

  useEffect(() => {
    if (search.debouncedSearchTerm) {
      search.search();
    }
  }, [search.debouncedSearchTerm]);

  return (
    <div>
      <input {...search.inputProps} placeholder="Search products..." />
      
      {search.loadingStates.searching && <div>Loading...</div>}
      
      {search.results?.data.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price}</p>
        </div>
      ))}
      
      {/* Pagination */}
      <div>
        <button onClick={search.prevPage} disabled={!search.hasPrevPage}>
          Previous
        </button>
        <span>Page {search.page} of {search.totalPages}</span>
        <button onClick={search.nextPage} disabled={!search.hasNextPage}>
          Next
        </button>
      </div>
    </div>
  );
}
```

### Advanced Search with Filters

```tsx
function AdvancedSearch() {
  const search = useSearch<Product>();

  return (
    <div>
      {/* Search Input */}
      <input {...search.inputProps} placeholder="Search..." />
      
      {/* Filters */}
      <select
        value={search.filters.category || ''}
        onChange={(e) => search.setFilter('category', e.target.value)}
      >
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="books">Books</option>
      </select>
      
      <input
        type="number"
        placeholder="Min Price"
        value={search.filters.minPrice || ''}
        onChange={(e) => search.setFilter('minPrice', Number(e.target.value))}
      />
      
      {/* Active Filters */}
      {Object.entries(search.filters).map(([key, value]) => (
        <span key={key} className="filter-tag">
          {key}: {value}
          <button onClick={() => search.removeFilter(key)}>×</button>
        </span>
      ))}
      
      {/* Results */}
      {search.results?.data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

### Infinite Scroll Search

```tsx
function InfiniteSearch() {
  const search = useSearch<Product>();
  const observerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && search.hasMore && !search.loadingStates.loadingMore) {
          search.loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [search.hasMore, search.loadingStates.loadingMore]);

  return (
    <div>
      <input {...search.inputProps} placeholder="Search..." />
      
      {search.results?.data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
      
      {search.hasMore && (
        <div ref={observerRef} className="loading-trigger">
          {search.loadingStates.loadingMore ? 'Loading more...' : 'Scroll for more'}
        </div>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Proper Error Handling

Always handle errors gracefully:

```tsx
{search.error && (
  <div className="error-banner">
    <p>{search.error.message}</p>
    <button onClick={search.retrySearch}>Retry</button>
    <button onClick={search.clearError}>Dismiss</button>
  </div>
)}
```

### 2. Loading States

Provide clear loading feedback:

```tsx
{search.loadingStates.searching && <Spinner />}
{search.loadingStates.loadingMore && <div>Loading more results...</div>}
```

### 3. Validation Feedback

Show validation errors to users:

```tsx
{search.validationErrors.map((error, index) => (
  <div key={index} className="validation-error">{error}</div>
))}
```

### 4. Accessibility

Use the provided input props for accessibility:

```tsx
<input
  {...search.inputProps}
  placeholder="Search..."
  aria-label="Search products"
  className="search-input"
/>
```

### 5. Performance

Optimize for performance:
- Use appropriate debounce delays
- Limit cache size for memory-constrained environments
- Implement virtual scrolling for large result sets
- Use React.memo for result components

### 6. Type Safety

Always specify generic types:

```typescript
const search = useSearch<Product>(); // Not useSearch()
```

## Troubleshooting

### Common Issues

**1. Search not triggering**
- Check if `onSearch` callback is provided in config
- Verify search term meets validation requirements
- Ensure debounced term is not empty

**2. Suggestions not showing**
- Verify `enableSuggestions: true` in config
- Check if `onSuggestions` callback is provided
- Ensure suggestions array is not empty

**3. Caching not working**
- Verify `enableCaching: true` in config
- Check cache TTL hasn't expired
- Ensure search keys are consistent

**4. URL sync not working**
- Verify `enableUrlSync: true` in config
- Check browser URL parameters
- Ensure unique `searchId` for multiple instances

**5. TypeScript errors**
- Specify generic types for `useSearch<T>()`
- Ensure result data matches expected type
- Check SearchResult interface implementation

### Debug Steps

1. **Enable DevTools**: Set `enableDevTools: true` to see debug panel
2. **Check Console**: Look for error messages and warnings
3. **Verify Config**: Ensure all required callbacks are provided
4. **Test Callbacks**: Verify search/suggestion functions work independently
5. **Check Network**: Monitor API calls in browser dev tools

### Performance Issues

**Slow search response:**
- Increase debounce delay
- Implement server-side caching
- Add search result pagination
- Optimize API queries

**Memory issues:**
- Reduce cache size
- Implement result virtualization
- Clear cache periodically
- Limit search history

**UI lag:**
- Use React.memo for result components
- Implement virtual scrolling
- Reduce re-renders with useMemo/useCallback
- Optimize CSS animations

---

## Contributing

This library is designed to be extended and customized. Key areas for contribution:

- Additional search modes (fuzzy matching, soundex, etc.)
- More filter types (date ranges, multi-select, etc.)
- Enhanced real-time capabilities
- Additional query library integrations
- Performance optimizations
- Accessibility improvements

## License

See License file in the github Repo. This project uses the Apache 2.0 License.

---

*Built with React, TypeScript, and ❤️*
