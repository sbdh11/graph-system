import net from 'net';
import { PORT } from './config/index.js';
import { app, init } from './app.js';

function isPortInUse(port) {
  return new Promise(resolve => {
    const tester = net.createServer();

    const finalize = (inUse) => {
      try {
        tester.close();
      } catch {
        // ignore
      }
      resolve(Boolean(inUse));
    };

    tester.once('error', err => {
      // Some systems can differ between IPv4/IPv6 bindings; if IPv6 isn't available,
      // fall back to IPv4 host probing.
      if (err && err.code === 'EADDRINUSE') return finalize(true);
      if (err && (err.code === 'EAFNOSUPPORT' || err.code === 'EINVAL')) {
        return tester.listen(port, '0.0.0.0').once('error', e2 => {
          if (e2 && e2.code === 'EADDRINUSE') return finalize(true);
          return finalize(false);
        }).once('listening', () => tester.close(() => resolve(false)));
      }
      return finalize(false);
    });

    tester.once('listening', () => {
      tester.close(() => resolve(false));
    });

    // Probe IPv6 first because Express/Node often binds to '::' on Windows.
    tester.listen(port, '::');
  });
}

// Help debug "server terminates itself" by printing why it exits.
process.on('SIGINT', () => {
  console.warn('Server received SIGINT (Ctrl+C). Exiting...');
});
process.on('SIGTERM', () => {
  console.warn('Server received SIGTERM. Exiting...');
});
process.on('uncaughtException', (err) => {
  console.error('Server uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Server unhandledRejection:', reason);
});

(async () => {
  try {
    if (await isPortInUse(PORT)) {
      console.error(`Port ${PORT} is already in use. Stop the existing server and re-run.`);
      process.exitCode = 1;
      return;
    }

    await init();

    const server = app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });

    server.on('error', (err) => {
      console.error('Server failed to listen:', err);
      process.exitCode = 1;
    });
  } catch (err) {
    console.error('Server init failed:', err);
    process.exitCode = 1;
  }
})();
