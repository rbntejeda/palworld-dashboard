const DEFAULT_REPO_RAW_BASE = 'https://raw.githubusercontent.com/mlg404/palworld-paldex-api/main';
const DEFAULT_DATA_BASE_URL = `${DEFAULT_REPO_RAW_BASE}/src`;

const cache = {
  pals: { loadedAt: 0, items: [] },
  items: { loadedAt: 0, items: [] },
  gear: { loadedAt: 0, items: [] }
};

async function searchPaldexCatalog({
  section,
  query,
  apiBaseUrl,
  assetBaseUrl,
  dataBaseUrl = DEFAULT_DATA_BASE_URL,
  timeoutMs = 8000
}) {
  const normalizedSection = normalizeSection(section);
  const normalizedQuery = normalizeQuery(query);
  const normalizedAssetBase = normalizeBaseUrl(assetBaseUrl || apiBaseUrl || DEFAULT_REPO_RAW_BASE);
  const normalizedDataBase = normalizeBaseUrl(dataBaseUrl || DEFAULT_DATA_BASE_URL);

  if (normalizedSection === 'pals') {
    return searchPals({
      query: normalizedQuery,
      apiBaseUrl: normalizeBaseUrl(apiBaseUrl),
      assetBaseUrl: normalizedAssetBase,
      dataBaseUrl: normalizedDataBase,
      timeoutMs
    });
  }

  if (normalizedSection === 'items') {
    return searchItems({
      query: normalizedQuery,
      assetBaseUrl: normalizedAssetBase,
      dataBaseUrl: normalizedDataBase
    });
  }

  if (normalizedSection === 'gear') {
    return searchGear({
      query: normalizedQuery,
      assetBaseUrl: normalizedAssetBase,
      dataBaseUrl: normalizedDataBase
    });
  }

  return {
    configured: false,
    baseUrl: normalizedAssetBase,
    section: normalizedSection,
    ok: false,
    errors: [`Unsupported section: ${normalizedSection}`],
    page: normalizedQuery.page,
    limit: normalizedQuery.limit,
    count: 0,
    total: 0,
    query: normalizedQuery,
    content: [],
    note: 'Sección no reconocida.'
  };
}

async function searchPals({ query, apiBaseUrl, assetBaseUrl, dataBaseUrl, timeoutMs }) {
  const hasSearchCriteria = hasQuery(query, ['term', 'name', 'description', 'key', 'types', 'suitabilities', 'drops']);
  const hasAdvancedFilters = hasQuery(query, ['types', 'suitabilities', 'drops']);
  const remoteAvailable = Boolean(apiBaseUrl);

  if (!hasSearchCriteria) {
    const pals = await loadJsonCatalog('pals', `${dataBaseUrl}/pals.json`);
    const sliced = paginate(pals, query.page, query.limit);

    return {
      configured: remoteAvailable,
      baseUrl: dataBaseUrl,
      section: 'pals',
      ok: true,
      errors: [],
      page: sliced.page,
      limit: sliced.limit,
      count: sliced.content.length,
      total: pals.length,
      query,
      content: sliced.content.map((pal) => normalizePal(assetBaseUrl, pal)),
      note: 'Mostrando el catálogo completo desde el dataset público.'
    };
  }

  if (remoteAvailable && !hasAdvancedFilters) {
    const remote = await fetchRemotePals({ apiBaseUrl, query, timeoutMs, assetBaseUrl });
    if (remote.ok) {
      return remote;
    }
  }

  const pals = await loadJsonCatalog('pals', `${dataBaseUrl}/pals.json`);
  const filtered = pals.filter((pal) => matchesPalQuery(pal, query));
  const sliced = paginate(filtered, query.page, query.limit);

  return {
    configured: false,
    baseUrl: dataBaseUrl,
    section: 'pals',
    ok: true,
    errors: [],
    page: sliced.page,
    limit: sliced.limit,
    count: sliced.content.length,
    total: filtered.length,
    query,
    content: sliced.content.map((pal) => normalizePal(assetBaseUrl, pal)),
    note: 'Usando catálogo público como respaldo.'
  };
}

async function fetchRemotePals({ apiBaseUrl, query, timeoutMs, assetBaseUrl }) {
  const startedAt = Date.now();
  const requestUrl = buildPaldexRequestUrl(apiBaseUrl, query);

  try {
    const response = await fetch(requestUrl, { signal: AbortSignal.timeout(timeoutMs) });
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
      baseUrl: apiBaseUrl,
      section: 'pals',
      ok: true,
      errors: [],
      latencyMs: Date.now() - startedAt,
      page: normalizePage(payload?.page ?? query.page),
      limit: normalizeLimit(payload?.limit ?? query.limit, 12),
      count: normalizeCount(payload?.count ?? content.length),
      total: normalizeCount(payload?.total ?? content.length),
      query,
      content: content.map((pal) => normalizePal(assetBaseUrl, pal))
    };
  } catch (error) {
    return {
      configured: true,
      baseUrl: apiBaseUrl,
      section: 'pals',
      ok: false,
      errors: [error?.message || String(error)],
      latencyMs: Date.now() - startedAt,
      page: query.page,
      limit: query.limit,
      count: 0,
      total: 0,
      query,
      content: []
    };
  }
}

