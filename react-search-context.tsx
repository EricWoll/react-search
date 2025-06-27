import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';

// ==================== TYPES ====================

// Generic types for search results
interface SearchResult<T = any> {
  data: T[];
  total?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
}

// Search modes
type SearchMode = 'exact' | 'fuzzy' | 'regex' | 'contains';

// Loading states
interface LoadingStates {
  initial: boolean;
  searching: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  suggestions: boolean;
}

// Error types
interface SearchError {
  message: string;
  code?: string;
  type: 'validation' | 'network' | 'server' | 'unknown';
  timestamp: number;
}

// Validation rules
interface ValidationRule {
  rule: (value: string) => boolean;
  message: string;
}

// Filter definition
interface FilterDefinition<T = any> {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect' | 'range';
  label?: string;
  options?: { value: T; label: string }[];
  min?: number;
  max?: number;
  defaultValue?: T;
}

// Cache entry
interface CacheEntry<T = any> {
  data: SearchResult<T>;
  timestamp: number;
  searchKey: string;
}

// Suggestion
interface Suggestion {
  value: string;
  label?: string;
  category?: string;
  metadata?: any;
}

// Real-time configuration
interface RealTimeConfig {
  enabled: boolean;
  websocketUrl?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// Context configuration
interface SearchConfig<T = any> {
  // Core settings
  debounceMs?: number;
  mode?: 'pagination' | 'infinite';
  searchMode?: SearchMode;
  
  // Features toggles
  enableSuggestions?: boolean;
  enableCaching?: boolean;
  enableUrlSync?: boolean;
  enableDevTools?: boolean;
  enableRealTime?: boolean;
  
  // Validation
  validationRules?: ValidationRule[];
  minLength?: number;
  maxLength?: number;
  
  // Pagination
  pageSize?: number;
  maxPages?: number;
  
  // Caching
  cacheSize?: number;
  cacheTtl?: number; // milliseconds
  
  // Suggestions
  maxSuggestions?: number;
  suggestionDebounceMs?: number;
  
  // Filters
  filters?: FilterDefinition[];
  
  // Real-time
  realTimeConfig?: RealTimeConfig;
  
  // Callbacks
  onSearch?: (searchTerm: string, filters: Record<string, any>) => Promise<SearchResult<T>>;
  onSuggestions?: (searchTerm: string) => Promise<Suggestion[]>;
  onLoadMore?: () => Promise<SearchResult<T>>;
  onError?: (error: SearchError) => void;
  onCacheHit?: (cacheKey: string) => void;
}

// Main context value
interface SearchContextValue<T = any> {
  // Search state
  searchTerm: string;
  debouncedSearchTerm: string;
  trimmedSearch: string;
  isEmptySearch: boolean;
  searchMode: SearchMode;
  
  // Input binding with accessibility
  inputProps: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    'aria-expanded': boolean;
    'aria-haspopup': boolean;
    'aria-activedescendant'?: string;
    role: string;
  };
  
  // Loading states
  loadingStates: LoadingStates;
  setLoadingState: (state: keyof LoadingStates, value: boolean) => void;
  
  // Error handling
  error: SearchError | null;
  validationErrors: string[];
  clearError: () => void;
  retrySearch: () => Promise<void>;
  
  // Results and caching
  results: SearchResult<T> | null;
  getCachedResults: (searchKey: string) => SearchResult<T> | null;
  clearCache: () => void;
  
  // Query compatibility
  searchKey: (string | number | null)[];
  
  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: () => void;
  prevPage: () => void;
  setPage: (page: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  
  // Infinite scroll
  cursor: string | null;
  setCursor: (cursor: string | null) => void;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  
  // Filters
  filters: Record<string, any>;
  setFilter: (key: string, value: any) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
  filterDefinitions: FilterDefinition[];
  
  // Suggestions/Autocomplete
  suggestions: Suggestion[];
  selectedSuggestionIndex: number;
  showSuggestions: boolean;
  selectSuggestion: (suggestion: Suggestion) => void;
  navigateSuggestions: (direction: 'up' | 'down') => void;
  hideSuggestions: () => void;
  
  // Search actions
  search: (term?: string) => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  
  // Configuration
  config: SearchConfig<T>;
  updateConfig: (newConfig: Partial<SearchConfig<T>>) => void;
  
  // Real-time
  isRealTimeConnected: boolean;
  
  // Multi-search support
  searchId: string;
  
  // Dev tools
  debugInfo: {
    cacheStats: { hits: number; misses: number; size: number };
    searchHistory: string[];
    performanceMetrics: { averageSearchTime: number; totalSearches: number };
  };
}

// Provider props
interface SearchProviderProps<T = any> {
  children: React.ReactNode;
  config?: SearchConfig<T>;
  searchId?: string;
}

// ==================== UTILITIES ====================

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

// URL sync utilities
function getUrlParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function setUrlParams(params: Record<string, string>) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  });
  window.history.replaceState({}, '', url.toString());
}

