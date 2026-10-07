import { useMemo, useState } from 'react';
import { PropValContext } from './PropValContext.js';

const emptyPageContext = { lastSearch: null, lastSearchResultCount: null };

export function PropValProvider({ children }) {
  const [pageContext, setPageContext] = useState(emptyPageContext);
  const value = useMemo(() => ({ pageContext, publishPageContext: setPageContext }), [pageContext]);

  return <PropValContext.Provider value={value}>{children}</PropValContext.Provider>;
}