async function searchItems({ query, assetBaseUrl, dataBaseUrl }) {
  const items = await loadJsonCatalog('items', `${dataBaseUrl}/item.json`);
  const filtered = items.filter((item) => matchesItemQuery(item, query));
  const sliced = paginate(filtered, query.page, query.limit);

  return {
    configured: true,
    baseUrl: dataBaseUrl,
    section: 'items',
    ok: true,
    errors: [],
    page: sliced.page,
    limit: sliced.limit,
    count: sliced.content.length,
    total: filtered.length,
    query,
    content: sliced.content.map((item) => normalizeItem(assetBaseUrl, item)),
    note: filtered.length ? 'Catálogo de items cargado desde el dataset público.' : 'No se encontraron items con ese filtro.'
  };
}

async function searchGear({ query, assetBaseUrl, dataBaseUrl }) {
  const gear = await loadJsonCatalog('gear', `${dataBaseUrl}/gear.json`);
  const filtered = gear.filter((item) => matchesGearQuery(item, query));
  const sliced = paginate(filtered, query.page, query.limit);

  return {
    configured: true,
    baseUrl: dataBaseUrl,
    section: 'gear',
    ok: true,
    errors: [],
    page: sliced.page,
    limit: sliced.limit,
    count: sliced.content.length,
    total: filtered.length,
    query,
    content: sliced.content.map((item) => normalizeGear(assetBaseUrl, item)),
    note: filtered.length ? 'Equipamiento y variantes de rareza listos.' : 'No se encontró gear con ese filtro.'
  };
}

