// Expo config plugin: records any crash of the Android app (including native
// ones the JavaScript side can never see) so the next launch can show it and
// send it to the AwaBus server. If the crash came from the background
// location service, the saved tracking task is forgotten too, so the next
// launch does not restart it and crash again.
const fs = require('fs');
const path = require('path');
const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');

const crashCaptureSource = (pkg) => `package ${pkg}

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import org.json.JSONObject
import java.io.PrintWriter
import java.io.StringWriter

// Added by plugins/withCrashCapture.js (AwaBus).
object CrashCapture {
  private const val TAG = "AwaBusCrash"

  fun install(context: Context) {
    val app = context.applicationContext
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        save(app, error)
      } catch (e: Throwable) {
        Log.e(TAG, "Could not record the crash", e)
      }
      previous?.uncaughtException(thread, error)
    }
  }

  private fun save(context: Context, error: Throwable) {
    val writer = StringWriter()
    error.printStackTrace(PrintWriter(writer))
    val stack = writer.toString().take(6000)
    val message = (error.javaClass.name + ": " + (error.message ?: "")).take(500)
    val entry = JSONObject()
      .put("message", message)
      .put("stack", stack)
      .put("fatal", true)
      .put("native", true)
      .put("at", System.currentTimeMillis())
    // The app's AsyncStorage database, read as "awabus_last_crash" by src/lib/crashLog.js.
    val file = context.getDatabasePath("RKStorage")
    file.parentFile?.mkdirs()
    val db = SQLiteDatabase.openOrCreateDatabase(file, null)
    try {
      db.execSQL("CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
      db.execSQL(
        "INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (?, ?)",
        arrayOf<Any>("awabus_last_crash", entry.toString())
      )
    } finally {
      db.close()
    }
    // A crash in the location service: forget the saved tracking task (expo-task-manager
    // restores it at every launch, before the app's code can stop it).
    if (stack.contains("expo.modules.location") || stack.contains("ForegroundService") || stack.contains("startForeground")) {
      context.getSharedPreferences("TaskManagerModule", Context.MODE_PRIVATE).edit().clear().commit()
    }
  }
}
`;

function withCrashCapture(config) {
  const pkg = config.android?.package;
  if (!pkg) throw new Error('withCrashCapture: expo.android.package is not set');

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'CrashCapture.kt'), crashCaptureSource(pkg));
      return cfg;
    },
  ]);

  return withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('CrashCapture.install(this)')) {
      const anchor = 'super.onCreate()';
      if (!src.includes(anchor)) throw new Error('withCrashCapture: could not find super.onCreate() in MainApplication');
      cfg.modResults.contents = src.replace(anchor, `${anchor}\n    CrashCapture.install(this)`);
    }
    return cfg;
  });
}

module.exports = withCrashCapture;
