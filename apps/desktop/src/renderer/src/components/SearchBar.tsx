import React from "react";

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ query, setQuery, onSubmit }) => {
  return (
    <form onSubmit={onSubmit} className="log-query-form">
      <input
        type="text"
        className="log-query-input break-all"
        placeholder="Enter log query (e.g. service:orders level:error)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" className="query-submit-button break-all">
        Search
      </button>
    </form>
  );
};

export default SearchBar;