// Cache utilities
class SearchCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;
  
  constructor(maxSize = 50, ttl = 5 * 60 * 1000) { // 5 minutes default
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  set(key: string, data: SearchResult<T>): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      searchKey: key
    });
  }
  
  get(key: string): SearchResult<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// ==================== CONTEXT ====================

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

// Default configuration
const defaultConfig: Required<SearchConfig> = {
  debounceMs: 300,
  mode: 'pagination',
  searchMode: 'contains',
  enableSuggestions: false,
  enableCaching: true,
  enableUrlSync: false,
  enableDevTools: false,
  enableRealTime: false,
  validationRules: [],
  minLength: 0,
  maxLength: 1000,
  pageSize: 20,
  maxPages: 100,
  cacheSize: 50,
  cacheTtl: 300000, // 5 minutes
  maxSuggestions: 10,
  suggestionDebounceMs: 150,
  filters: [],
  realTimeConfig: {
    enabled: false,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5
  },
  onSearch: async () => ({ data: [] }),
  onSuggestions: async () => [],
  onLoadMore: async () => ({ data: [] }),
  onError: () => {},
  onCacheHit: () => {}
};

// Provider component
export function SearchProvider<T = any>({ 
  children, 
  config = {},
  searchId = 'default'
}: SearchProviderProps<T>) {
  const mergedConfig = { ...defaultConfig, ...config };
  
  // Core search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [page, setPageState] = useState(1);
  const [cursor, setCursorState] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult<T> | null>(null);
  const [error, setError] = useState<SearchError | null>(null);
  
  // Loading states
  const [loadingStates, setLoadingStatesState] = useState<LoadingStates>({
    initial: false,
    searching: false,
    loadingMore: false,
    refreshing: false,
    suggestions: false
  });
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Real-time state
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  
  // Cache and performance tracking
  const cacheRef = useRef(new SearchCache<T>(mergedConfig.cacheSize, mergedConfig.cacheTtl));
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, size: 0 });
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({ 
    averageSearchTime: 0, 
    totalSearches: 0 
  });
  
  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, mergedConfig.debounceMs);
  const debouncedSuggestionTerm = useDebounce(searchTerm, mergedConfig.suggestionDebounceMs);
  
  // Computed values
  const trimmedSearch = useMemo(() => debouncedSearchTerm.trim(), [debouncedSearchTerm]);
  const isEmptySearch = useMemo(() => trimmedSearch === '', [trimmedSearch]);
  
  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    if (searchTerm.length < mergedConfig.minLength) {
      errors.push(`Search term must be at least ${mergedConfig.minLength} characters`);
    }
    
    if (searchTerm.length > mergedConfig.maxLength) {
      errors.push(`Search term must be no more than ${mergedConfig.maxLength} characters`);
    }
    
    mergedConfig.validationRules.forEach(rule => {
      if (!rule.rule(searchTerm)) {
        errors.push(rule.message);
      }
    });
    
    return errors;
  }, [searchTerm, mergedConfig.validationRules, mergedConfig.minLength, mergedConfig.maxLength]);
  
  // Search key for query libraries
  const searchKey = useMemo(() => {
    const baseKey = [searchId, 'search', trimmedSearch, JSON.stringify(filters)];
    
    if (mergedConfig.mode === 'pagination') {
      return [...baseKey, page, mergedConfig.pageSize];
    } else {
      return [...baseKey, cursor];
    }
  }, [searchId, trimmedSearch, filters, mergedConfig.mode, page, mergedConfig.pageSize, cursor]);
  
  // Pagination helpers
  const totalPages = useMemo(() => {
    if (!results?.total) return 0;
    return Math.ceil(results.total / mergedConfig.pageSize);
  }, [results?.total, mergedConfig.pageSize]);
  
  const hasNextPage = useMemo(() => page < totalPages, [page, totalPages]);
  const hasPrevPage = useMemo(() => page > 1, [page]);
  const hasMore = useMemo(() => results?.hasMore ?? false, [results?.hasMore]);
  
  // URL sync effect
  useEffect(() => {
    if (!mergedConfig.enableUrlSync) return;
    
    const params = getUrlParams();
    const urlSearchTerm = params.get(`${searchId}_search`) || '';
    const urlPage = parseInt(params.get(`${searchId}_page`) || '1');
    const urlFilters = params.get(`${searchId}_filters`);
    
    if (urlSearchTerm !== searchTerm) {
      setSearchTerm(urlSearchTerm);
    }
    
    if (urlPage !== page) {
      setPageState(urlPage);
    }
    
    if (urlFilters) {
      try {
        const parsedFilters = JSON.parse(urlFilters);
        setFilters(parsedFilters);
      } catch (e) {
        // Invalid JSON in URL, ignore
      }
    }
  }, []);
  
  // Update URL when state changes
  useEffect(() => {
    if (!mergedConfig.enableUrlSync) return;
    
    setUrlParams({
      [`${searchId}_search`]: searchTerm,
      [`${searchId}_page`]: page.toString(),
      [`${searchId}_filters`]: Object.keys(filters).length > 0 ? JSON.stringify(filters) : ''
    });
  }, [searchTerm, page, filters, searchId, mergedConfig.enableUrlSync]);
  
  // Load suggestions
  useEffect(() => {
    if (!mergedConfig.enableSuggestions || !debouncedSuggestionTerm || isEmptySearch) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    let isCurrent = true;
    
    const loadSuggestions = async () => {
      setLoadingStatesState(prev => ({ ...prev, suggestions: true }));
      
      try {
        const newSuggestions = await mergedConfig.onSuggestions!(debouncedSuggestionTerm);
        
        if (isCurrent) {
          setSuggestions(newSuggestions.slice(0, mergedConfig.maxSuggestions));
          setShowSuggestions(newSuggestions.length > 0);
        }
      } catch (err) {
        if (isCurrent) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (isCurrent) {
          setLoadingStatesState(prev => ({ ...prev, suggestions: false }));
        }
      }
    };
    
    loadSuggestions();
    
    return () => {
      isCurrent = false;
    };
  }, [debouncedSuggestionTerm, isEmptySearch, mergedConfig.enableSuggestions]);
  
  // Helper functions
  const setLoadingState = useCallback((state: keyof LoadingStates, value: boolean) => {
    setLoadingStatesState(prev => ({ ...prev, [state]: value }));
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const setFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    if (mergedConfig.mode === 'pagination') {
      setPageState(1); // Reset to first page when filter changes
    } else {
      setCursorState(null); // Reset cursor for infinite scroll
    }
  }, [mergedConfig.mode]);
  
  const removeFilter = useCallback((key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);
  
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);
  
  const getCachedResults = useCallback((searchKey: string): SearchResult<T> | null => {
    const cached = cacheRef.current.get(searchKey);
    if (cached) {
      setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
      mergedConfig.onCacheHit!(searchKey);
      return cached;
    }
    setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
    return null;
  }, [mergedConfig.onCacheHit]);
  
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    setCacheStats({ hits: 0, misses: 0, size: 0 });
  }, []);
  
  const search = useCallback(async (term?: string) => {
    const searchTermToUse = term ?? trimmedSearch;
    
    if (!searchTermToUse || validationErrors.length > 0) return;
    
    const startTime = Date.now();
    const currentSearchKey = searchKey.join('-');
    
    // Check cache first
    if (mergedConfig.enableCaching) {
      const cached = getCachedResults(currentSearchKey);
      if (cached) {
        setResults(cached);
        return;
      }
    }
    
    setLoadingState('searching', true);
    setError(null);
    
    try {
      const result = await mergedConfig.onSearch!(searchTermToUse, filters);
      setResults(result);
      
      // Cache the result
      if (mergedConfig.enableCaching) {
        cacheRef.current.set(currentSearchKey, result);
        setCacheStats(prev => ({ ...prev, size: cacheRef.current.getStats().size }));
      }
      
      // Update performance metrics
      const searchTime = Date.now() - startTime;
      setPerformanceMetrics(prev => ({
        totalSearches: prev.totalSearches + 1,
        averageSearchTime: (prev.averageSearchTime * prev.totalSearches + searchTime) / (prev.totalSearches + 1)
      }));
      
      // Add to search history
      setSearchHistory(prev => {
        const newHistory = [searchTermToUse, ...prev.filter(h => h !== searchTermToUse)];
        return newHistory.slice(0, 10); // Keep last 10 searches
      });
      
    } catch (err: any) {
      const searchError: SearchError = {
        message: err.message || 'Search failed',
        code: err.code,
        type: err.type || 'network',
        timestamp: Date.now()
      };
      setError(searchError);
      mergedConfig.onError!(searchError);
    } finally {
      setLoadingState('searching', false);
    }
  }, [trimmedSearch, validationErrors, searchKey, filters, mergedConfig, setLoadingState, getCachedResults]);
  
  const loadMore = useCallback(async () => {
    if (mergedConfig.mode !== 'infinite' || !hasMore) return;
    
    setLoadingState('loadingMore', true);
    
    try {
      const result = await mergedConfig.onLoadMore!();
      setResults(prev => prev ? {
        ...result,
        data: [...prev.data, ...result.data]
      } : result);
      
      if (result.nextCursor) {
        setCursorState(result.nextCursor);
      }
    } catch (err: any) {
      const searchError: SearchError = {
        message: err.message || 'Load more failed',
        type: 'network',
        timestamp: Date.now()
      };
      setError(searchError);
      mergedConfig.onError!(searchError);
    } finally {
      setLoadingState('loadingMore', false);
    }
  }, [mergedConfig, hasMore, setLoadingState]);
  
  const retrySearch = useCallback(async () => {
    clearError();
    await search();
  }, [clearError, search]);
  
  const refresh = useCallback(async () => {
    setLoadingState('refreshing', true);
    clearCache();
    await search();
    setLoadingState('refreshing', false);
  }, [setLoadingState, clearCache, search]);
  
  const reset = useCallback(() => {
    setSearchTerm('');
    setFilters({});
    setPageState(1);
    setCursorState(null);
    setResults(null);
    setError(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, []);
  
  // Pagination helpers
  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPageState(prev => prev + 1);
    }
  }, [hasNextPage]);
  
  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setPageState(prev => prev - 1);
    }
  }, [hasPrevPage]);
  
  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);
  
  const goToFirstPage = useCallback(() => setPageState(1), []);
  const goToLastPage = useCallback(() => setPageState(totalPages), [totalPages]);
  
  // Suggestion helpers
  const selectSuggestion = useCallback((suggestion: Suggestion) => {
    setSearchTerm(suggestion.value);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, []);
  
  const navigateSuggestions = useCallback((direction: 'up' | 'down') => {
    if (!showSuggestions || suggestions.length === 0) return;
    
    setSelectedSuggestionIndex(prev => {
      if (direction === 'down') {
        return prev < suggestions.length - 1 ? prev + 1 : 0;
      } else {
        return prev > 0 ? prev - 1 : suggestions.length - 1;
      }
    });
  }, [showSuggestions, suggestions.length]);
  
  const hideSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, []);
  
  // Input handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Reset pagination/cursor when search term changes
    if (mergedConfig.mode === 'pagination') {
      setPageState(1);
    } else {
      setCursorState(null);
    }
    
    // Reset suggestion selection
    setSelectedSuggestionIndex(-1);
  }, [mergedConfig.mode]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        search();
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigateSuggestions('down');
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateSuggestions('up');
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(suggestions[selectedSuggestionIndex]);
        } else {
          search();
        }
        break;
      case 'Escape':
        hideSuggestions();
        break;
    }
  }, [showSuggestions, selectedSuggestionIndex, suggestions, navigateSuggestions, selectSuggestion, search, hideSuggestions]);
  
  // Input props with accessibility
  const inputProps = useMemo(() => ({
    value: searchTerm,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    'aria-expanded': showSuggestions,
    'aria-haspopup': mergedConfig.enableSuggestions,
    'aria-activedescendant': selectedSuggestionIndex >= 0 ? `suggestion-${selectedSuggestionIndex}` : undefined,
    role: 'combobox'
  }), [searchTerm, handleInputChange, handleKeyDown, showSuggestions, mergedConfig.enableSuggestions, selectedSuggestionIndex]);
  
  const updateConfig = useCallback((newConfig: Partial<SearchConfig<T>>) => {
    Object.assign(mergedConfig, newConfig);
  }, [mergedConfig]);
  
  // Context value
  const value: SearchContextValue<T> = {
    // Search state
    searchTerm,
    debouncedSearchTerm,
    trimmedSearch,
    isEmptySearch,
    searchMode: mergedConfig.searchMode,
    
    // Input binding
    inputProps,
    
    // Loading states
    loadingStates,
    setLoadingState,
    
    // Error handling
    error,
    validationErrors,
    clearError,
    retrySearch,
    
    // Results and caching
    results,
    getCachedResults,
    clearCache,
    
    // Query compatibility
    searchKey,
    
    // Pagination
    page,
    pageSize: mergedConfig.pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    setPage,
    goToFirstPage,
    goToLastPage,
    
    // Infinite scroll
    cursor,
    setCursor: setCursorState,
    loadMore,
    hasMore,
    
    // Filters
    filters,
    setFilter,
    removeFilter,
    clearFilters,
    filterDefinitions: mergedConfig.filters,
    
    // Suggestions
    suggestions,
    selectedSuggestionIndex,
    showSuggestions,
    selectSuggestion,
    navigateSuggestions,
    hideSuggestions,
    
    // Search actions
    search,
    refresh,
    reset,
    
    // Configuration
    config: mergedConfig,
    updateConfig,
    
    // Real-time
    isRealTimeConnected,
    
    // Multi-search support
    searchId,
    
    // Dev tools
    debugInfo: {
      cacheStats,
      searchHistory,
      performanceMetrics
    }
  };
  
  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

