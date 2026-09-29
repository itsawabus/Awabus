// Page sizes are capped so a request like ?limit=100000 can't pull a whole
// collection (photos included) in one go. The apps ask for 8-20 per page.
export const MAX_PAGE_SIZE = 100;

export const getPagination = (query, defaultLimit = 10) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), MAX_PAGE_SIZE);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.max(Math.ceil(total / limit), 1),
});