async function loadJsonCatalog(section, url) {
  const cached = cache[section];
  if (cached && cached.items.length) {
    return cached.items;
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`GET ${url} -> ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : [];
  cache[section] = {
    loadedAt: Date.now(),
    items
  };
  return items;
}

function normalizePal(assetBaseUrl, pal) {
  const types = Array.isArray(pal?.types) ? pal.types : [];
  const suitability = Array.isArray(pal?.suitabilities)
    ? pal.suitabilities
    : Array.isArray(pal?.suitability)
      ? pal.suitability
      : [];

  return {
    id: Number(pal?.id || 0),
    key: String(pal?.key || '').trim(),
    name: String(pal?.name || 'Sin nombre'),
    description: String(pal?.description || ''),
    wiki: String(pal?.wiki || ''),
    imageUrl: resolveAssetUrl(assetBaseUrl, pal?.image || pal?.asset || ''),
    imageWikiUrl: resolveAssetUrl(assetBaseUrl, pal?.imageWiki || ''),
    types: types.map((type) => normalizeType(assetBaseUrl, type)).filter(Boolean),
    suitabilities: suitability.map((item) => normalizeSuitability(assetBaseUrl, item)).filter(Boolean),
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

function normalizeItem(assetBaseUrl, item) {
  return {
    name: String(item?.name || 'Sin nombre'),
    type: String(item?.type || ''),
    key: String(item?.key || ''),
    imageUrl: resolveAssetUrl(assetBaseUrl, item?.image || ''),
    gold: Number(item?.gold || 0),
    weight: Number(item?.weight || 0)
  };
}

function normalizeGear(assetBaseUrl, item) {
  const tiers = Object.entries(item?.status || {}).map(([tier, stats]) => ({
    tier,
    hp: Number(stats?.hp || 0),
    defense: Number(stats?.defense || 0),
    price: Number(stats?.price || 0),
    durability: Number(stats?.durability || 0)
  }));

  return {
    name: String(item?.name || 'Sin nombre'),
    key: slugify(item?.name || ''),
    imageUrl: resolveAssetUrl(assetBaseUrl, `/public/images/items/${slugify(item?.name || '')}.png`),
    tiers
  };
}

function normalizeType(assetBaseUrl, type) {
  if (typeof type === 'string') {
    const name = type.trim();
    return {
      name,
      imageUrl: resolveAssetUrl(assetBaseUrl, `/public/images/elements/${slugify(name)}.png`)
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
    imageUrl: resolveAssetUrl(assetBaseUrl, type.image || `/public/images/elements/${slugify(name)}.png`)
  };
}

function normalizeSuitability(assetBaseUrl, item) {
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
    imageUrl: resolveAssetUrl(assetBaseUrl, item.image || '')
  };
}

function buildPaldexRequestUrl(baseUrl, query) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
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

function normalizeQuery(query) {
  return {
    page: normalizePage(query?.page),
    limit: normalizeLimit(query?.limit, 12),
    term: normalizeText(query?.term),
    name: normalizeText(query?.name),
    type: normalizeText(query?.type),
    description: normalizeText(query?.description),
    key: normalizeText(query?.key),
    types: normalizeText(query?.types),
    suitabilities: normalizeText(query?.suitabilities),
    drops: normalizeText(query?.drops)
  };
}

function normalizeSection(value) {
  const section = String(Array.isArray(value) ? value[0] : value || 'pals').trim().toLowerCase();

  if (section === 'items' || section === 'gear' || section === 'pals') {
    return section;
  }

  return 'pals';
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

function normalizeText(value) {
  const text = Array.isArray(value) ? value[0] : value;
  return String(text || '').trim();
}

function splitValues(value) {
  return normalizeText(value)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function hasQuery(query, keys) {
  return keys.some((key) => Boolean(query[key]));
}

function matchesPalQuery(pal, query) {
  if (!hasQuery(query, ['term', 'name', 'description', 'key', 'types', 'suitabilities', 'drops'])) {
    return true;
  }

  const haystack = [
    pal?.name,
    pal?.description,
    pal?.key,
    pal?.genus,
    Array.isArray(pal?.drops) ? pal.drops.join(' ') : '',
    Array.isArray(pal?.types) ? pal.types.map((type) => type?.name || type).join(' ') : '',
    Array.isArray(pal?.suitabilities)
      ? pal.suitabilities.map((item) => item?.type || item?.name || '').join(' ')
      : Array.isArray(pal?.suitability)
        ? pal.suitability.map((item) => item?.type || item?.name || '').join(' ')
        : ''
  ]
    .join(' ')
    .toLowerCase();

  const term = query.term || query.name || query.description || query.key;
  const selectedTypes = splitValues(query.types);
  const selectedSuitabilities = splitValues(query.suitabilities);
  const selectedDrops = splitValues(query.drops);
  const palTypes = Array.isArray(pal?.types)
    ? pal.types.map((type) => String(type?.name || type || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const palSuitabilities = Array.isArray(pal?.suitabilities)
    ? pal.suitabilities.map((item) => String(item?.type || item?.name || '').trim().toLowerCase()).filter(Boolean)
    : Array.isArray(pal?.suitability)
      ? pal.suitability.map((item) => String(item?.type || item?.name || '').trim().toLowerCase()).filter(Boolean)
      : [];
  const palDrops = Array.isArray(pal?.drops)
    ? pal.drops.map((drop) => String(drop || '').trim().toLowerCase()).filter(Boolean)
    : [];

  return (
    (!term || matchesText(haystack, term)) &&
    matchesAny(selectedTypes, palTypes) &&
    matchesAny(selectedSuitabilities, palSuitabilities) &&
    matchesAny(selectedDrops, palDrops)
  );
}

function matchesItemQuery(item, query) {
  const haystack = [
    item?.name,
    item?.type,
    item?.key
  ]
    .join(' ')
    .toLowerCase();

  const term = query.term || query.name || query.type || query.key;
  if (!term) {
    return true;
  }

  return matchesText(haystack, term);
}

function matchesGearQuery(item, query) {
  const haystack = String(item?.name || '').toLowerCase();
  const term = query.term || query.name || query.key;
  if (!term) {
    return true;
  }

  return matchesText(haystack, term);
}

function matchesText(haystack, needle) {
  return String(haystack).includes(String(needle).toLowerCase());
}

function matchesAny(needles, haystackValues) {
  if (!needles.length) {
    return true;
  }

  return needles.some((needle) => {
    const normalizedNeedle = String(needle || '').trim().toLowerCase();
    if (!normalizedNeedle) {
      return false;
    }

    return haystackValues.some((value) => value.includes(normalizedNeedle) || normalizedNeedle.includes(value));
  });
}

function paginate(items, page, limit) {
  const normalizedPage = normalizePage(page);
  const normalizedLimit = normalizeLimit(limit, 12);
  const start = (normalizedPage - 1) * normalizedLimit;
  const content = items.slice(start, start + normalizedLimit);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    content
  };
}

function resolveAssetUrl(baseUrl, assetPath) {
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

  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = text.startsWith('/') ? text : `/${text}`;
  return `${normalizedBase}${normalizedPath}`;
}

function normalizeBaseUrl(value) {
  const text = String(value || '').trim();
  return text.replace(/\/$/, '');
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  searchPaldexCatalog,
  resolveAssetUrl,
  slugify
};