// Hook to use search context
export function useSearch<T = any>(): SearchContextValue<T> {
  const context = useContext(SearchContext);
  
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  
  return context as SearchContextValue<T>;
}

// Multi-search hook for managing multiple search instances
export function useMultiSearch<T = any>(searchIds: string[]): Record<string, SearchContextValue<T>> {
  const searches: Record<string, SearchContextValue<T>> = {};
  
  searchIds.forEach(id => {
    // This would need to be implemented with a global search registry
    // For now, just return empty object
  });
  
  return searches;
}

// DevTools component
export function SearchDevTools() {
  const search = useSearch();
  
  if (!search.config.enableDevTools) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-lg max-w-md text-xs">
      <h3 className="font-bold mb-2">Search DevTools ({search.searchId})</h3>
      
      <div className="space-y-2">
        <div><strong>Search Term:</strong> "{search.searchTerm}"</div>
        <div><strong>Debounced:</strong> "{search.debouncedSearchTerm}"</div>
        <div><strong>Validation Errors:</strong> {search.validationErrors.length}</div>
        
        <div><strong>Cache Stats:</strong></div>
        <div className="ml-2">
          Hits: {search.debugInfo.cacheStats.hits} | 
          Misses: {search.debugInfo.cacheStats.misses} | 
          Size: {search.debugInfo.cacheStats.size}
        </div>
        
        <div><strong>Performance:</strong></div>
        <div className="ml-2">
          Avg Time: {search.debugInfo.performanceMetrics.averageSearchTime.toFixed(2)}ms |
          Total: {search.debugInfo.performanceMetrics.totalSearches}
        </div>
        
        <div><strong>Loading States:</strong></div>
        <div className="ml-2">
          {Object.entries(search.loadingStates).map(([key, value]) => (
            <div key={key}>{key}: {value ? '✓' : '✗'}</div>
          ))}
        </div>
        
        {search.debugInfo.searchHistory.length > 0 && (
          <>
            <div><strong>Recent Searches:</strong></div>
            <div className="ml-2 max-h-20 overflow-y-auto">
              {search.debugInfo.searchHistory.map((term, index) => (
                <div key={index} className="truncate">• {term}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
