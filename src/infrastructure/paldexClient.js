function fetchPaldexSearch({ baseUrl, timeoutMs, query }) {
  if (!baseUrl) {
    return Promise.resolve({
      configured: false,
      baseUrl: 'not configured',
      ok: false,
      errors: [],
      page: 1,
      limit: normalizeLimit(query.limit, 12),
      count: 0,
      total: 0,
      query: normalizeQuery(query),
      content: [],
      note: 'Define PALDEX_API_URL para activar la búsqueda.'
    });
  }

  const activeQuery = normalizeQuery(query);
  const hasSearchCriteria = ['term', 'name', 'description', 'key', 'types', 'suitabilities', 'drops']
    .some((key) => Boolean(activeQuery[key]));

  if (!hasSearchCriteria) {
    return Promise.resolve({
      configured: true,
      baseUrl,
      ok: true,
      errors: [],
      page: normalizePage(activeQuery.page),
      limit: normalizeLimit(activeQuery.limit, 12),
      count: 0,
      total: 0,
      query: activeQuery,
      content: [],
      note: 'Escribe un nombre, tipo, habilidad o término para buscar.'
    });
  }

  return fetchPaldexPayload({ baseUrl, timeoutMs, query: activeQuery });
}

async function fetchPaldexPayload({ baseUrl, timeoutMs, query }) {
  const startedAt = Date.now();
  const requestUrl = buildPaldexRequestUrl(baseUrl, query);

  try {
    const response = await fetch(requestUrl, {
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`GET ${requestUrl.pathname}${requestUrl.search} -> ${response.status}`);
    }

    const payload = await response.json();
    const content = Array.isArray(payload?.content)
      ? payload.content
      : Array.isArray(payload)
        ? payload
        : [];

    return {
      configured: true,
      baseUrl,
      ok: true,
      errors: [],
      latencyMs: Date.now() - startedAt,
      page: normalizePage(payload?.page ?? query.page),
      limit: normalizeLimit(payload?.limit ?? query.limit, 12),
      count: normalizeCount(payload?.count ?? content.length),
      total: normalizeCount(payload?.total ?? content.length),
      query,
      content: content.map((pal) => normalizePaldexPal(baseUrl, pal))
    };
  } catch (error) {
    return {
      configured: true,
      baseUrl,
      ok: false,
      errors: [error?.message || String(error)],
      latencyMs: Date.now() - startedAt,
      page: normalizePage(query.page),
      limit: normalizeLimit(query.limit, 12),
      count: 0,
      total: 0,
      query,
      content: []
    };
  }
}

function buildPaldexRequestUrl(baseUrl, query) {
  const normalizedBase = String(baseUrl).replace(/\/$/, '');
  const requestUrl = new URL(`${normalizedBase}/`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    const text = String(value).trim();
    if (!text) {
      continue;
    }

    requestUrl.searchParams.set(key, text);
  }

  return requestUrl;
}

function normalizePaldexPal(baseUrl, pal) {
  const types = Array.isArray(pal?.types) ? pal.types : [];
  const suitability = Array.isArray(pal?.suitability) ? pal.suitability : [];

  return {
    id: Number(pal?.id || 0),
    key: String(pal?.key || '').trim(),
    name: String(pal?.name || 'Sin nombre'),
    description: String(pal?.description || ''),
    wiki: String(pal?.wiki || ''),
    imageUrl: resolvePaldexAssetUrl(baseUrl, pal?.image || pal?.asset || ''),
    imageWikiUrl: resolvePaldexAssetUrl(baseUrl, pal?.imageWiki || ''),
    types: types.map((type) => normalizeType(baseUrl, type)).filter(Boolean),
    suitabilities: suitability.map((item) => normalizeSuitability(baseUrl, item)).filter(Boolean),
    drops: Array.isArray(pal?.drops) ? pal.drops.map((drop) => String(drop)) : [],
    aura: pal?.aura || null,
    stats: pal?.stats || null,
    genus: String(pal?.genus || ''),
    rarity: Number.isFinite(Number(pal?.rarity)) ? Number(pal.rarity) : null,
    price: Number.isFinite(Number(pal?.price)) ? Number(pal.price) : null,
    size: String(pal?.size || ''),
    breeding: pal?.breeding || null
  };
}

function normalizeType(baseUrl, type) {
  if (typeof type === 'string') {
    const name = type.trim();

    return {
      name,
      imageUrl: resolvePaldexAssetUrl(baseUrl, `/public/images/elements/${slugify(name)}.png`)
    };
  }

  if (!type || typeof type !== 'object') {
    return null;
  }

  const name = String(type.name || type.type || type.key || '').trim();

  if (!name) {
    return null;
  }

  return {
    name,
    imageUrl: resolvePaldexAssetUrl(
      baseUrl,
      type.image || `/public/images/elements/${slugify(name)}.png`
    )
  };
}

function normalizeSuitability(baseUrl, item) {
  if (typeof item === 'string') {
    return { name: item.trim(), imageUrl: '' };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const name = String(item.type || item.name || '').trim();

  if (!name) {
    return null;
  }

  return {
    name,
    level: item.level || item.rank || null,
    imageUrl: resolvePaldexAssetUrl(baseUrl, item.image || '')
  };
}

function resolvePaldexAssetUrl(baseUrl, assetPath) {
  if (!assetPath) {
    return '';
  }

  const text = String(assetPath).trim();

  if (!text) {
    return '';
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  const normalizedBase = String(baseUrl).replace(/\/$/, '');
  const normalizedPath = text.startsWith('/') ? text : `/${text}`;

  return `${normalizedBase}${normalizedPath}`;
}

function normalizeQuery(query) {
  return {
    page: normalizePage(query?.page),
    limit: normalizeLimit(query?.limit, 12),
    term: normalizeText(query?.term),
    name: normalizeText(query?.name),
    description: normalizeText(query?.description),
    key: normalizeText(query?.key),
    types: normalizeText(query?.types),
    suitabilities: normalizeText(query?.suitabilities),
    drops: normalizeText(query?.drops)
  };
}

function normalizeText(value) {
  const text = Array.isArray(value) ? value[0] : value;
  const normalized = String(text || '').trim();
  return normalized;
}

function normalizePage(value) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value || '', 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
}

function normalizeLimit(value, fallback) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value || '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 48);
}

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

module.exports = {
  fetchPaldexSearch,
  resolvePaldexAssetUrl
};
