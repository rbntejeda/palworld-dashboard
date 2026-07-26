const { announcePalworldMessage } = require('../infrastructure/palworldRestClient');

function createRestartAnnouncer(config, logger = console) {
  let interval = null;
  let lastAnnouncementKey = '';

  async function announceIfDue(now = new Date()) {
    if (!config.restartAnnounceEnabled || !config.restBaseUrl) {
      return false;
    }

    const zoned = getZonedParts(now, config.restartAnnounceTimezone);
    const localTime = `${zoned.hour}:${zoned.minute}`;
    const announcementKey = `${zoned.year}-${zoned.month}-${zoned.day}`;

    if (localTime !== config.restartAnnounceTime || lastAnnouncementKey === announcementKey) {
      return false;
    }

    lastAnnouncementKey = announcementKey;

    try {
      await announcePalworldMessage({
        baseUrl: config.restBaseUrl,
        username: config.restUsername,
        password: config.restPassword,
        message: config.restartAnnounceMessage
      });
      logger.log(`Palworld restart announcement sent for ${announcementKey} ${localTime} ${config.restartAnnounceTimezone}`);
      return true;
    } catch (error) {
      lastAnnouncementKey = '';
      logger.error(`Palworld restart announcement failed: ${error.message}`);
      return false;
    }
  }

  function start() {
    if (!config.restartAnnounceEnabled) {
      return;
    }

    void announceIfDue();
    interval = setInterval(() => {
      void announceIfDue();
    }, config.restartAnnounceCheckIntervalMs);
  }

  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  return {
    announceIfDue,
    start,
    stop
  };
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

module.exports = {
  createRestartAnnouncer
};
