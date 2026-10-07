import { createContext, useContext, useEffect } from 'react';

/**
 * Page context for PropVal.
 *
 * PropVal only needs to know which page the user is on and which property they
 * are looking at, so a page can describe itself here instead of PropVal having
 * to understand how that page is built. Explore publishes its active filters;
 * the property being viewed is read from the route.
 */
export const PropValContext = createContext(null);

const fallback = { pageContext: {}, publishPageContext: () => {} };

export const usePropValPage = () => useContext(PropValContext) ?? fallback;

/**
 * Publishes the filters a page currently has applied, so a follow-up question
 * such as "show similar properties" is answered in the same context. Filters are
 * serialised for the dependency so an inline object literal cannot loop.
 */
export function usePropValFilters(filters, resultCount) {
  const { publishPageContext } = usePropValPage();
  const serialised = JSON.stringify(filters ?? null);

  useEffect(() => {
    publishPageContext({
      lastSearch: serialised === 'null' ? null : JSON.parse(serialised),
      lastSearchResultCount: resultCount ?? null,
    });
  }, [publishPageContext, serialised, resultCount]);
}
