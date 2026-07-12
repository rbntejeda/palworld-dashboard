function detectPlatform(userId, accountName) {
  if (userId.startsWith('steam_')) {
    return { key: 'steam', label: 'Steam', glyph: 'S' };
  }

  if (userId.startsWith('xbox_') || userId.startsWith('xbl') || accountName.includes('xbox')) {
    return { key: 'xbox', label: 'Xbox', glyph: 'X' };
  }

  return { key: 'pc', label: 'PC', glyph: 'P' };
}

function normalizePlayer(player) {
  const userId = String(player?.userId || '').toLowerCase();
  const accountName = String(player?.accountName || '').trim();
  const name = String(player?.name || accountName || 'Unknown').trim();
  const platform = detectPlatform(userId, accountName);
  const hasLocationX = player?.location_x !== undefined && player?.location_x !== null || player?.locationX !== undefined && player?.locationX !== null;
  const hasLocationY = player?.location_y !== undefined && player?.location_y !== null || player?.locationY !== undefined && player?.locationY !== null;
  const locationX = Number(player?.location_x ?? player?.locationX ?? 0);
  const locationY = Number(player?.location_y ?? player?.locationY ?? 0);

  return {
    name,
    accountName: accountName || name,
    userId: player?.userId || '',
    playerId: player?.playerId || '',
    ip: player?.ip || player?.iP || '',
    ping: Number(player?.ping || 0),
    locationX,
    locationY,
    hasLocationX,
    hasLocationY,
    hasCoordinates: hasLocationX && hasLocationY,
    level: Number(player?.level || 0),
    buildingCount: Number(player?.building_count ?? player?.buildingCount ?? 0),
    platform
  };
}

module.exports = {
  detectPlatform,
  normalizePlayer
};
