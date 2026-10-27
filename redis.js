const EventEmitter = require('events');
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL || '';
const CHANNEL_PREFIX = 'koda:ws:';

class LocalPubSub extends EventEmitter {
  async publish(channel, message) {
    this.emit(channel, message);
    return 1;
  }
}

let publisher = null;
let subscriber = null;
let localBus = new LocalPubSub();
let isConnected = false;

if (REDIS_URL && !REDIS_URL.startsWith('replace')) {
  try {
    const redisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 10) return null; // stop retrying after 10 attempts
        return Math.min(times * 100, 3000);
      }
    };

    publisher = new Redis(REDIS_URL, redisOptions);
    subscriber = new Redis(REDIS_URL, redisOptions);

    publisher.on('connect', () => {
      isConnected = true;
      console.log('[Redis] Publisher connected for horizontal cluster scaling.');
    });

    publisher.on('error', (err) => {
      isConnected = false;
      console.warn('[Redis] Publisher connection warning (falling back to local bus):', err.message);
    });

    subscriber.on('error', (err) => {
      console.warn('[Redis] Subscriber connection warning:', err.message);
    });
  } catch (err) {
    console.warn('[Redis] Initialization skipped, using local pubsub bus:', err.message);
    publisher = null;
    subscriber = null;
  }
}

const subscriptions = new Map();

/**
 * Publish a message to a cluster-wide channel
 */
async function publishClusterMessage(channel, payload) {
  const fullChannel = `${CHANNEL_PREFIX}${channel}`;
  const serialized = JSON.stringify(payload);

  if (isConnected && publisher) {
    try {
      await publisher.publish(fullChannel, serialized);
      return;
    } catch (err) {
      console.warn('[Redis] Publish failed, broadcasting to local bus:', err.message);
    }
  }

  localBus.publish(fullChannel, serialized);
}

/**
 * Subscribe to a cluster-wide channel
 */
function subscribeClusterMessage(channel, handler) {
  const fullChannel = `${CHANNEL_PREFIX}${channel}`;

  if (!subscriptions.has(fullChannel)) {
    subscriptions.set(fullChannel, new Set());

    if (isConnected && subscriber) {
      subscriber.subscribe(fullChannel, (err) => {
        if (err) console.warn('[Redis] Subscription error:', err.message);
      });

      subscriber.on('message', (chan, msg) => {
        if (chan === fullChannel) {
          try {
            const parsed = JSON.parse(msg);
            const handlers = subscriptions.get(fullChannel);
            if (handlers) {
              for (const h of handlers) h(parsed);
            }
          } catch (_) {}
        }
      });
    }

    localBus.on(fullChannel, (msg) => {
      // Only process from localBus if Redis is not active
      if (!isConnected || !subscriber) {
        try {
          const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;
          const handlers = subscriptions.get(fullChannel);
          if (handlers) {
            for (const h of handlers) h(parsed);
          }
        } catch (_) {}
      }
    });
  }

  const handlers = subscriptions.get(fullChannel);
  handlers.add(handler);

  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      subscriptions.delete(fullChannel);
      if (isConnected && subscriber) {
        subscriber.unsubscribe(fullChannel);
      }
    }
  };
}

module.exports = {
  isRedisConnected: () => isConnected,
  publishClusterMessage,
  subscribeClusterMessage
};
