// Native Writer is intentionally disconnected from production publishing for now.
// Keep the implementation and worker available for isolated capability testing.
// Reconnect only after V2 completion and a production-readiness sign-off.
if(process.env.TREND_FORGE_NATIVE_WRITER_PRODUCTION==='true'){
  console.log('Native Writer production integration explicitly enabled.');
  console.error('Native Writer production mode is intentionally disabled in this phase; use the isolated capability test workflow instead.');
}
console.log('Native Writer production fallback DISABLED — retained only for isolated side testing.');
process.exit(0);
